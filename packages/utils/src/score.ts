import { MATCH_SCORE_THRESHOLDS } from "@hireflow/config";

export type MatchRecommendation = "strong_match" | "good_match" | "partial_match" | "poor_match";

export function scoreToRecommendation(score: number): MatchRecommendation {
  if (score >= MATCH_SCORE_THRESHOLDS.STRONG_MATCH) return "strong_match";
  if (score >= MATCH_SCORE_THRESHOLDS.GOOD_MATCH) return "good_match";
  if (score >= MATCH_SCORE_THRESHOLDS.PARTIAL_MATCH) return "partial_match";
  return "poor_match";
}

export function weightedAverage(
  scores: { value: number; weight: number }[]
): number {
  const totalWeight = scores.reduce((sum, s) => sum + s.weight, 0);
  if (totalWeight === 0) return 0;
  const weighted = scores.reduce((sum, s) => sum + s.value * s.weight, 0);
  return Math.round(weighted / totalWeight);
}

export function jaccardSimilarity(setA: string[], setB: string[]): number {
  const a = new Set(setA.map((s) => s.toLowerCase()));
  const b = new Set(setB.map((s) => s.toLowerCase()));
  const intersection = new Set([...a].filter((x) => b.has(x)));
  const union = new Set([...a, ...b]);
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}
