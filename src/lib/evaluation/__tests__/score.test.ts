import { describe, it, expect } from "vitest";
import { calculateEvaluationScore } from "../score";

/**
 * Unit tests for ScoreCalculator edge cases
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4
 */

describe("calculateEvaluationScore", () => {
  // Test case 1: Empty array
  it("returns { success: false, error: 'errors.invalidInput' } for an empty array", () => {
    const result = calculateEvaluationScore([]);
    expect(result).toEqual({ success: false, error: "errors.invalidInput" });
  });

  // Test case 2: Single criterion with each score value
  describe("single criterion returns correct grade", () => {
    it("EXCELLENT (5 pts) → finalScore 5.0 → 'Excellent'", () => {
      const result = calculateEvaluationScore([{ score: "EXCELLENT" }]);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.finalScore).toBe(5.0);
        expect(result.data.finalGrade).toBe("Excellent");
      }
    });

    it("VERY_GOOD (4 pts) → finalScore 4.0 → 'Very Good'", () => {
      const result = calculateEvaluationScore([{ score: "VERY_GOOD" }]);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.finalScore).toBe(4.0);
        expect(result.data.finalGrade).toBe("Very Good");
      }
    });

    it("GOOD (3 pts) → finalScore 3.0 → 'Good'", () => {
      const result = calculateEvaluationScore([{ score: "GOOD" }]);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.finalScore).toBe(3.0);
        expect(result.data.finalGrade).toBe("Good");
      }
    });

    it("ACCEPTABLE (2 pts) → finalScore 2.0 → 'Acceptable'", () => {
      const result = calculateEvaluationScore([{ score: "ACCEPTABLE" }]);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.finalScore).toBe(2.0);
        expect(result.data.finalGrade).toBe("Acceptable");
      }
    });
  });

  // Test case 3: Boundary values
  describe("boundary values map to the correct grade", () => {
    // finalScore exactly 4.5 → "Excellent"
    // 9 EXCELLENT (5 pts each = 45) + 1 VERY_GOOD (4 pts) = 49 total / 10 items = 4.9 — not 4.5
    // To get exactly 4.5: need totalScore / count = 4.5
    // e.g. 1 EXCELLENT (5) + 1 GOOD (3) = 8 / 2 = 4.0 — no
    // 9 EXCELLENT (45) + 9 VERY_GOOD (36) = 81 / 18 = 4.5 ✓
    it("finalScore exactly 4.5 → 'Excellent'", () => {
      const items = [
        ...Array(9).fill({ score: "EXCELLENT" as const }),
        ...Array(9).fill({ score: "VERY_GOOD" as const }),
      ];
      const result = calculateEvaluationScore(items);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.finalScore).toBe(4.5);
        expect(result.data.finalGrade).toBe("Excellent");
      }
    });

    // finalScore exactly 3.5 → "Very Good"
    // 1 VERY_GOOD (4) + 1 GOOD (3) = 7 / 2 = 3.5 ✓
    it("finalScore exactly 3.5 → 'Very Good'", () => {
      const items = [
        { score: "VERY_GOOD" as const },
        { score: "GOOD" as const },
      ];
      const result = calculateEvaluationScore(items);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.finalScore).toBe(3.5);
        expect(result.data.finalGrade).toBe("Very Good");
      }
    });

    // finalScore exactly 2.5 → "Good"
    // 1 GOOD (3) + 1 ACCEPTABLE (2) = 5 / 2 = 2.5 ✓
    it("finalScore exactly 2.5 → 'Good'", () => {
      const items = [
        { score: "GOOD" as const },
        { score: "ACCEPTABLE" as const },
      ];
      const result = calculateEvaluationScore(items);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.finalScore).toBe(2.5);
        expect(result.data.finalGrade).toBe("Good");
      }
    });
  });

  // Test case 4: finalScore is rounded to two decimal places
  describe("finalScore is rounded to two decimal places", () => {
    // 2 EXCELLENT (10) + 1 GOOD (3) = 13 / 3 = 4.333... → rounded to 4.33
    it("rounds 4.333... to 4.33", () => {
      const items = [
        { score: "EXCELLENT" as const },
        { score: "EXCELLENT" as const },
        { score: "GOOD" as const },
      ];
      const result = calculateEvaluationScore(items);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.finalScore).toBe(4.33);
      }
    });

    // 1 EXCELLENT (5) + 2 ACCEPTABLE (4) = 9 / 3 = 3.0 — exact, no rounding needed
    // 2 VERY_GOOD (8) + 1 ACCEPTABLE (2) = 10 / 3 = 3.333... → rounded to 3.33
    it("rounds 3.333... to 3.33", () => {
      const items = [
        { score: "VERY_GOOD" as const },
        { score: "VERY_GOOD" as const },
        { score: "ACCEPTABLE" as const },
      ];
      const result = calculateEvaluationScore(items);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.finalScore).toBe(3.33);
      }
    });
  });
});
