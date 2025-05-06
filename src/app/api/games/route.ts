import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDoc, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { calculateEloChange } from '@/lib/elo';

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

    // Validate input
    if (!seasonId || !team1 || !team2) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get current rankings for all players
    const rankingsRef = collection(db, 'rankings');
    const rankings = await Promise.all([
      ...team1.players.map((playerId: string) => getDoc(doc(rankingsRef, `${seasonId}_${playerId}`))),
      ...team2.players.map((playerId: string) => getDoc(doc(rankingsRef, `${seasonId}_${playerId}`)))
    ]);

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

    // Record the game
    const gamesRef = collection(db, 'games');
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
    });

    // Update player rankings
    const updatePromises = [
      ...team1.players.map((playerId: string) => {
        const rankingRef = doc(rankingsRef, `${seasonId}_${playerId}`);
        const ranking = rankings.find(doc => doc.id === `${seasonId}_${playerId}`);
        const data = ranking?.data() || { currentElo: 1500, gamesPlayed: 0, wins: 0 };
        
        return updateDoc(rankingRef, {
          currentElo: data.currentElo + (team1Won ? eloChange : -eloChange),
          gamesPlayed: (data.gamesPlayed || 0) + 1,
          wins: (data.wins || 0) + (team1Won ? 1 : 0),
          winRate: ((data.wins || 0) + (team1Won ? 1 : 0)) / ((data.gamesPlayed || 0) + 1),
          updatedAt: Timestamp.now(),
        });
      }),
      ...team2.players.map((playerId: string) => {
        const rankingRef = doc(rankingsRef, `${seasonId}_${playerId}`);
        const ranking = rankings.find(doc => doc.id === `${seasonId}_${playerId}`);
        const data = ranking?.data() || { currentElo: 1500, gamesPlayed: 0, wins: 0 };
        
        return updateDoc(rankingRef, {
          currentElo: data.currentElo + (team1Won ? -eloChange : eloChange),
          gamesPlayed: (data.gamesPlayed || 0) + 1,
          wins: (data.wins || 0) + (team1Won ? 0 : 1),
          winRate: ((data.wins || 0) + (team1Won ? 0 : 1)) / ((data.gamesPlayed || 0) + 1),
          updatedAt: Timestamp.now(),
        });
      }),
    ];

    await Promise.all(updatePromises);

    return NextResponse.json({ success: true, gameId: gameDoc.id });
  } catch (error) {
    console.error('Error recording game:', error);
    return NextResponse.json(
      { error: 'Failed to record game' },
      { status: 500 }
    );
  }
} 