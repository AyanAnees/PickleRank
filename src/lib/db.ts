import { db } from './firebase';
import { collection, addDoc, getDocs, query, where, orderBy, Timestamp, doc, getDoc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { Season, SeasonRanking, User } from '../types';
import { DEFAULT_SEASON_SETTINGS } from '../utils/season';

const SEASONS_COLLECTION = 'seasons';
const RANKINGS_COLLECTION = 'rankings';
const USERS_COLLECTION = 'users';

export async function createSeason(season: Omit<Season, 'id'>): Promise<Season | null> {
  try {
    // Check for existing active seasons
    const now = new Date();
    const seasonsRef = collection(db, SEASONS_COLLECTION);
    const activeSeasonsQuery = query(
      seasonsRef,
      where('isActive', '==', true),
      where('startDate', '<=', now),
      where('endDate', '>=', now)
    );
    
    const activeSeasons = await getDocs(activeSeasonsQuery);
    if (!activeSeasons.empty) {
      console.error('Cannot create new season: An active season already exists');
      return null;
    }

    const timestamp = Timestamp.now();
    const docRef = await addDoc(seasonsRef, {
      ...season,
      startDate: Timestamp.fromDate(new Date(season.startDate)),
      endDate: Timestamp.fromDate(new Date(season.endDate)),
      createdAt: timestamp,
      updatedAt: timestamp,
      settings: season.settings || DEFAULT_SEASON_SETTINGS
    });
    
    // Get the created document to ensure we have all fields
    const doc = await getDoc(docRef);
    if (!doc.exists()) {
      return null;
    }

    const data = doc.data();
    const newSeason = {
      id: doc.id,
      name: data.name,
      startDate: data.startDate.toDate().toISOString(),
      endDate: data.endDate.toDate().toISOString(),
      isActive: data.isActive,
      settings: data.settings || DEFAULT_SEASON_SETTINGS,
      createdAt: data.createdAt.toDate().toISOString(),
      updatedAt: data.updatedAt.toDate().toISOString()
    };

    // Initialize rankings for the new season
    await initializeSeasonRankings(doc.id);

    return newSeason;
  } catch (error) {
    console.error('Error creating season:', error);
    return null;
  }
}

export async function getSeasons(): Promise<Season[]> {
  try {
    const seasonsRef = collection(db, SEASONS_COLLECTION);
    const q = query(seasonsRef, orderBy('startDate', 'desc'));
    const querySnapshot = await getDocs(q);
    
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
    const seasonsRef = collection(db, SEASONS_COLLECTION);
    const q = query(
      seasonsRef,
      where('startDate', '<=', now),
      where('endDate', '>=', now),
      orderBy('startDate', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
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
    const rankingsRef = collection(db, RANKINGS_COLLECTION);
    const rankingsQuery = query(
      rankingsRef,
      where('seasonId', '==', seasonId)
    );

    const rankingsSnapshot = await getDocs(rankingsQuery);
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
      const userDoc = await getDoc(doc(db, USERS_COLLECTION, userId));
      if (userDoc.exists()) {
        users.push({
          id: userDoc.id,
          ...userDoc.data()
        } as User);
      }
    }

    return { rankings, users, unranked };
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
  const rankingRef = doc(db, RANKINGS_COLLECTION, `${seasonId}_${userId}`);
  const rankingDoc = await getDoc(rankingRef);

  if (rankingDoc.exists()) {
    // Update existing ranking
    const currentData = rankingDoc.data();
    await updateDoc(rankingRef, {
      currentElo,
      wins: currentData.wins + wins,
      losses: currentData.losses + losses,
      updatedAt: Timestamp.now()
    });
  } else {
    // Create new ranking
    await setDoc(rankingRef, {
      seasonId,
      userId,
      currentElo,
      wins,
      losses,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
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
    const seasonsRef = collection(db, SEASONS_COLLECTION);
    const querySnapshot = await getDocs(seasonsRef);
    
    const deletePromises = querySnapshot.docs.map(doc => 
      deleteDoc(doc.ref)
    );
    
    await Promise.all(deletePromises);
  } catch (error) {
    console.error('Error deleting seasons:', error);
  }
}

export async function initializeSeasonRankings(seasonId: string): Promise<void> {
  try {
    // Get all users
    const usersRef = collection(db, USERS_COLLECTION);
    const usersSnapshot = await getDocs(usersRef);
    
    // Create initial rankings for each user
    const rankingPromises = usersSnapshot.docs.map(async (userDoc) => {
      const userData = userDoc.data();
      const rankingRef = doc(db, RANKINGS_COLLECTION, `${seasonId}_${userDoc.id}`);
      
      await setDoc(rankingRef, {
        seasonId,
        userId: userDoc.id,
        currentElo: userData.eloRating || 1500, // Default ELO if not set
        wins: 0,
        losses: 0,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
    });
    
    await Promise.all(rankingPromises);
  } catch (error) {
    console.error('Error initializing season rankings:', error);
  }
} 