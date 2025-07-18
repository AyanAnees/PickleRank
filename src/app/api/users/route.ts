export const runtime = "nodejs";
import { NextResponse } from 'next/server';
import { db, adminAuth } from '@/lib/firebase-admin';
import { User } from '@/types';

export async function POST(request: Request) {
  try {
    // 1. Verify auth token
    const authToken = request.headers.get('cookie')?.split('auth-token=')[1]?.split(';')[0];
    if (!authToken) {
      console.error('POST /api/users - No auth token provided');
      return NextResponse.json({ error: 'No auth token provided' }, { status: 401 });
    }
    
    let decodedToken;
    let userId;
    try {
      decodedToken = await adminAuth.verifyIdToken(authToken);
      userId = decodedToken.uid;
    } catch (tokenError) {
      console.error('POST /api/users - Token verification failed:', tokenError);
      return NextResponse.json({ error: 'Invalid auth token' }, { status: 401 });
    }

    // 2. Parse and validate body
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('POST /api/users - JSON parsing failed:', parseError);
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    
    const { firstName, lastName, ...rest } = body;
    if (!firstName || !lastName) {
      console.error('POST /api/users - Missing required fields:', { firstName: !!firstName, lastName: !!lastName });
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 3. Prepare user data
    const userRef = db.collection('users').doc(userId);
    let userDoc;
    try {
      userDoc = await userRef.get();
    } catch (firestoreError) {
      console.error('POST /api/users - Firestore read failed:', firestoreError);
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }
    
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
    try {
      await userRef.set(userData, { merge: true });
      console.log('POST /api/users - User created/updated successfully:', userId);
      return NextResponse.json(userData, { status: userDoc.exists ? 200 : 201 });
    } catch (writeError) {
      console.error('POST /api/users - Firestore write failed:', writeError);
      return NextResponse.json({ error: 'Failed to save user data' }, { status: 500 });
    }
  } catch (error) {
    console.error('POST /api/users - Unexpected error:', error);
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