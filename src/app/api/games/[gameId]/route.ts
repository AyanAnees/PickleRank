export const runtime = "nodejs";
import { NextResponse } from 'next/server';
import { db, adminAuth } from '@/lib/firebase-admin';
import { calculateEloChange, getStreakBonus } from '@/lib/elo';

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
    
    // Validate the update data
    if (updateData.team1?.score !== undefined && updateData.team2?.score !== undefined) {
      const score1 = updateData.team1.score;
      const score2 = updateData.team2.score;
      
      if (!Number.isInteger(score1) || !Number.isInteger(score2)) {
        return NextResponse.json({ error: 'Scores must be integers' }, { status: 400 });
      }
      
      if (score1 < 0 || score2 < 0) {
        return NextResponse.json({ error: 'Scores must be non-negative' }, { status: 400 });
      }
      
      if (score1 < 11 && score2 < 11) {
        return NextResponse.json({ error: 'At least one team must score 11 points' }, { status: 400 });
      }
      
      if (Math.abs(score1 - score2) < 2) {
        return NextResponse.json({ error: 'Winner must win by at least 2 points' }, { status: 400 });
      }
    }
    
    // Update the game
    await db.collection('games').doc(gameId).update({
      ...updateData,
      updatedAt: new Date()
    });
    
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
  
  // Validate season exists
  const seasonDoc = await db.collection('seasons').doc(seasonId).get();
  if (!seasonDoc.exists) {
    throw new Error('Season does not exist');
  }

  // Get all games for the season, sorted by gameTime (CRITICAL: not by createdAt or updatedAt)
  const gamesSnap = await db.collection('games')
    .where('seasonId', '==', seasonId)
    .orderBy('gameTime', 'asc')  // This ensures chronological order of when games were actually played
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
    .filter((g): g is GameDoc => {
      if (!g || !g.team1 || !g.team2) return false;
      if (!Array.isArray(g.team1.players) || !Array.isArray(g.team2.players)) return false;
      if (g.team1.players.length !== 2 || g.team2.players.length !== 2) return false;
      if (typeof g.team1.score !== 'number' || typeof g.team2.score !== 'number') return false;
      if (g.team1.score < 0 || g.team2.score < 0) return false;
      if (Math.abs(g.team1.score - g.team2.score) < 2) return false;
      if (g.team1.score < 11 && g.team2.score < 11) return false;
      return true;
    });

  console.log(`✅ ${games.length} valid games will be replayed in chronological order`);

  // Get all player IDs and validate they exist
  const playerIds = new Set<string>();
  games.forEach(game => {
    game.team1.players.forEach(p => playerIds.add(p));
    game.team2.players.forEach(p => playerIds.add(p));
  });

  console.log(`👥 Found ${playerIds.size} unique players`);

  // Validate all players exist
  const playerDocs = await Promise.all(
    Array.from(playerIds).map(playerId => db.collection('users').doc(playerId).get())
  );
  
  const invalidPlayers = playerDocs.filter(doc => !doc.exists);
  if (invalidPlayers.length > 0) {
    throw new Error('One or more players do not exist');
  }

  // Initialize player stats and ELOs
  const playerStats: Record<string, { 
    currentStreak: number; 
    wins: number; 
    losses: number;
    gamesPlayed: number;
    highestElo: number;
    lowestElo: number;
  }> = {};
  const playerElo: Record<string, number> = {};
  const BASE_ELO = 1500;
  
  for (const playerId of playerIds) {
    playerStats[playerId] = { 
      currentStreak: 0, 
      wins: 0, 
      losses: 0,
      gamesPlayed: 0,
      highestElo: BASE_ELO,
      lowestElo: BASE_ELO
    };
    playerElo[playerId] = BASE_ELO;
  }

  console.log(`🔄 Resetting all players to base ELO (${BASE_ELO})`);

  // Reset all rankings for the season
  const rankingsRef = db.collection('rankings');
  const usersRef = db.collection('users');
  
  // Use batch operations for better performance
  const batch = db.batch();
  
  for (const playerId of playerIds) {
    const rankingRef = rankingsRef.doc(`${seasonId}_${playerId}`);
    const userRef = usersRef.doc(playerId);
    
    batch.set(rankingRef, {
      seasonId,
      userId: playerId,
      currentElo: BASE_ELO,
      wins: 0,
      losses: 0,
      updatedAt: new Date(),
    });

    batch.update(userRef, {
      [`seasonStats.${seasonId}`]: {
        eloRating: BASE_ELO,
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        highestElo: BASE_ELO,
        lowestElo: BASE_ELO,
        winStreak: 0,
        currentStreak: 0,
      }
    });
  }
  
  await batch.commit();
  console.log(`✅ Reset complete. Now replaying games chronologically...`);

  // Replay all games to recalculate ELO in the correct chronological order
  for (let gameIndex = 0; gameIndex < games.length; gameIndex++) {
    const game = games[gameIndex];
    const gameDate = new Date(game.gameTime?.toDate?.() || game.gameTime).toLocaleDateString();
    
    console.log(`🎮 Replaying game ${gameIndex + 1}/${games.length} (${gameDate}): ${game.team1.score}-${game.team2.score}`);
    
    const team1 = game.team1.players;
    const team2 = game.team2.players;
    const team1Elo = team1.reduce((sum, id) => sum + (playerElo[id] || BASE_ELO), 0) / 2;
    const team2Elo = team2.reduce((sum, id) => sum + (playerElo[id] || BASE_ELO), 0) / 2;
    const team1Won = game.team1.score > game.team2.score;
    const scoreDiff = Math.abs(game.team1.score - game.team2.score);
    const eloChange = Math.abs(calculateEloChange(team1Elo, team2Elo, team1Won, scoreDiff));
    
    // Update team1 players
    for (const id of team1) {
      let streakBonus = 0;
      if (team1Won) {
        playerStats[id].currentStreak = (playerStats[id].currentStreak || 0) + 1;
        if (playerStats[id].currentStreak >= 3) {
          streakBonus = getStreakBonus(playerStats[id].currentStreak);
        }
        playerStats[id].wins++;
      } else {
        playerStats[id].currentStreak = 0;
        playerStats[id].losses++;
      }
      
      playerStats[id].gamesPlayed++;
      const oldElo = playerElo[id];
      playerElo[id] = Math.max(0, playerElo[id] + (team1Won ? eloChange + streakBonus : -eloChange));
      
      // Track highest/lowest
      playerStats[id].highestElo = Math.max(playerStats[id].highestElo, playerElo[id]);
      playerStats[id].lowestElo = Math.min(playerStats[id].lowestElo, playerElo[id]);
      
      console.log(`  👤 ${id}: ${oldElo} → ${playerElo[id]} (${team1Won ? '+' : '-'}${eloChange}${streakBonus > 0 ? ` +${streakBonus} streak` : ''})`);
    }

    // Update team2 players
    for (const id of team2) {
      let streakBonus = 0;
      if (!team1Won) {
        playerStats[id].currentStreak = (playerStats[id].currentStreak || 0) + 1;
        if (playerStats[id].currentStreak >= 3) {
          streakBonus = getStreakBonus(playerStats[id].currentStreak);
        }
        playerStats[id].wins++;
      } else {
        playerStats[id].currentStreak = 0;
        playerStats[id].losses++;
      }
      
      playerStats[id].gamesPlayed++;
      const oldElo = playerElo[id];
      playerElo[id] = Math.max(0, playerElo[id] + (team1Won ? -eloChange : eloChange + streakBonus));
      
      // Track highest/lowest
      playerStats[id].highestElo = Math.max(playerStats[id].highestElo, playerElo[id]);
      playerStats[id].lowestElo = Math.min(playerStats[id].lowestElo, playerElo[id]);
      
      console.log(`  👤 ${id}: ${oldElo} → ${playerElo[id]} (${!team1Won ? '+' : '-'}${eloChange}${streakBonus > 0 ? ` +${streakBonus} streak` : ''})`);
    }
  }

  console.log(`💾 Saving final stats to database...`);

  // Save final results using batch operations
  const finalBatch = db.batch();
  
  for (const playerId of playerIds) {
    const rankingRef = rankingsRef.doc(`${seasonId}_${playerId}`);
    const userRef = usersRef.doc(playerId);
    const stats = playerStats[playerId];
    
    finalBatch.update(rankingRef, {
      currentElo: playerElo[playerId],
      wins: stats.wins,
      losses: stats.losses,
      updatedAt: new Date(),
    });

    finalBatch.update(userRef, {
      [`seasonStats.${seasonId}`]: {
        eloRating: playerElo[playerId],
        gamesPlayed: stats.gamesPlayed,
        wins: stats.wins,
        losses: stats.losses,
        highestElo: stats.highestElo,
        lowestElo: stats.lowestElo,
        winStreak: stats.currentStreak > 0 ? stats.currentStreak : 0,
        currentStreak: stats.currentStreak,
      },
      elo: playerElo[playerId], // Update main ELO field
    });
    
    console.log(`  📊 ${playerId}: Final ELO ${playerElo[playerId]} (${stats.wins}W-${stats.losses}L, ${stats.gamesPlayed} games)`);
  }
  
  await finalBatch.commit();
  console.log(`✅ ELO recalculation complete for season ${seasonId}`);
} 