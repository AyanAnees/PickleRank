import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDoc, doc, updateDoc, Timestamp, query, where, getDocs, setDoc } from 'firebase/firestore';
import { calculateEloChange } from '@/lib/elo';
import { auth } from '@/lib/firebase';

interface Team {
  players: string[];
  score: number;
}

export async function POST(request: Request) {
  try {
    const { seasonId, team1, team2 } = await request.json() as {
      seasonId: string;
      team1: Team;
      team2: Team;
    };

    // Get the current user
    const user = auth.currentUser;
    if (!user) {
      return NextResponse.json(
        { error: 'User must be authenticated to record a game' },
        { status: 401 }
      );
    }

    // Validate input
    if (!seasonId || !team1 || !team2) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check for duplicate game submission (same teams and scores within last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const gamesRef = collection(db, 'games');
    const recentGamesQuery = query(
      gamesRef,
      where('seasonId', '==', seasonId),
      where('createdAt', '>', Timestamp.fromDate(fiveMinutesAgo))
    );
    
    const recentGames = await getDocs(recentGamesQuery);
    const duplicateGame = recentGames.docs.find(doc => {
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
    const rankingsRef = collection(db, 'rankings');
    const rankings = await Promise.all([
      ...team1.players.map((playerId: string) => getDoc(doc(rankingsRef, `${seasonId}_${playerId}`))),
      ...team2.players.map((playerId: string) => getDoc(doc(rankingsRef, `${seasonId}_${playerId}`)))
    ]);

    // Initialize rankings for any players that don't have them yet
    const initPromises = rankings.map(async (rankingDoc, index) => {
      if (!rankingDoc.exists()) {
        const playerId = [...team1.players, ...team2.players][index];
        const rankingRef = doc(rankingsRef, `${seasonId}_${playerId}`);
        await setDoc(rankingRef, {
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
    const team1Elo = rankings.slice(0, 2).reduce((sum, doc) => {
      const data = doc.data();
      return sum + (data?.currentElo || 1500);
    }, 0) / 2;

    const team2Elo = rankings.slice(2).reduce((sum, doc) => {
      const data = doc.data();
      return sum + (data?.currentElo || 1500);
    }, 0) / 2;

    // Determine winner and calculate ELO changes
    const team1Won = team1.score > team2.score;
    const eloChange = calculateEloChange(team1Elo, team2Elo, team1Won);

    // Get user data to include who recorded the game
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    const userData = userDoc.data();

    // Record the game with timestamp and recorded by info
    const gameDoc = await addDoc(gamesRef, {
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
        id: user.uid,
        name: userData?.displayName || 'Unknown User',
      },
      gameTime: Timestamp.now(), // This will be used for sorting and rematch detection
    });

    // Update player rankings
    const updatePromises = [
      ...team1.players.map((playerId: string) => {
        const rankingRef = doc(rankingsRef, `${seasonId}_${playerId}`);
        const ranking = rankings.find(doc => doc.id === `${seasonId}_${playerId}`);
        const data = ranking?.data() || { currentElo: 1500, wins: 0, losses: 0 };
        
        return updateDoc(rankingRef, {
          currentElo: data.currentElo + (team1Won ? eloChange : -eloChange),
          wins: (data.wins || 0) + (team1Won ? 1 : 0),
          losses: (data.losses || 0) + (team1Won ? 0 : 1),
          updatedAt: Timestamp.now(),
        });
      }),
      ...team2.players.map((playerId: string) => {
        const rankingRef = doc(rankingsRef, `${seasonId}_${playerId}`);
        const ranking = rankings.find(doc => doc.id === `${seasonId}_${playerId}`);
        const data = ranking?.data() || { currentElo: 1500, wins: 0, losses: 0 };
        
        return updateDoc(rankingRef, {
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