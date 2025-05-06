import { auth } from './firebase';
import {
  signInWithPhoneNumber,
  RecaptchaVerifier,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  PhoneAuthProvider,
  signInWithCredential
} from 'firebase/auth';
import { User } from '../types';

// Create a reCAPTCHA verifier instance
export function createRecaptchaVerifier(containerId: string) {
  return new RecaptchaVerifier(auth, containerId, {
    size: 'normal',
    callback: () => {
      // reCAPTCHA solved, allow signInWithPhoneNumber.
    },
  });
}

export async function signInWithPhone(phoneNumber: string, recaptchaVerifier: RecaptchaVerifier): Promise<string> {
  try {
    const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
    return confirmationResult.verificationId;
  } catch (error) {
    console.error('Error sending verification code:', error);
    throw error;
  }
}

export async function confirmCode(verificationId: string, code: string): Promise<User> {
  try {
    // The user has successfully signed in with the code
    const userCredential = await signInWithCredential(
      auth,
      PhoneAuthProvider.credential(verificationId, code)
    );
    const { user: firebaseUser } = userCredential;
    
    // Create or update user in Firestore
    const user: User = {
      id: firebaseUser.uid,
      phoneNumber: firebaseUser.phoneNumber || '',
      displayName: 'New Player', // Set a default display name
      firstName: '',
      lastName: '',
      elo: 1500, // Default ELO
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isAdmin: false,
      seasonStats: {}
    };

    // Save user to Firestore
    await fetch('/api/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(user),
    });

    return user;
  } catch (error) {
    console.error('Error confirming code:', error);
    throw error;
  }
}

export async function signOut(): Promise<void> {
  try {
    await firebaseSignOut(auth);
    // Clear the auth token cookie
    document.cookie = 'auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
}

export function onAuthStateChange(callback: (user: FirebaseUser | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
} 