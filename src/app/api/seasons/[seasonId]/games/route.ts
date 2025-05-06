import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';

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
    const games = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        gameTime: data.gameTime?.toDate?.()?.toISOString() || data.gameTime
      };
    });

    return NextResponse.json(games || []);
  } catch (error) {
    console.error('Error fetching games:', error);
    return NextResponse.json([], { status: 200 });
  }
} 