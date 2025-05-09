import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { db } from './firebase-admin';
import { Season, SeasonRanking, User } from '../types';
import { DEFAULT_SEASON_SETTINGS } from '../utils/season';

const SEASONS_COLLECTION = 'seasons';
const RANKINGS_COLLECTION = 'rankings';
const USERS_COLLECTION = 'users';

export async function createSeason(season: Omit<Season, 'id'>): Promise<Season | null> {
  try {
    // Check for existing active seasons
    const now = new Date();
    const seasonsRef = db.collection(SEASONS_COLLECTION);
    const activeSeasonsQuery = db.collection(SEASONS_COLLECTION).where('isActive', '==', true).where('startDate', '<=', now).where('endDate', '>=', now);
    
    const activeSeasons = await activeSeasonsQuery.get();
    if (!activeSeasons.empty) {
      console.error('Cannot create new season: An active season already exists');
      return null;
    }

    const timestamp = Timestamp.fromDate(new Date());
    const docRef = await seasonsRef.add({
      ...season,
      startDate: Timestamp.fromDate(new Date(season.startDate)),
      endDate: Timestamp.fromDate(new Date(season.endDate)),
      createdAt: timestamp,
      updatedAt: timestamp,
      settings: season.settings || DEFAULT_SEASON_SETTINGS
    });
    
    // Get the created document to ensure we have all fields
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return null;
    }

    const data = docSnap.data();
    if (!data) {
      return null;
    }
    const newSeason = {
      id: docSnap.id,
      name: data.name,
      startDate: data.startDate.toDate().toISOString(),
      endDate: data.endDate.toDate().toISOString(),
      isActive: data.isActive,
      settings: data.settings || DEFAULT_SEASON_SETTINGS,
      createdAt: data.createdAt.toDate().toISOString(),
      updatedAt: data.updatedAt.toDate().toISOString()
    };

    // Initialize rankings for the new season
    await initializeSeasonRankings(docSnap.id);

    return newSeason;
  } catch (error) {
    console.error('Error creating season:', error);
    return null;
  }
}

export async function getSeasons(): Promise<Season[]> {
  try {
    const seasonsRef = db.collection(SEASONS_COLLECTION);
    const q = seasonsRef.orderBy('startDate', 'desc');
    const querySnapshot = await q.get();
    
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      const now = new Date().toISOString();
      return {
        id: doc.id,
        name: data.name,
        startDate: data.startDate?.toDate?.()?.toISOString() || data.startDate,
        endDate: data.endDate?.toDate?.()?.toISOString() || data.endDate,
        isActive: data.isActive,
        settings: data.settings || DEFAULT_SEASON_SETTINGS,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || now,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt || now
      };
    }) as Season[];
  } catch (error) {
    console.error('Error fetching seasons:', error);
    return [];
  }
}

export async function getCurrentSeason(): Promise<Season | null> {
  try {
    const now = new Date();
    const seasonsRef = db.collection(SEASONS_COLLECTION);
    const q = seasonsRef.where('startDate', '<=', now).where('endDate', '>=', now).orderBy('startDate', 'desc');
    
    const querySnapshot = await q.get();
    if (querySnapshot.empty) {
      return null;
    }
    
    const doc = querySnapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data()
    } as Season;
  } catch (error) {
    console.error('Error fetching current season:', error);
    return null;
  }
}

export async function getSeasonRankings(seasonId: string): Promise<{ rankings: SeasonRanking[], users: User[], unranked: SeasonRanking[] }> {
  try {
    // Get rankings for the season
    const rankingsRef = db.collection(RANKINGS_COLLECTION);
    const rankingsQuery = rankingsRef.where('seasonId', '==', seasonId);

    const rankingsSnapshot = await rankingsQuery.get();
    const allRankings = rankingsSnapshot.docs.map(doc => {
      const data = doc.data();
      const gamesPlayed = (data.wins || 0) + (data.losses || 0);
      return {
        userId: data.userId,
        seasonId: data.seasonId,
        currentElo: data.currentElo,
        gamesPlayed,
        winRate: gamesPlayed > 0 ? (data.wins || 0) / gamesPlayed : 0,
        rank: 0 // Will be set after sorting
      };
    }) as SeasonRanking[];

    // Split into ranked and unranked players
    const unranked = allRankings.filter(ranking => ranking.gamesPlayed < 5);
    const rankings = allRankings.filter(ranking => ranking.gamesPlayed >= 5);

    // Sort rankings by ELO in descending order and assign ranks
    rankings.sort((a, b) => b.currentElo - a.currentElo);
    rankings.forEach((ranking, index) => {
      ranking.rank = index + 1;
    });

    // Get users for both ranked and unranked players
    const userIds = [...new Set([...rankings, ...unranked].map(r => r.userId))];
    const users: User[] = [];

    for (const userId of userIds) {
      const userDoc = await db.collection(USERS_COLLECTION).doc(userId).get();
      if (userDoc.exists) {
        users.push({
          id: userDoc.id,
          ...userDoc.data()
        } as User);
      }
    }

    // --- NEW LOGIC: include all users as unranked if they have no ranking doc ---
    // Fetch all users in the system
    const allUsersSnapshot = await db.collection(USERS_COLLECTION).get();
    const allUsers = allUsersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
    const rankedUserIds = allRankings.map(r => r.userId);
    const trulyUnrankedUsers = allUsers.filter(u => !rankedUserIds.includes(u.id));
    const trulyUnranked = trulyUnrankedUsers.map(u => ({
      userId: u.id,
      seasonId,
      currentElo: 1500,
      gamesPlayed: 0,
      winRate: 0,
      rank: 0,
    }));
    // Add these to the unranked array
    const allUnranked = [
      ...unranked,
      ...trulyUnranked,
    ];

    return { rankings, users: allUsers, unranked: allUnranked };
  } catch (error) {
    console.error('Error fetching season rankings:', error);
    return { rankings: [], users: [], unranked: [] };
  }
}

export async function updatePlayerRanking(
  seasonId: string,
  userId: string,
  currentElo: number,
  wins: number,
  losses: number
): Promise<SeasonRanking> {
  const rankingRef = db.collection(RANKINGS_COLLECTION).doc(`${seasonId}_${userId}`);
  const rankingDoc = await rankingRef.get();

  if (rankingDoc.exists) {
    // Update existing ranking
    const currentData = rankingDoc.data();
    const prevWins = currentData?.wins ?? 0;
    const prevLosses = currentData?.losses ?? 0;
    await rankingRef.update({
      currentElo,
      wins: prevWins + wins,
      losses: prevLosses + losses,
      updatedAt: Timestamp.fromDate(new Date())
    });
  } else {
    // Create new ranking
    await rankingRef.set({
      seasonId,
      userId,
      currentElo,
      wins,
      losses,
      createdAt: Timestamp.fromDate(new Date()),
      updatedAt: Timestamp.fromDate(new Date())
    });
  }

  const gamesPlayed = wins + losses;
  return {
    userId,
    seasonId,
    currentElo,
    gamesPlayed,
    winRate: gamesPlayed > 0 ? wins / gamesPlayed : 0,
    rank: 0 // This will be calculated when fetching rankings
  };
}

export async function deleteAllSeasons(): Promise<void> {
  try {
    const seasonsRef = db.collection(SEASONS_COLLECTION);
    const querySnapshot = await seasonsRef.get();
    
    const deletePromises = querySnapshot.docs.map(doc => 
      doc.ref.delete()
    );
    
    await Promise.all(deletePromises);
  } catch (error) {
    console.error('Error deleting seasons:', error);
  }
}

export async function initializeSeasonRankings(seasonId: string): Promise<void> {
  try {
    // Get all users
    const usersRef = db.collection(USERS_COLLECTION);
    const usersSnapshot = await usersRef.get();
    
    // Create initial rankings for each user
    const rankingPromises = usersSnapshot.docs.map(async (userDoc) => {
      const userData = userDoc.data();
      const rankingRef = db.collection(RANKINGS_COLLECTION).doc(`${seasonId}_${userDoc.id}`);
      
      await rankingRef.set({
        seasonId,
        userId: userDoc.id,
        currentElo: userData.eloRating || 1500, // Default ELO if not set
        wins: 0,
        losses: 0,
        createdAt: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date())
      });
    });
    
    await Promise.all(rankingPromises);
  } catch (error) {
    console.error('Error initializing season rankings:', error);
  }
} 