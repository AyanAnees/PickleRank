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
    const games = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt.toDate().toISOString(),
    }));

    return NextResponse.json(games || []);
  } catch (error) {
    console.error('Error fetching games:', error);
    return NextResponse.json([], { status: 200 });
  }
} 