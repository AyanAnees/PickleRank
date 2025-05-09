const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json'); // Adjust path if needed

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const now = new Date().toISOString();

const users = [
  {
    id: 'user1',
    phoneNumber: '+15555550001',
    displayName: 'Alice Example',
    firstName: 'Alice',
    lastName: 'Example',
    elo: 1500,
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    createdAt: now,
    updatedAt: now,
    isAdmin: false,
    seasonStats: {}
  },
  {
    id: 'user2',
    phoneNumber: '+15555550002',
    displayName: 'Bob Example',
    firstName: 'Bob',
    lastName: 'Example',
    elo: 1500,
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    createdAt: now,
    updatedAt: now,
    isAdmin: false,
    seasonStats: {}
  },
  {
    id: 'user3',
    phoneNumber: '+15555550003',
    displayName: 'Carol Example',
    firstName: 'Carol',
    lastName: 'Example',
    elo: 1500,
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    createdAt: now,
    updatedAt: now,
    isAdmin: false,
    seasonStats: {}
  },
  {
    id: 'user4',
    phoneNumber: '+15555550004',
    displayName: 'Dave Example',
    firstName: 'Dave',
    lastName: 'Example',
    elo: 1500,
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    createdAt: now,
    updatedAt: now,
    isAdmin: false,
    seasonStats: {}
  },
  {
    id: 'user5',
    phoneNumber: '+15555550005',
    displayName: 'Eve Example',
    firstName: 'Eve',
    lastName: 'Example',
    elo: 1500,
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    createdAt: now,
    updatedAt: now,
    isAdmin: false,
    seasonStats: {}
  }
];

async function seed() {
  for (const user of users) {
    await db.collection('users').doc(user.id).set(user);
    console.log(`Created user: ${user.displayName}`);
  }
  process.exit(0);
}

seed(); 