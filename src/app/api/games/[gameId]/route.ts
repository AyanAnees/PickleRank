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
    .filter((g): g is GameDoc => !!g && typeof g.team1 === 'object' && typeof g.team2 === 'object' && Array.isArray(g.team1.players) && Array.isArray(g.team2.players));
  // Get all player IDs
  const playerIds = new Set<string>();
  games.forEach(game => {
    game.team1.players.forEach((p: string) => playerIds.add(p));
    game.team2.players.forEach((p: string) => playerIds.add(p));
  });
  // Reset all rankings for the season
  const rankingsRef = db.collection('rankings');
  for (const playerId of playerIds) {
    await rankingsRef.doc(`${seasonId}_${playerId}`).set({
      seasonId,
      userId: playerId,
      currentElo: 1500,
      wins: 0,
      losses: 0,
      updatedAt: new Date(),
    });
  }
  // Replay all games to recalculate ELO
  for (const game of games) {
    if (!game || !game.team1 || !game.team2 || !Array.isArray(game.team1.players) || !Array.isArray(game.team2.players)) continue;
    // Get current ELOs
    const team1Docs = await Promise.all(game.team1.players.map((pid: string) => rankingsRef.doc(`${seasonId}_${pid}`).get()));
    const team2Docs = await Promise.all(game.team2.players.map((pid: string) => rankingsRef.doc(`${seasonId}_${pid}`).get()));
    const team1Elo = team1Docs.reduce((sum: number, doc) => sum + (doc.data()?.currentElo || 1500), 0) / 2;
    const team2Elo = team2Docs.reduce((sum: number, doc) => sum + (doc.data()?.currentElo || 1500), 0) / 2;
    const team1Won = game.team1.score > game.team2.score;
    const eloChange = calculateEloChange(team1Elo, team2Elo, team1Won);
    // Update team1
    for (const doc of team1Docs) {
      const data = doc.data() || { currentElo: 1500, wins: 0, losses: 0 };
      await doc.ref.update({
        currentElo: data.currentElo + (team1Won ? eloChange : -eloChange),
        wins: (data.wins || 0) + (team1Won ? 1 : 0),
        losses: (data.losses || 0) + (team1Won ? 0 : 1),
        updatedAt: new Date(),
      });
    }
    // Update team2
    for (const doc of team2Docs) {
      const data = doc.data() || { currentElo: 1500, wins: 0, losses: 0 };
      await doc.ref.update({
        currentElo: data.currentElo + (team1Won ? -eloChange : eloChange),
        wins: (data.wins || 0) + (team1Won ? 0 : 1),
        losses: (data.losses || 0) + (team1Won ? 1 : 0),
        updatedAt: new Date(),
      });
    }
  }
} 