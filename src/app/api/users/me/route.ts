export const runtime = "nodejs";
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { adminAuth, db } from '@/lib/firebase-admin';

export async function GET(request: Request) {
  try {
    const authToken = request.headers.get('cookie')?.split('auth-token=')[1]?.split(';')[0];

    if (!authToken) {
      return NextResponse.json(
        { error: 'No auth token provided' },
        { status: 401 }
      );
    }

    const decodedToken = await adminAuth.verifyIdToken(authToken);
    const userId = decodedToken.uid;

    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    return NextResponse.json(userData);
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch user data' },
      { status: 500 }
    );
  }
} 