import { Season, SeasonStats, User, SeasonRanking } from '../types';

export const DEFAULT_SEASON_SETTINGS = {
  initialElo: 1500,
  kFactor: 32,
  minGamesForRanking: 5,
};

export const createNewSeason = (
  name: string,
  startDate: Date,
  endDate: Date,
  settings = DEFAULT_SEASON_SETTINGS
): Season => {
  // Extract season number from name if it exists
  const seasonMatch = name.match(/Season (\d+)/);
  const seasonNumber = seasonMatch ? parseInt(seasonMatch[1]) : 1;
  
  return {
    id: crypto.randomUUID(),
    name: `Season ${seasonNumber}`,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    isActive: true,
    settings,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
};

export const initializeUserSeasonStats = (userId: string, seasonId: string): SeasonStats => {
  return {
    eloRating: DEFAULT_SEASON_SETTINGS.initialElo,
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    highestElo: DEFAULT_SEASON_SETTINGS.initialElo,
    lowestElo: DEFAULT_SEASON_SETTINGS.initialElo,
    winStreak: 0,
    currentStreak: 0,
  };
};

export const updateSeasonStats = (
  user: User,
  seasonId: string,
  eloChange: number,
  won: boolean
): User => {
  const seasonStats = user.seasonStats[seasonId] || initializeUserSeasonStats(user.id, seasonId);
  
  const newElo = seasonStats.eloRating + eloChange;
  const newStreak = won ? seasonStats.currentStreak + 1 : 0;
  
  return {
    ...user,
    seasonStats: {
      ...user.seasonStats,
      [seasonId]: {
        ...seasonStats,
        eloRating: newElo,
        gamesPlayed: seasonStats.gamesPlayed + 1,
        wins: won ? seasonStats.wins + 1 : seasonStats.wins,
        losses: won ? seasonStats.losses : seasonStats.losses + 1,
        highestElo: Math.max(seasonStats.highestElo, newElo),
        lowestElo: Math.min(seasonStats.lowestElo, newElo),
        winStreak: Math.max(seasonStats.winStreak, newStreak),
        currentStreak: newStreak,
      },
    },
  };
};

export const isSeasonActive = (season: Season): boolean => {
  const now = new Date();
  const startDate = new Date(season.startDate);
  const endDate = new Date(season.endDate);
  return season.isActive && now >= startDate && now <= endDate;
};

export function getCurrentSeason(seasons: Season[]): Season | null {
  const now = new Date();
  return seasons.find(season => {
    const startDate = new Date(season.startDate);
    const endDate = new Date(season.endDate);
    return startDate <= now && now <= endDate;
  }) || null;
}

export function determineNextSeason(seasons: Season[]): Season | null {
  // Sort seasons by startDate in descending order
  const sortedSeasons = [...seasons].sort((a, b) => 
    new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  );

  if (sortedSeasons.length === 0) {
    // First season ever
    const now = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 2); // 2 months from now
    
    return {
      id: '',
      name: 'Season 1',
      startDate: now.toISOString(),
      endDate: endDate.toISOString(),
      isActive: true,
      settings: DEFAULT_SEASON_SETTINGS,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };
  }

  // Get the last season number
  const lastSeason = sortedSeasons[0];
  const lastSeasonNumber = parseInt(lastSeason.name.match(/Season (\d+)/)?.[1] || '0');
  
  // Check if there's already an active season
  const now = new Date();
  const hasActiveSeason = sortedSeasons.some(season => 
    season.isActive && 
    new Date(season.startDate) <= now && 
    new Date(season.endDate) >= now
  );

  if (hasActiveSeason) {
    console.error('Cannot create new season: An active season already exists');
    return null;
  }

  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + 2); // 2 months from now
  
  return {
    id: '',
    name: `Season ${lastSeasonNumber + 1}`,
    startDate: now.toISOString(),
    endDate: endDate.toISOString(),
    isActive: true,
    settings: DEFAULT_SEASON_SETTINGS,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  };
}

export const getSeasonRankings = (
  users: User[],
  seasonId: string,
  minGames: number = DEFAULT_SEASON_SETTINGS.minGamesForRanking
): SeasonRanking[] => {
  return users
    .filter(user => {
      const stats = user.seasonStats[seasonId];
      return stats && stats.gamesPlayed >= minGames;
    })
    .map(user => {
      const stats = user.seasonStats[seasonId];
      return {
        userId: user.id,
        seasonId,
        currentElo: stats.eloRating,
        gamesPlayed: stats.gamesPlayed,
        winRate: stats.gamesPlayed > 0 ? stats.wins / stats.gamesPlayed : 0,
        rank: 0, // Will be calculated after sorting
      };
    })
    .sort((a, b) => b.currentElo - a.currentElo)
    .map((ranking, index) => ({
      ...ranking,
      rank: index + 1,
    }));
}; 