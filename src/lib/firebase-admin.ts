import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin if not already initialized
if (!getApps().length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    console.error('Missing Firebase Admin credentials:', {
      hasProjectId: !!projectId,
      hasClientEmail: !!clientEmail,
      hasPrivateKey: !!privateKey
    });
    throw new Error('Missing Firebase Admin credentials');
  }

  // Log the first few characters of the private key to verify format
  console.log('Private key starts with:', privateKey.substring(0, 50));
  console.log('Private key contains newlines:', privateKey.includes('\\n'));

  try {
    // Process the private key
    const processedPrivateKey = privateKey.replace(/\\n/g, '\n');
    
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: processedPrivateKey,
      }),
    });
    console.log('Firebase Admin initialized successfully');
  } catch (error) {
    console.error('Error initializing Firebase Admin:', error);
    throw error;
  }
}

export const adminAuth = getAuth();
export const db = getFirestore(); 