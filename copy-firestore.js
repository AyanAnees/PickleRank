const admin = require('firebase-admin');
const fs = require('fs');

// Load service accounts
const prodServiceAccount = require('./prod-service-account.json');
const qaServiceAccount = require('./qa-service-account.json');

// Initialize prod app
const prodApp = admin.initializeApp({
  credential: admin.credential.cert(prodServiceAccount)
}, 'prod');

// Initialize QA app
const qaApp = admin.initializeApp({
  credential: admin.credential.cert(qaServiceAccount)
}, 'qa');

const prodDb = prodApp.firestore();
const qaDb = qaApp.firestore();

async function copyCollection(collectionName) {
  const snapshot = await prodDb.collection(collectionName).get();
  const batch = qaDb.batch();

  snapshot.forEach(doc => {
    const docRef = qaDb.collection(collectionName).doc(doc.id);
    batch.set(docRef, doc.data());
  });

  await batch.commit();
  console.log(`Copied ${snapshot.size} docs from ${collectionName}`);
}

async function main() {
  const collections = await prodDb.listCollections();
  for (const col of collections) {
    await copyCollection(col.id);
  }
  console.log('All collections copied!');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
}); 