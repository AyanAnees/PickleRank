import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

export async function GET(
  request: Request,
  { params }: { params: { seasonId: string } }
) {
  try {
    const { seasonId } = params;

    // Query games for this season
    const gamesRef = db.collection('games');
    const q = gamesRef.where('seasonId', '==', seasonId).orderBy('createdAt', 'desc');
    const snapshot = await q.get();
    const games = await Promise.all(snapshot.docs.map(async (gameDoc) => {
      const data = gameDoc.data();
      
      // Get player information for both teams
      const team1Players = await Promise.all(
        data.team1.players
          .filter((p: any) => !!p)
          .map(async (p: any) => {
            if (typeof p === 'string') {
              const playerDoc = await db.collection('users').doc(p).get();
          return playerDoc.exists ? playerDoc.data() : { displayName: 'Unknown Player' };
            } else if (typeof p === 'object' && p.displayName) {
              return p;
            } else {
              return { displayName: 'Unknown Player' };
            }
        })
      );

      const team2Players = await Promise.all(
        data.team2.players
          .filter((p: any) => !!p)
          .map(async (p: any) => {
            if (typeof p === 'string') {
              const playerDoc = await db.collection('users').doc(p).get();
          return playerDoc.exists ? playerDoc.data() : { displayName: 'Unknown Player' };
            } else if (typeof p === 'object' && p.displayName) {
              return p;
            } else {
              return { displayName: 'Unknown Player' };
            }
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