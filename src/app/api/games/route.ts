export const runtime = "nodejs";
import { NextResponse } from 'next/server';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { adminAuth, db } from '@/lib/firebase-admin';
import { calculateEloChange } from '@/lib/elo';

interface Team {
  players: string[];
  score: number;
}

const ADMIN_PHONE = '+15856831831';

async function isAdmin(request: Request) {
  // Get user from auth token (assume phoneNumber is available in user record)
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return false;
  const idToken = authHeader.replace('Bearer ', '');
  try {
    const { getAuth } = await import('firebase-admin/auth');
    const decoded = await getAuth().verifyIdToken(idToken);
    return decoded.phone_number === ADMIN_PHONE;
  } catch {
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
      // Get current rankings for all players
      const rankingsRef = db.collection('rankings');
      const rankingDocs = await Promise.all([
        ...team1.players.map((playerId: string) => rankingsRef.doc(`${seasonId}_${playerId}`).get()),
        ...team2.players.map((playerId: string) => rankingsRef.doc(`${seasonId}_${playerId}`).get())
      ]);

      // Initialize rankings for any players that don't have them yet
      for (const [index, rankingDoc] of rankingDocs.entries()) {
        if (!rankingDoc.exists) {
          const playerId = [...team1.players, ...team2.players][index];
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

      // Get user data to include who recorded the game
      const userDoc = await transaction.get(db.collection('users').doc(userId));
      const userData = userDoc.data();

      // Record the game
      const gameRef = gamesRef.doc();
      transaction.set(gameRef, {
        seasonId,
        team1: {
          players: team1.players,
          score: team1.score,
          elo: team1Elo,
        },
        team2: {
          players: team2.players,
          score: team2.score,
          elo: team2Elo,
        },
        eloChange,
        createdAt: Timestamp.now(),
        recordedBy: {
          id: userId,
          name: userData?.displayName || 'Unknown User',
        },
        gameTime: Timestamp.now(),
      });

      // Update player rankings and stats
      for (const [index, playerId] of team1.players.entries()) {
        const rankingRef = rankingsRef.doc(`${seasonId}_${playerId}`);
        const userRef = db.collection('users').doc(playerId);
        
        const rankingDoc = await transaction.get(rankingRef);
        const userDoc = await transaction.get(userRef);
        
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

        const newElo = Math.max(0, rankingData.currentElo + (team1Won ? eloChange : -eloChange));
        const won = team1Won;

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
          }
        });
      }

      for (const [index, playerId] of team2.players.entries()) {
        const rankingRef = rankingsRef.doc(`${seasonId}_${playerId}`);
        const userRef = db.collection('users').doc(playerId);
        
        const rankingDoc = await transaction.get(rankingRef);
        const userDoc = await transaction.get(userRef);
        
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

        const newElo = Math.max(0, rankingData.currentElo + (team1Won ? -eloChange : eloChange));
        const won = !team1Won;

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
          }
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
    .filter((g): g is GameDoc => !!g && typeof g.team1 === 'object' && typeof g.team2 === 'object' && Array.isArray(g.team1.players) && Array.isArray(g.team2.players));
  // Get all player IDs
  const playerIds = new Set<string>();
  games.forEach(game => {
    game.team1.players.forEach((p: string) => playerIds.add(p));
    game.team2.players.forEach((p: string) => playerIds.add(p));
  });
  // Reset all rankings for the season
  const rankingsRef = db.collection('rankings');
  for (const playerId of playerIds) {
    await rankingsRef.doc(`${seasonId}_${playerId}`).set({
      seasonId,
      userId: playerId,
      currentElo: 1500,
      wins: 0,
      losses: 0,
      updatedAt: new Date(),
    });
  }
  // Replay all games to recalculate ELO
  for (const game of games) {
    if (!game || !game.team1 || !game.team2 || !Array.isArray(game.team1.players) || !Array.isArray(game.team2.players)) continue;
    // Get current ELOs
    const team1Docs = await Promise.all(game.team1.players.map((pid: string) => rankingsRef.doc(`${seasonId}_${pid}`).get()));
    const team2Docs = await Promise.all(game.team2.players.map((pid: string) => rankingsRef.doc(`${seasonId}_${pid}`).get()));
    const team1Elo = team1Docs.reduce((sum: number, doc) => sum + (doc.data()?.currentElo || 1500), 0) / 2;
    const team2Elo = team2Docs.reduce((sum: number, doc) => sum + (doc.data()?.currentElo || 1500), 0) / 2;
    const team1Won = game.team1.score > game.team2.score;
    const scoreDiff = Math.abs(game.team1.score - game.team2.score);
    const eloChange = Math.abs(calculateEloChange(team1Elo, team2Elo, team1Won, scoreDiff));
    // Update team1
    for (const doc of team1Docs) {
      const data = doc.data() || { currentElo: 1500, wins: 0, losses: 0 };
      await doc.ref.update({
        currentElo: data.currentElo + (team1Won ? eloChange : -eloChange),
        wins: (data.wins || 0) + (team1Won ? 1 : 0),
        losses: (data.losses || 0) + (team1Won ? 0 : 1),
        updatedAt: new Date(),
      });
    }
    // Update team2
    for (const doc of team2Docs) {
      const data = doc.data() || { currentElo: 1500, wins: 0, losses: 0 };
      await doc.ref.update({
        currentElo: data.currentElo + (team1Won ? -eloChange : eloChange),
        wins: (data.wins || 0) + (team1Won ? 0 : 1),
        losses: (data.losses || 0) + (team1Won ? 1 : 0),
        updatedAt: new Date(),
      });
    }
  }
} 