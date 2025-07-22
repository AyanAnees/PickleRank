export const runtime = "nodejs";
import { NextResponse } from 'next/server';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { adminAuth, db } from '@/lib/firebase-admin';
import { calculateEloChange, getStreakBonus } from '@/lib/elo';

interface Team {
  players: string[];
  score: number;
}

async function isAdmin(request: Request): Promise<boolean> {
  try {
    const authToken = request.headers.get('cookie')?.split('auth-token=')[1]?.split(';')[0];
    if (!authToken) return false;
    
    const decodedToken = await adminAuth.verifyIdToken(authToken);
    const userId = decodedToken.uid;
    
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    
    return userData?.isAdmin === true;
  } catch (error) {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const { seasonId, team1, team2, userId } = await request.json() as {
      seasonId: string;
      team1: Team;
      team2: Team;
      userId: string;
    };

    // Validate input
    if (!seasonId || !team1 || !team2 || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate season exists and is active
    const seasonDoc = await db.collection('seasons').doc(seasonId).get();
    if (!seasonDoc.exists) {
      return NextResponse.json(
        { error: 'Season does not exist' },
        { status: 400 }
      );
    }
    const seasonData = seasonDoc.data();
    if (!seasonData?.isActive) {
      return NextResponse.json(
        { error: 'Season is not active' },
        { status: 400 }
      );
    }

    // Validate all players exist and are active
    const allPlayers = [...team1.players, ...team2.players];
    if (allPlayers.some(p => !p || typeof p !== 'string' || p.trim() === '')) {
      return NextResponse.json(
        { error: 'All player IDs must be non-empty strings' },
        { status: 400 }
      );
    }
    const uniquePlayers = new Set(allPlayers);
    if (uniquePlayers.size !== 4) {
      return NextResponse.json(
        { error: 'Each player can only play once per game' },
        { status: 400 }
      );
    }

    const playerDocs = await Promise.all(
      allPlayers.map(playerId => db.collection('users').doc(playerId).get())
    );
    
    const invalidPlayers = playerDocs.filter(doc => !doc.exists);
    if (invalidPlayers.length > 0) {
      return NextResponse.json(
        { error: 'One or more players do not exist' },
        { status: 400 }
      );
    }

    // Validate scores
    const score1 = team1.score;
    const score2 = team2.score;
    
    if (!Number.isInteger(score1) || !Number.isInteger(score2)) {
      return NextResponse.json(
        { error: 'Scores must be integers' },
        { status: 400 }
      );
    }

    if (score1 < 0 || score2 < 0) {
      return NextResponse.json(
        { error: 'Scores must be non-negative numbers' },
        { status: 400 }
      );
    }

    // A team must score at least 11 points to win
    if (score1 < 11 && score2 < 11) {
      return NextResponse.json(
        { error: 'A team must score at least 11 points to win' },
        { status: 400 }
      );
    }

    // In pickleball, a team must win by 2 points
    if (Math.abs(score1 - score2) < 2) {
      return NextResponse.json(
        { error: 'A team must win by at least 2 points' },
        { status: 400 }
      );
    }

    // Maximum score limit (optional, but good to have)
    const MAX_SCORE = 30; // Adjust based on your rules
    if (score1 > MAX_SCORE || score2 > MAX_SCORE) {
      return NextResponse.json(
        { error: `Scores cannot exceed ${MAX_SCORE}` },
        { status: 400 }
      );
    }

    // Check for duplicate game submission
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const gamesRef = db.collection('games');
    const recentGamesQuery = gamesRef
      .where('seasonId', '==', seasonId)
      .where('createdAt', '>', Timestamp.fromDate(fiveMinutesAgo));
    const recentGamesSnap = await recentGamesQuery.get();
    const duplicateGame = recentGamesSnap.docs.find(doc => {
      const game = doc.data();
      return (
        game.team1.players.sort().join(',') === team1.players.sort().join(',') &&
        game.team2.players.sort().join(',') === team2.players.sort().join(',') &&
        game.team1.score === team1.score &&
        game.team2.score === team2.score
      );
    });
    if (duplicateGame) {
      return NextResponse.json(
        { error: 'A game with the same teams and scores was recorded in the last 5 minutes. Please wait before submitting again.' },
        { status: 400 }
      );
    }

    // Wrap the entire game recording process in a transaction
    return await db.runTransaction(async (transaction) => {
      const rankingsRef = db.collection('rankings');
      const usersRef = db.collection('users');
      // Get all ranking and user docs for all players (reads first)
      const allPlayerIds = [...team1.players, ...team2.players];
      const rankingDocs = await Promise.all(
        allPlayerIds.map((playerId) => transaction.get(rankingsRef.doc(`${seasonId}_${playerId}`)))
      );
      const userDocs = await Promise.all(
        allPlayerIds.map((playerId) => transaction.get(usersRef.doc(playerId)))
      );
      // Initialize rankings for any players that don't have them yet (writes)
      for (const [index, rankingDoc] of rankingDocs.entries()) {
        if (!rankingDoc.exists) {
          const playerId = allPlayerIds[index];
          transaction.set(rankingsRef.doc(`${seasonId}_${playerId}`), {
            seasonId,
            userId: playerId,
            currentElo: 1500,
            wins: 0,
            losses: 0,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
          });
        }
      }
      // Calculate average ELO for each team
      const team1Elo = rankingDocs.slice(0, 2).reduce((sum, doc) => {
        const data = doc.data();
        return sum + (data?.currentElo || 1500);
      }, 0) / 2;
      const team2Elo = rankingDocs.slice(2).reduce((sum, doc) => {
        const data = doc.data();
        return sum + (data?.currentElo || 1500);
      }, 0) / 2;
      // Determine winner and calculate ELO changes
      const team1Won = team1.score > team2.score;
      const scoreDiff = Math.abs(team1.score - team2.score);
      const eloChange = Math.abs(calculateEloChange(team1Elo, team2Elo, team1Won, scoreDiff));
      // Calculate streak bonuses for each player
      const team1StreakBonuses: Record<string, number> = {};
      const team2StreakBonuses: Record<string, number> = {};
      // Get user data to include who recorded the game (fetch directly, not from players)
      const recorderDoc = await db.collection('users').doc(userId).get();
      const userData = recorderDoc.data();
      // Record the game
      const gameRef = gamesRef.doc();
      transaction.set(gameRef, {
        seasonId,
        team1: {
          players: team1.players,
          score: team1.score,
          elo: team1Elo,
          streakBonuses: team1StreakBonuses,
        },
        team2: {
          players: team2.players,
          score: team2.score,
          elo: team2Elo,
          streakBonuses: team2StreakBonuses,
        },
        eloChange,
        createdAt: Timestamp.now(),
        recordedBy: {
          id: userId,
          name: (userData?.firstName && userData?.lastName)
            ? `${userData.firstName} ${userData.lastName}`
            : userData?.displayName || 'Unknown User',
        },
        gameTime: Timestamp.now(),
      });
      // Update player rankings and stats (writes only)
      for (let i = 0; i < team1.players.length; i++) {
        const playerId = team1.players[i];
        const rankingRef = rankingsRef.doc(`${seasonId}_${playerId}`);
        const userRef = usersRef.doc(playerId);
        const rankingDoc = rankingDocs[i];
        const userDoc = userDocs[i];
        const rankingData = rankingDoc.data() || { currentElo: 1500, wins: 0, losses: 0 };
        const userData = userDoc.data() || {};
        const seasonStats = userData.seasonStats?.[seasonId] || {
          eloRating: 1500,
          gamesPlayed: 0,
          wins: 0,
          losses: 0,
          highestElo: 1500,
          lowestElo: 1500,
          winStreak: 0,
          currentStreak: 0,
        };
        let streakBonus = 0;
        const won = team1Won;
        if (won && seasonStats.currentStreak >= 3) {
          streakBonus = getStreakBonus(seasonStats.currentStreak);
        }
        if (won) team1StreakBonuses[playerId] = streakBonus;
        const newElo = Math.max(0, rankingData.currentElo + (team1Won ? eloChange + streakBonus : -eloChange));
        transaction.update(rankingRef, {
          currentElo: newElo,
          wins: (rankingData.wins || 0) + (won ? 1 : 0),
          losses: (rankingData.losses || 0) + (won ? 0 : 1),
          updatedAt: Timestamp.now(),
        });
        transaction.update(userRef, {
          [`seasonStats.${seasonId}`]: {
            eloRating: newElo,
            gamesPlayed: seasonStats.gamesPlayed + 1,
            wins: seasonStats.wins + (won ? 1 : 0),
            losses: seasonStats.losses + (won ? 0 : 1),
            highestElo: Math.max(seasonStats.highestElo, newElo),
            lowestElo: Math.min(seasonStats.lowestElo, newElo),
            winStreak: won ? seasonStats.winStreak + 1 : 0,
            currentStreak: won ? seasonStats.currentStreak + 1 : 0,
          },
          elo: newElo,
        });
      }
      for (let i = 0; i < team2.players.length; i++) {
        const playerId = team2.players[i];
        const rankingRef = rankingsRef.doc(`${seasonId}_${playerId}`);
        const userRef = usersRef.doc(playerId);
        const rankingDoc = rankingDocs[i + 2];
        const userDoc = userDocs[i + 2];
        const rankingData = rankingDoc.data() || { currentElo: 1500, wins: 0, losses: 0 };
        const userData = userDoc.data() || {};
        const seasonStats = userData.seasonStats?.[seasonId] || {
          eloRating: 1500,
          gamesPlayed: 0,
          wins: 0,
          losses: 0,
          highestElo: 1500,
          lowestElo: 1500,
          winStreak: 0,
          currentStreak: 0,
        };
        let streakBonus = 0;
        const won = !team1Won;
        if (won && seasonStats.currentStreak >= 3) {
          streakBonus = getStreakBonus(seasonStats.currentStreak);
        }
        if (won) team2StreakBonuses[playerId] = streakBonus;
        const newElo = Math.max(0, rankingData.currentElo + (team1Won ? -eloChange : eloChange + streakBonus));
        transaction.update(rankingRef, {
          currentElo: newElo,
          wins: (rankingData.wins || 0) + (won ? 1 : 0),
          losses: (rankingData.losses || 0) + (won ? 0 : 1),
          updatedAt: Timestamp.now(),
        });
        transaction.update(userRef, {
          [`seasonStats.${seasonId}`]: {
            eloRating: newElo,
            gamesPlayed: seasonStats.gamesPlayed + 1,
            wins: seasonStats.wins + (won ? 1 : 0),
            losses: seasonStats.losses + (won ? 0 : 1),
            highestElo: Math.max(seasonStats.highestElo, newElo),
            lowestElo: Math.min(seasonStats.lowestElo, newElo),
            winStreak: won ? seasonStats.winStreak + 1 : 0,
            currentStreak: won ? seasonStats.currentStreak + 1 : 0,
          },
          elo: newElo,
        });
      }
      return NextResponse.json({ success: true, gameId: gameRef.id });
    });
  } catch (error) {
    console.error('Error recording game:', error);
    return NextResponse.json(
      { error: 'Failed to record game. Please try again.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: { params: { gameId: string } }) {
  if (!(await isAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  const { gameId } = params;
  try {
    // Get the game to delete
    const gameDoc = await db.collection('games').doc(gameId).get();
    if (!gameDoc.exists) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }
    const game = gameDoc.data();
    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }
    const seasonId = game.seasonId;
    // Delete the game
    await gameDoc.ref.delete();
    // Recalculate ELO for the season
    await recalculateSeasonElo(seasonId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting game:', error);
    return NextResponse.json({ error: 'Failed to delete game' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { gameId: string } }) {
  if (!(await isAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  const { gameId } = params;
  try {
    const updateData = await request.json();
    // Update the game
    await db.collection('games').doc(gameId).update(updateData);
    // Get the updated game to find seasonId
    const gameDoc = await db.collection('games').doc(gameId).get();
    const game = gameDoc.data();
    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }
    const seasonId = game.seasonId;
    // Recalculate ELO for the season
    await recalculateSeasonElo(seasonId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error editing game:', error);
    return NextResponse.json({ error: 'Failed to edit game' }, { status: 500 });
  }
}

// Helper: Recalculate all ELO and stats for a season
async function recalculateSeasonElo(seasonId: string) {
  console.log(`🔄 Starting ELO recalculation for season: ${seasonId}`);
  
  // Get all games for the season, sorted by gameTime (CRITICAL: chronological order)
  const gamesSnap = await db.collection('games')
    .where('seasonId', '==', seasonId)
    .orderBy('gameTime', 'asc')  // Sort by when games were actually played, not when created/edited
    .get();
    
  console.log(`📊 Found ${gamesSnap.docs.length} games to replay chronologically`);
    
  type GameDoc = {
    id: string;
    team1: { players: string[]; score: number };
    team2: { players: string[]; score: number };
    gameTime: any;
  };
  const games: GameDoc[] = gamesSnap.docs
    .map(doc => ({ id: doc.id, ...doc.data() }) as Partial<GameDoc>)
    .filter((g): g is GameDoc => !!g && typeof g.team1 === 'object' && typeof g.team2 === 'object' && Array.isArray(g.team1.players) && Array.isArray(g.team2.players));
    
  console.log(`✅ ${games.length} valid games will be replayed in chronological order`);
    
  // Get all player IDs
  const playerIds = new Set<string>();
  games.forEach(game => {
    game.team1.players.forEach((p: string) => playerIds.add(p));
    game.team2.players.forEach((p: string) => playerIds.add(p));
  });
  
  console.log(`👥 Found ${playerIds.size} unique players`);
  
  // Reset all rankings for the season
  const rankingsRef = db.collection('rankings');
  const usersRef = db.collection('users');
  const BASE_ELO = 1500;
  
  // Use batch operations for better performance
  const batch = db.batch();
  
  for (const playerId of playerIds) {
    const rankingRef = rankingsRef.doc(`${seasonId}_${playerId}`);
    
    batch.set(rankingRef, {
      seasonId,
      userId: playerId,
      currentElo: BASE_ELO,
      wins: 0,
      losses: 0,
      updatedAt: new Date(),
    });
  }
  
  await batch.commit();
  console.log(`🔄 Reset all players to base ELO (${BASE_ELO}). Now replaying games...`);
  
  // Track ELOs in memory for efficiency
  const playerElo: Record<string, number> = {};
  const playerStats: Record<string, { wins: number; losses: number }> = {};
  
  for (const playerId of playerIds) {
    playerElo[playerId] = BASE_ELO;
    playerStats[playerId] = { wins: 0, losses: 0 };
  }
  
  // Replay all games to recalculate ELO in chronological order
  for (let gameIndex = 0; gameIndex < games.length; gameIndex++) {
    const game = games[gameIndex];
    if (!game || !game.team1 || !game.team2 || !Array.isArray(game.team1.players) || !Array.isArray(game.team2.players)) continue;
    
    const gameDate = new Date(game.gameTime?.toDate?.() || game.gameTime).toLocaleDateString();
    console.log(`🎮 Replaying game ${gameIndex + 1}/${games.length} (${gameDate}): ${game.team1.score}-${game.team2.score}`);
    
    // Get current ELOs from memory
    const team1Elo = game.team1.players.reduce((sum: number, pid: string) => sum + (playerElo[pid] || BASE_ELO), 0) / 2;
    const team2Elo = game.team2.players.reduce((sum: number, pid: string) => sum + (playerElo[pid] || BASE_ELO), 0) / 2;
    const team1Won = game.team1.score > game.team2.score;
    const scoreDiff = Math.abs(game.team1.score - game.team2.score);
    const eloChange = Math.abs(calculateEloChange(team1Elo, team2Elo, team1Won, scoreDiff));
    
    // Update team1 in memory
    for (const pid of game.team1.players) {
      const oldElo = playerElo[pid];
      playerElo[pid] = Math.max(0, playerElo[pid] + (team1Won ? eloChange : -eloChange));
      
      if (team1Won) {
        playerStats[pid].wins++;
      } else {
        playerStats[pid].losses++;
      }
      
      console.log(`  👤 Team1 ${pid}: ${oldElo} → ${playerElo[pid]} (${team1Won ? '+' : '-'}${eloChange})`);
    }
    
    // Update team2 in memory
    for (const pid of game.team2.players) {
      const oldElo = playerElo[pid];
      playerElo[pid] = Math.max(0, playerElo[pid] + (team1Won ? -eloChange : eloChange));
      
      if (!team1Won) {
        playerStats[pid].wins++;
      } else {
        playerStats[pid].losses++;
      }
      
      console.log(`  👤 Team2 ${pid}: ${oldElo} → ${playerElo[pid]} (${!team1Won ? '+' : '-'}${eloChange})`);
    }
  }
  
  console.log(`💾 Saving final stats to database...`);
  
  // Save final results using batch operations
  const finalBatch = db.batch();
  
  for (const playerId of playerIds) {
    const rankingRef = rankingsRef.doc(`${seasonId}_${playerId}`);
    const stats = playerStats[playerId];
    
    finalBatch.update(rankingRef, {
      currentElo: playerElo[playerId],
      wins: stats.wins,
      losses: stats.losses,
      updatedAt: new Date(),
    });
    
    console.log(`  📊 ${playerId}: Final ELO ${playerElo[playerId]} (${stats.wins}W-${stats.losses}L)`);
  }
  
  await finalBatch.commit();
  console.log(`✅ ELO recalculation complete for season ${seasonId}`);
} 