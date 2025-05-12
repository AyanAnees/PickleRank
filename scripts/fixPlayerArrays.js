const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json'); // <-- Make sure this path is correct

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixGamesCollection() {
  const gamesSnap = await db.collection('games').get();
  let updated = 0;

  for (const doc of gamesSnap.docs) {
    const data = doc.data();
    let changed = false;

    ['team1', 'team2'].forEach(teamKey => {
      if (data[teamKey] && Array.isArray(data[teamKey].players)) {
        const fixed = data[teamKey].players.map(p =>
          typeof p === 'object' && p.id ? p.id : p
        );
        if (JSON.stringify(fixed) !== JSON.stringify(data[teamKey].players)) {
          data[teamKey].players = fixed;
          changed = true;
        }
      }
    });

    if (changed) {
      await doc.ref.update({
        'team1.players': data.team1.players,
        'team2.players': data.team2.players
      });
      updated++;
      console.log(`Updated game: ${doc.id}`);
    }
  }

  console.log(`Done! Updated ${updated} games.`);
}

fixGamesCollection().then(() => process.exit());