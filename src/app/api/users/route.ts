import { NextResponse } from 'next/server';
import { db, adminAuth } from '@/lib/firebase-admin';
import { User } from '@/types';

export async function POST(request: Request) {
  try {
    // 1. Verify auth token
    const authToken = request.headers.get('cookie')?.split('auth-token=')[1]?.split(';')[0];
    if (!authToken) {
      return NextResponse.json({ error: 'No auth token provided' }, { status: 401 });
    }
    const decodedToken = await adminAuth.verifyIdToken(authToken);
    const userId = decodedToken.uid;

    // 2. Parse and validate body
    const body = await request.json();
    const { firstName, lastName, ...rest } = body;
    if (!firstName || !lastName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 3. Prepare user data
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    const now = new Date().toISOString();
    const userData = {
      id: userId,
      phoneNumber: decodedToken.phone_number || '',
      displayName: `${firstName} ${lastName}`,
      firstName,
      lastName,
      elo: 1500,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      createdAt: userDoc.exists ? userDoc.data()?.createdAt || now : now,
      updatedAt: now,
      isAdmin: false,
      seasonStats: {},
      ...rest
    };

    // 4. Create or update user
    await userRef.set(userData, { merge: true });
    return NextResponse.json(userData, { status: userDoc.exists ? 200 : 201 });
  } catch (error) {
    console.error('Error creating/updating user:', error);
    return NextResponse.json(
      { error: 'Failed to create/update user', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (userId) {
      // Fetch single user
      const userRef = db.collection('users').doc(userId);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(userDoc.data());
    } else {
      // Fetch all users
      const usersRef = db.collection('users');
      const snapshot = await usersRef.get();
      const users = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      return NextResponse.json(users);
    }
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
} 