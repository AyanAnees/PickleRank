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
  // Validate season exists
  const seasonDoc = await db.collection('seasons').doc(seasonId).get();
  if (!seasonDoc.exists) {
    throw new Error('Season does not exist');
  }

  // Get all games for the season, sorted by gameTime
  const gamesSnap = await db.collection('games')
    .where('seasonId', '==', seasonId)
    .orderBy('gameTime', 'asc')
    .get();

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

  // Get all player IDs and validate they exist
  const playerIds = new Set<string>();
  games.forEach(game => {
    game.team1.players.forEach(p => playerIds.add(p));
    game.team2.players.forEach(p => playerIds.add(p));
  });

  // Validate all players exist
  const playerDocs = await Promise.all(
    Array.from(playerIds).map(playerId => db.collection('users').doc(playerId).get())
  );
  
  const invalidPlayers = playerDocs.filter(doc => !doc.exists);
  if (invalidPlayers.length > 0) {
    throw new Error('One or more players do not exist');
  }

  // Initialize player stats and ELOs
  const playerStats: Record<string, { currentStreak: number }> = {};
  const playerElo: Record<string, number> = {};
  const BASE_ELO = 1500;
  
  for (const playerId of playerIds) {
    playerStats[playerId] = { currentStreak: 0 };
    playerElo[playerId] = BASE_ELO;
  }

  // Reset all rankings for the season using a transaction
  const rankingsRef = db.collection('rankings');
  const usersRef = db.collection('users');
  
  for (const playerId of playerIds) {
    await db.runTransaction(async (transaction) => {
      const rankingRef = rankingsRef.doc(`${seasonId}_${playerId}`);
      const userRef = usersRef.doc(playerId);
      
      transaction.set(rankingRef, {
        seasonId,
        userId: playerId,
        currentElo: BASE_ELO,
        wins: 0,
        losses: 0,
        updatedAt: new Date(),
      });

      transaction.update(userRef, {
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
    });
  }

  // Replay all games to recalculate ELO
  for (const game of games) {
    const team1 = game.team1.players;
    const team2 = game.team2.players;
    const team1Elo = team1.reduce((sum, id) => sum + (playerElo[id] || BASE_ELO), 0) / 2;
    const team2Elo = team2.reduce((sum, id) => sum + (playerElo[id] || BASE_ELO), 0) / 2;
    const team1Won = game.team1.score > game.team2.score;
    const scoreDiff = Math.abs(game.team1.score - game.team2.score);
    const eloChange = Math.abs(calculateEloChange(team1Elo, team2Elo, team1Won, scoreDiff));
    
    // Update team1
    for (const id of team1) {
      let streakBonus = 0;
      if (team1Won) {
        playerStats[id].currentStreak = (playerStats[id].currentStreak || 0) + 1;
        streakBonus = getStreakBonus(playerStats[id].currentStreak);
      } else {
        playerStats[id].currentStreak = 0;
      }
      playerElo[id] = Math.max(0, playerElo[id] + (team1Won ? eloChange + streakBonus : -eloChange));
    }

    // Update team2
    for (const id of team2) {
      let streakBonus = 0;
      if (!team1Won) {
        playerStats[id].currentStreak = (playerStats[id].currentStreak || 0) + 1;
        streakBonus = getStreakBonus(playerStats[id].currentStreak);
      } else {
        playerStats[id].currentStreak = 0;
      }
      playerElo[id] = Math.max(0, playerElo[id] + (team1Won ? -eloChange : eloChange + streakBonus));
    }

    // Update rankings and user stats
    for (const id of [...team1, ...team2]) {
      const won = (team1Won && team1.includes(id)) || (!team1Won && team2.includes(id));
      await db.runTransaction(async (transaction) => {
        const rankingRef = rankingsRef.doc(`${seasonId}_${id}`);
        const userRef = usersRef.doc(id);
        
        transaction.update(rankingRef, {
          currentElo: playerElo[id],
          wins: (await rankingRef.get()).data()?.wins + (won ? 1 : 0),
          losses: (await rankingRef.get()).data()?.losses + (won ? 0 : 1),
          updatedAt: new Date(),
        });

        transaction.update(userRef, {
          [`seasonStats.${seasonId}`]: {
            eloRating: playerElo[id],
            gamesPlayed: (await userRef.get()).data()?.seasonStats?.[seasonId]?.gamesPlayed + 1,
            wins: (await userRef.get()).data()?.seasonStats?.[seasonId]?.wins + (won ? 1 : 0),
            losses: (await userRef.get()).data()?.seasonStats?.[seasonId]?.losses + (won ? 0 : 1),
            highestElo: Math.max((await userRef.get()).data()?.seasonStats?.[seasonId]?.highestElo || BASE_ELO, playerElo[id]),
            lowestElo: Math.min((await userRef.get()).data()?.seasonStats?.[seasonId]?.lowestElo || BASE_ELO, playerElo[id]),
            winStreak: won ? (await userRef.get()).data()?.seasonStats?.[seasonId]?.winStreak + 1 : 0,
            currentStreak: playerStats[id].currentStreak,
          }
        });
      });
    }
  }
} 