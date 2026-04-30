export type EvaluationScoreValue = "EXCELLENT" | "VERY_GOOD" | "GOOD" | "ACCEPTABLE";

export const SCORE_POINTS: Record<EvaluationScoreValue, number> = {
  EXCELLENT: 5,
  VERY_GOOD: 4,
  GOOD: 3,
  ACCEPTABLE: 2,
};

export type ScoreResult = {
  totalScore: number; // sum of all point values
  finalScore: number; // totalScore / count, rounded to 2 dp
  finalGrade: string; // "Excellent" | "Very Good" | "Good" | "Acceptable"
};

export type ScoreInput = {
  score: EvaluationScoreValue;
}[];

/**
 * Derives totalScore, finalScore, and finalGrade from a list of scored items.
 * Returns { success: false } when the input list is empty.
 */
export function calculateEvaluationScore(
  items: ScoreInput
): { success: true; data: ScoreResult } | { success: false; error: string } {
  if (items.length === 0) {
    return { success: false, error: "errors.invalidInput" };
  }

  const totalScore = items.reduce((sum, item) => sum + SCORE_POINTS[item.score], 0);
  const finalScore = Math.round((totalScore / items.length) * 100) / 100;

  let finalGrade: string;
  if (finalScore >= 4.5) {
    finalGrade = "Excellent";
  } else if (finalScore >= 3.5) {
    finalGrade = "Very Good";
  } else if (finalScore >= 2.5) {
    finalGrade = "Good";
  } else {
    finalGrade = "Acceptable";
  }

  return {
    success: true,
    data: {
      totalScore,
      finalScore,
      finalGrade,
    },
  };
}
