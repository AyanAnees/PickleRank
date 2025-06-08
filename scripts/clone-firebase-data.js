const admin = require('firebase-admin');
const serviceAccountProd = require('../serviceAccountKey.json');
const serviceAccountQA = require('../serviceAccountKey.qa.json');

// Initialize Firebase Admin SDK for production
admin.initializeApp({
  credential: admin.credential.cert(serviceAccountProd),
  databaseURL: 'https://your-production-project.firebaseio.com'
}, 'prod');

// Initialize Firebase Admin SDK for QA
admin.initializeApp({
  credential: admin.credential.cert(serviceAccountQA),
  databaseURL: 'https://your-qa-project.firebaseio.com'
}, 'qa');

const prodDb = admin.app('prod').firestore();
const qaDb = admin.app('qa').firestore();

async function cloneFirebaseData() {
  try {
    console.log('Starting data clone from production to QA...');
    const collections = ['users', 'games', 'seasons']; // Add your collections here

    for (const collection of collections) {
      const snapshot = await prodDb.collection(collection).get();
      console.log(`Cloning ${collection}...`);
      for (const doc of snapshot.docs) {
        await qaDb.collection(collection).doc(doc.id).set(doc.data());
      }
    }
    console.log('Data clone completed successfully.');
  } catch (error) {
    console.error('Error cloning data:', error);
  } finally {
    // Clean up
    await admin.app('prod').delete();
    await admin.app('qa').delete();
  }
}

cloneFirebaseData(); 