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
 * Calculate the ELO change for a game, factoring in margin of victory
 * @param playerElo The player's current ELO rating
 * @param opponentElo The opponent's ELO rating
 * @param playerWon Whether the player won the game
 * @param scoreDiff The absolute score difference (margin of victory)
 * @returns The ELO change (positive if player won, negative if player lost)
 */
export function calculateEloChange(
  playerElo: number,
  opponentElo: number,
  playerWon: boolean,
  scoreDiff: number
): number {
  const expectedScore = calculateExpectedScore(playerElo, opponentElo);
  const actualScore = playerWon ? 1 : 0;
  // Margin multiplier: 1x for a 2-point win, up to 1.5x for a 7+ point win
  const marginMultiplier = 1 + Math.min((scoreDiff - 2) / 10, 0.5);
  return Math.round(K_FACTOR * (actualScore - expectedScore) * marginMultiplier);
} 