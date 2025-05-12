const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json'); // Update path if needed

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixEloChange() {
  const gamesSnap = await db.collection('games').get();
  let updated = 0;

  for (const doc of gamesSnap.docs) {
    const data = doc.data();
    if (typeof data.eloChange === 'number' && data.eloChange < 0) {
      await doc.ref.update({ eloChange: Math.abs(data.eloChange) });
      updated++;
      console.log(`Fixed eloChange for game: ${doc.id}`);
    }
  }

  console.log(`Done! Updated ${updated} games.`);
}

fixEloChange().then(() => process.exit());