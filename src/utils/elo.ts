const K_FACTOR = 32; // Standard K-factor for ELO calculations
const INITIAL_RATING = 1500; // Starting ELO rating for new players

export const calculateEloChange = (
  playerRating: number,
  opponentRating: number,
  won: boolean
): number => {
  const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
  const actualScore = won ? 1 : 0;
  return Math.round(K_FACTOR * (actualScore - expectedScore));
};

export const calculateTeamElo = (player1Rating: number, player2Rating: number): number => {
  return Math.round((player1Rating + player2Rating) / 2);
};

export const calculateGameEloChanges = (
  team1Players: { id: string; rating: number }[],
  team2Players: { id: string; rating: number }[],
  team1Won: boolean
): { [playerId: string]: number } => {
  const team1Elo = calculateTeamElo(team1Players[0].rating, team1Players[1].rating);
  const team2Elo = calculateTeamElo(team2Players[0].rating, team2Players[1].rating);

  const changes: { [playerId: string]: number } = {};

  // Calculate changes for team 1
  team1Players.forEach((player) => {
    changes[player.id] = calculateEloChange(player.rating, team2Elo, team1Won);
  });

  // Calculate changes for team 2
  team2Players.forEach((player) => {
    changes[player.id] = calculateEloChange(player.rating, team1Elo, !team1Won);
  });

  return changes;
};

export { INITIAL_RATING }; 