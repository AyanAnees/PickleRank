const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json'); // Update path if needed

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const BASE_ELO = 1500;
const K = 32; // Or whatever your K-factor is

function calculateEloChange(playerElo, opponentElo, didWin, scoreDiff) {
  const expected = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
  // Margin multiplier: 1x for a 2-point win, up to 1.5x for a 7+ point win
  const marginMultiplier = 1 + Math.min((scoreDiff - 2) / 10, 0.5);
  return Math.round(K * ((didWin ? 1 : 0) - expected) * marginMultiplier);
}

async function recalculateSeason(seasonId) {
  // 1. Get all games for the season, sorted by gameTime
  const gamesSnap = await db.collection('games')
    .where('seasonId', '==', seasonId)
    .orderBy('gameTime', 'asc')
    .get();

  // Debug: Print all games being processed
  console.log('Games found:', gamesSnap.docs.length);
  gamesSnap.docs.forEach(doc => {
    const data = doc.data();
    console.log(`Game ID: ${doc.id}, gameTime: ${data.gameTime}, team1: ${JSON.stringify(data.team1)}, team2: ${JSON.stringify(data.team2)}`);
  });

  // 2. Get all player IDs
  const playerIds = new Set();
  gamesSnap.docs.forEach(doc => {
    const data = doc.data();
    (data.team1.players || []).forEach(p => playerIds.add(p));
    (data.team2.players || []).forEach(p => playerIds.add(p));
  });

  // 3. Initialize all player ELOs
  const playerElo = {};
  playerIds.forEach(id => { playerElo[id] = BASE_ELO; });

  // 4. Track stats if you want (wins, losses, etc.)
  const playerStats = {};
  playerIds.forEach(id => {
    playerStats[id] = { wins: 0, losses: 0, gamesPlayed: 0, highestElo: BASE_ELO, lowestElo: BASE_ELO };
  });

  // 5. Replay all games
  for (const doc of gamesSnap.docs) {
    const data = doc.data();
    const team1 = data.team1.players || [];
    const team2 = data.team2.players || [];
    const team1Elo = team1.reduce((sum, id) => sum + (playerElo[id] || BASE_ELO), 0) / team1.length;
    const team2Elo = team2.reduce((sum, id) => sum + (playerElo[id] || BASE_ELO), 0) / team2.length;
    const team1Won = data.team1.score > data.team2.score;
    const scoreDiff = Math.abs(data.team1.score - data.team2.score);
    const eloChange = Math.abs(calculateEloChange(team1Elo, team2Elo, team1Won, scoreDiff));

    // Update team1
    for (const id of team1) {
      playerElo[id] = Math.max(0, playerElo[id] + (team1Won ? eloChange : -eloChange));
      playerStats[id].gamesPlayed += 1;
      if (team1Won) playerStats[id].wins += 1;
      else playerStats[id].losses += 1;
      playerStats[id].highestElo = Math.max(playerStats[id].highestElo, playerElo[id]);
      playerStats[id].lowestElo = Math.min(playerStats[id].lowestElo, playerElo[id]);
    }
    // Update team2
    for (const id of team2) {
      playerElo[id] = Math.max(0, playerElo[id] + (team1Won ? -eloChange : eloChange));
      playerStats[id].gamesPlayed += 1;
      if (!team1Won) playerStats[id].wins += 1;
      else playerStats[id].losses += 1;
      playerStats[id].highestElo = Math.max(playerStats[id].highestElo, playerElo[id]);
      playerStats[id].lowestElo = Math.min(playerStats[id].lowestElo, playerElo[id]);
    }

    // Update the game's eloChange field in Firestore
    await db.collection('games').doc(doc.id).update({ eloChange });
    console.log(`Updated game ${doc.id} eloChange to ${eloChange}`);
  }

  // 6. Update rankings in Firestore
  const rankingsRef = db.collection('rankings');
  for (const id of playerIds) {
    await rankingsRef.doc(`${seasonId}_${id}`).set({
      seasonId,
      userId: id,
      currentElo: playerElo[id],
      wins: playerStats[id].wins,
      losses: playerStats[id].losses,
      gamesPlayed: playerStats[id].gamesPlayed,
      highestElo: playerStats[id].highestElo,
      lowestElo: playerStats[id].lowestElo,
      updatedAt: new Date(),
    });
    console.log(`Updated ranking for ${id}: ELO ${playerElo[id]}`);
  }

  console.log('Done! All rankings recalculated.');
}

const seasonId = process.argv[2];
if (!seasonId) {
  console.error('Usage: node scripts/recalculateElo.js <seasonId>');
  process.exit(1);
}

recalculateSeason(seasonId).then(() => process.exit());