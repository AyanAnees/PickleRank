const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json'); // Update path if needed

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function main() {
  // 1. Find the active season
  const seasonsSnap = await db.collection('seasons').where('isActive', '==', true).get();
  if (seasonsSnap.empty) {
    console.error('No active season found. Exiting.');
    process.exit(1);
  }
  const season = seasonsSnap.docs[0];
  const seasonId = season.id;
  console.log(`Active season: ${season.data().name} (${seasonId})`);

  // 2. Get all rankings for this season
  const rankingsSnap = await db.collection('rankings').where('seasonId', '==', seasonId).get();
  if (rankingsSnap.empty) {
    console.error('No rankings found for this season. Exiting.');
    process.exit(1);
  }

  let updated = 0;
  for (const doc of rankingsSnap.docs) {
    const { userId, currentElo } = doc.data();
    if (!userId || typeof currentElo !== 'number') continue;
    try {
      const userRef = db.collection('users').doc(userId);
      const userDoc = await userRef.get();
      if (!userDoc.exists) {
        console.warn(`User ${userId} not found in users collection. Skipping.`);
        continue;
      }
      const userData = userDoc.data();
      const beforeElo = userData.elo;
      const name = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || userId;
      await userRef.update({ elo: currentElo });
      console.log(`Updated ${name}: rankings ELO = ${currentElo}, users ELO before = ${beforeElo}, users ELO after = ${currentElo}`);
      updated++;
    } catch (err) {
      console.error(`Failed to update user ${userId}:`, err.message);
    }
  }
  console.log(`Done. Updated ${updated} users' elo fields.`);
}

main().then(() => process.exit()).catch(err => {
  console.error('Script error:', err);
  process.exit(1);
}); 