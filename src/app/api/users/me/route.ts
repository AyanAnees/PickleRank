import { NextResponse } from 'next/server';
import { adminAuth, db } from '@/lib/firebase-admin';

export async function GET(request: Request) {
  try {
    // Get the auth token from the cookie
    const authToken = request.headers.get('cookie')?.split('auth-token=')[1]?.split(';')[0];

    if (!authToken) {
      console.log('No auth token found in request');
      return NextResponse.json(
        { error: 'No auth token provided' },
        { status: 401 }
      );
    }

    console.log('Verifying token...');
    // Verify the token
    const decodedToken = await adminAuth.verifyIdToken(authToken);
    console.log('Token verified, user ID:', decodedToken.uid);

    const userId = decodedToken.uid;

    // Get user data from Firestore
    console.log('Fetching user data from Firestore...');
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      console.log('User not found in Firestore');
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    console.log('User data found:', userData);

    return NextResponse.json(userData);
  } catch (error: any) {
    console.error('Error in /api/users/me:', error);
    // Log the full error details
    if (error.errorInfo) {
      console.error('Firebase error details:', error.errorInfo);
    }
    return NextResponse.json(
      { error: 'Failed to fetch user data', details: error.message },
      { status: 500 }
    );
  }
} 