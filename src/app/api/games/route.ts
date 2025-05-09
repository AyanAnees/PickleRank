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
      userId: string; // Pass userId from client (or use session in real app)
    };

    // Validate input
    if (!seasonId || !team1 || !team2 || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check for duplicate game submission (same teams and scores within last 5 minutes)
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

    // Get current rankings for all players
    const rankingsRef = db.collection('rankings');
    const rankingDocs = await Promise.all([
      ...team1.players.map((playerId: string) => rankingsRef.doc(`${seasonId}_${playerId}`).get()),
      ...team2.players.map((playerId: string) => rankingsRef.doc(`${seasonId}_${playerId}`).get())
    ]);

    // Initialize rankings for any players that don't have them yet
    const initPromises = rankingDocs.map(async (rankingDoc, index) => {
      if (!rankingDoc.exists) {
        const playerId = [...team1.players, ...team2.players][index];
        await rankingsRef.doc(`${seasonId}_${playerId}`).set({
          seasonId,
          userId: playerId,
          currentElo: 1500,
          wins: 0,
          losses: 0,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
      }
    });
    await Promise.all(initPromises);

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
    const eloChange = calculateEloChange(team1Elo, team2Elo, team1Won);

    // Get user data to include who recorded the game
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();

    // Record the game with timestamp and recorded by info
    const gameDoc = await gamesRef.add({
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

    // Update player rankings
    const updatePromises = [
      ...team1.players.map((playerId: string) => {
        const rankingRef = rankingsRef.doc(`${seasonId}_${playerId}`);
        const ranking = rankingDocs.find(doc => doc.id === `${seasonId}_${playerId}`);
        const data = ranking?.data() || { currentElo: 1500, wins: 0, losses: 0 };
        return rankingRef.update({
          currentElo: data.currentElo + (team1Won ? eloChange : -eloChange),
          wins: (data.wins || 0) + (team1Won ? 1 : 0),
          losses: (data.losses || 0) + (team1Won ? 0 : 1),
          updatedAt: Timestamp.now(),
        });
      }),
      ...team2.players.map((playerId: string) => {
        const rankingRef = rankingsRef.doc(`${seasonId}_${playerId}`);
        const ranking = rankingDocs.find(doc => doc.id === `${seasonId}_${playerId}`);
        const data = ranking?.data() || { currentElo: 1500, wins: 0, losses: 0 };
        return rankingRef.update({
          currentElo: data.currentElo + (team1Won ? -eloChange : eloChange),
          wins: (data.wins || 0) + (team1Won ? 0 : 1),
          losses: (data.losses || 0) + (team1Won ? 1 : 0),
          updatedAt: Timestamp.now(),
        });
      }),
    ];
    await Promise.all(updatePromises);

    return NextResponse.json({ success: true, gameId: gameDoc.id });
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
    const eloChange = calculateEloChange(team1Elo, team2Elo, team1Won);
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