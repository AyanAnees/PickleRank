export const runtime = "nodejs";
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { calculateEloChange } from '@/lib/elo';

const ADMIN_PHONE = '+15856831831';
const ADMIN_PHONES = ['+15856831831', '+15856831234'];

async function isAdmin(request: Request) {
  // Get user from auth token (assume phoneNumber is available in user record)
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return false;
  const idToken = authHeader.replace('Bearer ', '');
  try {
    const { getAuth } = await import('firebase-admin/auth');
    const decoded = await getAuth().verifyIdToken(idToken);
    const phone = decoded.phone_number;
    return typeof phone === 'string' && ADMIN_PHONES.includes(phone);
  } catch {
    return false;
  }
}

export async function DELETE(request: Request, { params }: { params: { gameId: string } }) {
  if (!(await isAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  const { gameId } = params;
  try {
    // Get the game to delete
    const gameDoc = await db.collection('games').doc(gameId).get();
    if (!gameDoc.exists) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }
    const game = gameDoc.data();
    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }
    const seasonId = game.seasonId;
    // Delete the game
    await gameDoc.ref.delete();
    // Recalculate ELO for the season
    await recalculateSeasonElo(seasonId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting game:', error);
    return NextResponse.json({ error: 'Failed to delete game' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { gameId: string } }) {
  if (!(await isAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  const { gameId } = params;
  try {
    const updateData = await request.json();
    // Update the game
    await db.collection('games').doc(gameId).update(updateData);
    // Get the updated game to find seasonId
    const gameDoc = await db.collection('games').doc(gameId).get();
    const game = gameDoc.data();
    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }
    const seasonId = game.seasonId;
    // Recalculate ELO for the season
    await recalculateSeasonElo(seasonId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error editing game:', error);
    return NextResponse.json({ error: 'Failed to edit game' }, { status: 500 });
  }
}

// Helper: Recalculate all ELO and stats for a season
async function recalculateSeasonElo(seasonId: string) {
  // Validate season exists
  const seasonDoc = await db.collection('seasons').doc(seasonId).get();
  if (!seasonDoc.exists) {
    throw new Error('Season does not exist');
  }

  // Get all games for the season, sorted by gameTime
  const gamesSnap = await db.collection('games')
    .where('seasonId', '==', seasonId)
    .orderBy('gameTime', 'asc')
    .get();

  type GameDoc = {
    id: string;
    team1: { players: string[]; score: number };
    team2: { players: string[]; score: number };
    gameTime: any;
  };

  const games: GameDoc[] = gamesSnap.docs
    .map(doc => ({ id: doc.id, ...doc.data() }) as Partial<GameDoc>)
    .filter((g): g is GameDoc => {
      if (!g || !g.team1 || !g.team2) return false;
      if (!Array.isArray(g.team1.players) || !Array.isArray(g.team2.players)) return false;
      if (g.team1.players.length !== 2 || g.team2.players.length !== 2) return false;
      if (typeof g.team1.score !== 'number' || typeof g.team2.score !== 'number') return false;
      if (g.team1.score < 0 || g.team2.score < 0) return false;
      if (Math.abs(g.team1.score - g.team2.score) < 2) return false;
      if (g.team1.score < 11 && g.team2.score < 11) return false;
      return true;
    });

  // Get all player IDs and validate they exist
  const playerIds = new Set<string>();
  games.forEach(game => {
    game.team1.players.forEach(p => playerIds.add(p));
    game.team2.players.forEach(p => playerIds.add(p));
  });

  // Validate all players exist
  const playerDocs = await Promise.all(
    Array.from(playerIds).map(playerId => db.collection('users').doc(playerId).get())
  );
  
  const invalidPlayers = playerDocs.filter(doc => !doc.exists);
  if (invalidPlayers.length > 0) {
    throw new Error('One or more players do not exist');
  }

  // Reset all rankings for the season using a transaction
  const rankingsRef = db.collection('rankings');
  const usersRef = db.collection('users');
  
  for (const playerId of playerIds) {
    await db.runTransaction(async (transaction) => {
      const rankingRef = rankingsRef.doc(`${seasonId}_${playerId}`);
      const userRef = usersRef.doc(playerId);
      
      transaction.set(rankingRef, {
        seasonId,
        userId: playerId,
        currentElo: 1500,
        wins: 0,
        losses: 0,
        updatedAt: new Date(),
      });

      transaction.update(userRef, {
        [`seasonStats.${seasonId}`]: {
          eloRating: 1500,
          gamesPlayed: 0,
          wins: 0,
          losses: 0,
          highestElo: 1500,
          lowestElo: 1500,
          winStreak: 0,
          currentStreak: 0,
        }
      });
    });
  }

  // Replay all games to recalculate ELO
  for (const game of games) {
    // Get current ELOs
    const team1Docs = await Promise.all(game.team1.players.map(pid => rankingsRef.doc(`${seasonId}_${pid}`).get()));
    const team2Docs = await Promise.all(game.team2.players.map(pid => rankingsRef.doc(`${seasonId}_${pid}`).get()));
    
    const team1Elo = team1Docs.reduce((sum, doc) => sum + (doc.data()?.currentElo || 1500), 0) / 2;
    const team2Elo = team2Docs.reduce((sum, doc) => sum + (doc.data()?.currentElo || 1500), 0) / 2;
    const team1Won = game.team1.score > game.team2.score;
    const scoreDiff = Math.abs(game.team1.score - game.team2.score);
    const eloChange = calculateEloChange(team1Elo, team2Elo, team1Won, scoreDiff);

    // Update team1
    for (const doc of team1Docs) {
      const playerId = doc.id.split('_')[1];
      await db.runTransaction(async (transaction) => {
        const rankingRef = rankingsRef.doc(doc.id);
        const userRef = usersRef.doc(playerId);
        
        const rankingDoc = await transaction.get(rankingRef);
        const userDoc = await transaction.get(userRef);
        
        const rankingData = rankingDoc.data() || { currentElo: 1500, wins: 0, losses: 0 };
        const userData = userDoc.data() || {};
        const seasonStats = userData.seasonStats?.[seasonId] || {
          eloRating: 1500,
          gamesPlayed: 0,
          wins: 0,
          losses: 0,
          highestElo: 1500,
          lowestElo: 1500,
          winStreak: 0,
          currentStreak: 0,
        };

        const newElo = Math.max(0, rankingData.currentElo + (team1Won ? eloChange : -eloChange));
        const won = team1Won;

        transaction.update(rankingRef, {
          currentElo: newElo,
          wins: (rankingData.wins || 0) + (won ? 1 : 0),
          losses: (rankingData.losses || 0) + (won ? 0 : 1),
          updatedAt: new Date(),
        });

        transaction.update(userRef, {
          [`seasonStats.${seasonId}`]: {
            eloRating: newElo,
            gamesPlayed: seasonStats.gamesPlayed + 1,
            wins: seasonStats.wins + (won ? 1 : 0),
            losses: seasonStats.losses + (won ? 0 : 1),
            highestElo: Math.max(seasonStats.highestElo, newElo),
            lowestElo: Math.min(seasonStats.lowestElo, newElo),
            winStreak: won ? seasonStats.winStreak + 1 : 0,
            currentStreak: won ? seasonStats.currentStreak + 1 : 0,
          }
        });
      });
    }

    // Update team2
    for (const doc of team2Docs) {
      const playerId = doc.id.split('_')[1];
      await db.runTransaction(async (transaction) => {
        const rankingRef = rankingsRef.doc(doc.id);
        const userRef = usersRef.doc(playerId);
        
        const rankingDoc = await transaction.get(rankingRef);
        const userDoc = await transaction.get(userRef);
        
        const rankingData = rankingDoc.data() || { currentElo: 1500, wins: 0, losses: 0 };
        const userData = userDoc.data() || {};
        const seasonStats = userData.seasonStats?.[seasonId] || {
          eloRating: 1500,
          gamesPlayed: 0,
          wins: 0,
          losses: 0,
          highestElo: 1500,
          lowestElo: 1500,
          winStreak: 0,
          currentStreak: 0,
        };

        const newElo = Math.max(0, rankingData.currentElo + (team1Won ? -eloChange : eloChange));
        const won = !team1Won;

        transaction.update(rankingRef, {
          currentElo: newElo,
          wins: (rankingData.wins || 0) + (won ? 1 : 0),
          losses: (rankingData.losses || 0) + (won ? 0 : 1),
          updatedAt: new Date(),
        });

        transaction.update(userRef, {
          [`seasonStats.${seasonId}`]: {
            eloRating: newElo,
            gamesPlayed: seasonStats.gamesPlayed + 1,
            wins: seasonStats.wins + (won ? 1 : 0),
            losses: seasonStats.losses + (won ? 0 : 1),
            highestElo: Math.max(seasonStats.highestElo, newElo),
            lowestElo: Math.min(seasonStats.lowestElo, newElo),
            winStreak: won ? seasonStats.winStreak + 1 : 0,
            currentStreak: won ? seasonStats.currentStreak + 1 : 0,
          }
        });
      });
    }
  }
} 