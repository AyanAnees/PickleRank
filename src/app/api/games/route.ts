import { NextResponse } from 'next/server';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { adminAuth, db } from '@/lib/firebase-admin';
import { calculateEloChange } from '@/lib/elo';

interface Team {
  players: string[];
  score: number;
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
        { error: 'This game has already been recorded' },
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