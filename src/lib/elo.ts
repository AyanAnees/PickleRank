// K-factor determines how much a game affects a player's rating
const K_FACTOR = 32;

/**
 * Calculate the expected score for a player based on their ELO rating
 * @param playerElo The player's ELO rating
 * @param opponentElo The opponent's ELO rating
 * @returns The expected score (between 0 and 1)
 */
function calculateExpectedScore(playerElo: number, opponentElo: number): number {
  return 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
}

/**
 * Calculate the ELO change for a game
 * @param playerElo The player's current ELO rating
 * @param opponentElo The opponent's current ELO rating
 * @param playerWon Whether the player won the game
 * @returns The ELO change (positive if player won, negative if player lost)
 */
export function calculateEloChange(
  playerElo: number,
  opponentElo: number,
  playerWon: boolean
): number {
  const expectedScore = calculateExpectedScore(playerElo, opponentElo);
  const actualScore = playerWon ? 1 : 0;
  return Math.round(K_FACTOR * (actualScore - expectedScore));
} 