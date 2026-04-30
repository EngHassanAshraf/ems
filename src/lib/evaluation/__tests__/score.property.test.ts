// Feature: employee-evaluation-system, Property 1: Score point mapping is total and correct

/**
 * Validates: Requirements 2.2
 */

import * as fc from "fast-check";
import { describe, it, expect } from "vitest";
import { SCORE_POINTS, EvaluationScoreValue, calculateEvaluationScore } from "../score";

describe("Property 1: Score point mapping is total and correct", () => {
  it("SCORE_POINTS returns the correct numeric value for every valid enum member", async () => {
    const expectedPoints: Record<EvaluationScoreValue, number> = {
      EXCELLENT: 5,
      VERY_GOOD: 4,
      GOOD: 3,
      ACCEPTABLE: 2,
    };

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom("EXCELLENT", "VERY_GOOD", "GOOD", "ACCEPTABLE" as const),
        async (score) => {
          const value = SCORE_POINTS[score as EvaluationScoreValue];
          expect(value).toBe(expectedPoints[score as EvaluationScoreValue]);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: employee-evaluation-system, Property 2: Score calculation range invariant

/**
 * Validates: Requirements 3.5, 3.2
 */

describe("Property 2: Score calculation range invariant", () => {
  it("finalScore is always in the closed interval [2.0, 5.0] for any non-empty list of valid scores", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.constantFrom("EXCELLENT", "VERY_GOOD", "GOOD", "ACCEPTABLE" as const),
          { minLength: 1 }
        ),
        async (scores) => {
          const items = scores.map((score) => ({ score: score as EvaluationScoreValue }));
          const result = calculateEvaluationScore(items);
          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.data.finalScore).toBeGreaterThanOrEqual(2.0);
            expect(result.data.finalScore).toBeLessThanOrEqual(5.0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: employee-evaluation-system, Property 3: Score calculation arithmetic correctness

/**
 * Validates: Requirements 3.1, 3.2
 */

describe("Property 3: Score calculation arithmetic correctness", () => {
  it("totalScore equals sum of SCORE_POINTS for each score, and finalScore equals totalScore/count rounded to 2dp", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.constantFrom("EXCELLENT", "VERY_GOOD", "GOOD", "ACCEPTABLE" as const),
          { minLength: 1 }
        ),
        async (scores) => {
          const items = scores.map((score) => ({ score: score as EvaluationScoreValue }));
          const result = calculateEvaluationScore(items);

          expect(result.success).toBe(true);
          if (result.success) {
            const expectedTotalScore = scores.reduce(
              (sum, s) => sum + SCORE_POINTS[s as EvaluationScoreValue],
              0
            );
            const expectedFinalScore =
              Math.round((expectedTotalScore / scores.length) * 100) / 100;

            expect(result.data.totalScore).toBe(expectedTotalScore);
            expect(result.data.finalScore).toBe(expectedFinalScore);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: employee-evaluation-system, Property 4: Grade assignment is consistent with final score

/**
 * Validates: Requirements 3.3
 */

describe("Property 4: Grade assignment is consistent with final score", () => {
  it("finalGrade matches the threshold mapping applied to the computed finalScore", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.constantFrom("EXCELLENT", "VERY_GOOD", "GOOD", "ACCEPTABLE" as const),
          { minLength: 1 }
        ),
        async (scores) => {
          const items = scores.map((score) => ({ score: score as EvaluationScoreValue }));
          const result = calculateEvaluationScore(items);

          expect(result.success).toBe(true);
          if (result.success) {
            const { finalScore, finalGrade } = result.data;

            let expectedGrade: string;
            if (finalScore >= 4.5) {
              expectedGrade = "Excellent";
            } else if (finalScore >= 3.5) {
              expectedGrade = "Very Good";
            } else if (finalScore >= 2.5) {
              expectedGrade = "Good";
            } else {
              expectedGrade = "Acceptable";
            }

            expect(finalGrade).toBe(expectedGrade);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
