import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { User } from '@/types';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { collection, getDocs } from 'firebase/firestore';

export async function POST(request: Request) {
  try {
    const userData: User = await request.json();
    
    // Check if user already exists
    const userRef = doc(db, 'users', userData.id);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      // Update existing user
      await setDoc(userRef, {
        ...userData,
        updatedAt: new Date()
      }, { merge: true });
    } else {
      // Create new user
      await setDoc(userRef, {
        ...userData,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    return NextResponse.json(userData, { status: 201 });
  } catch (error) {
    console.error('Error creating/updating user:', error);
    return NextResponse.json(
      { error: 'Failed to create/update user' },
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
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(userDoc.data());
    } else {
      // Fetch all users
      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);
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