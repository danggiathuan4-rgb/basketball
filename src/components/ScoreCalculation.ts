/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Calculates the total score based on the competition rules:
 * - 5 racks, 3 shots each.
 * - Each successful shot = 1 point.
 * - Perfect Rack Bonus: if all 3 shots at a rack are successful, reward +3 bonus points.
 * - Maximum total score = 15 shots * 1 pt + 5 perfect racks * 3 pts = 30 points.
 * 
 * Returns both the total score, detailed breakdowns, and which racks are perfect.
 */
export function countShootoutScore(shots: (boolean | null)[][]) {
  let totalScore = 0;
  let regularPoints = 0;
  let bonusPoints = 0;
  const perfectRacks: boolean[] = Array(5).fill(false);
  const rackScores: number[] = Array(5).fill(0);
  const rackMadeCounts: number[] = Array(5).fill(0);

  for (let r = 0; r < 5; r++) {
    let madeInRack = 0;
    for (let b = 0; b < 3; b++) {
      if (shots[r] && shots[r][b] === true) {
        madeInRack++;
        regularPoints++;
      }
    }
    rackMadeCounts[r] = madeInRack;
    
    // Calculate score for this specific rack
    let scoreForRack = madeInRack;
    if (madeInRack === 3) {
      perfectRacks[r] = true;
      bonusPoints += 3;
      scoreForRack += 3;
    }
    rackScores[r] = scoreForRack;
    totalScore += scoreForRack;
  }

  return {
    totalScore,
    regularPoints,
    bonusPoints,
    perfectRacks,
    rackScores,
    rackMadeCounts
  };
}
