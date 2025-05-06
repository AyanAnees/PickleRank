export interface User {
  id: string;
  phoneNumber: string;
  displayName: string;
  firstName: string;
  lastName: string;
  nickname?: string;
  elo: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  createdAt: string;
  updatedAt: string;
  isAdmin: boolean;
  seasonStats: {
    [seasonId: string]: SeasonStats;
  };
}

export interface SeasonStats {
  eloRating: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  highestElo: number;
  lowestElo: number;
  winStreak: number;
  currentStreak: number;
}

export interface Season {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  settings: {
    initialElo: number;
    kFactor: number;
    minGamesForRanking: number;
  };
}

export interface Game {
  id: string;
  seasonId: string;
  team1: {
    players: string[];
    score: number;
    elo: number;
  };
  team2: {
    players: string[];
    score: number;
    elo: number;
  };
  eloChange: number;
  createdAt: string;
}

export interface GameResult {
  team1Score: number;
  team2Score: number;
  team1Players: string[];
  team2Players: string[];
}

export interface EloCalculation {
  playerId: string;
  oldRating: number;
  newRating: number;
  change: number;
}

export interface SeasonRanking {
  userId: string;
  seasonId: string;
  currentElo: number;
  gamesPlayed: number;
  winRate: number;
  rank: number;
  previousRank?: number;
  rankChange?: number;
} 