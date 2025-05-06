import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';

export async function GET(
  request: Request,
  { params }: { params: { seasonId: string } }
) {
  try {
    const { seasonId } = params;

    // Query games for this season
    const gamesRef = collection(db, 'games');
    const q = query(
      gamesRef,
      where('seasonId', '==', seasonId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    const games = await Promise.all(snapshot.docs.map(async (gameDoc) => {
      const data = gameDoc.data();
      
      // Get player information for both teams
      const team1Players = await Promise.all(
        data.team1.players.map(async (playerId: string) => {
          const playerDoc = await getDoc(doc(db, 'users', playerId));
          return playerDoc.exists() ? playerDoc.data() : { displayName: 'Unknown Player' };
        })
      );

      const team2Players = await Promise.all(
        data.team2.players.map(async (playerId: string) => {
          const playerDoc = await getDoc(doc(db, 'users', playerId));
          return playerDoc.exists() ? playerDoc.data() : { displayName: 'Unknown Player' };
        })
      );

      return {
        id: gameDoc.id,
        ...data,
        team1: {
          ...data.team1,
          players: team1Players
        },
        team2: {
          ...data.team2,
          players: team2Players
        },
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        gameTime: data.gameTime?.toDate?.()?.toISOString() || data.gameTime
      };
    }));

    return NextResponse.json(games || []);
  } catch (error) {
    console.error('Error fetching games:', error);
    return NextResponse.json([], { status: 200 });
  }
} 