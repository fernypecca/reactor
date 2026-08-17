import type { VariantResult } from "./types";

/**
 * Below this gap, the difference between two variants is smaller than the
 * noise you get from re-running the same copy. Calling a winner there would
 * be dressing up a coin flip as a result.
 */
export const DECISIVE_MARGIN = 2;

export type Verdict = {
  best: VariantResult;
  runnerUp?: VariantResult;
  /** absolute point gap between the two, 0 when there is only one variant */
  margin: number;
  /** false when the gap is inside the noise floor */
  decisive: boolean;
};

export function verdictFor(
  variants: VariantResult[],
  bestVariantId: string,
): Verdict | null {
  const best = variants.find((v) => v.variantId === bestVariantId) ?? variants[0];
  if (!best) return null;

  const runnerUp = variants.find((v) => v.variantId !== best.variantId);
  if (!runnerUp) {
    return { best, margin: 0, decisive: true };
  }

  const margin = Math.round(Math.abs(best.avgScore - runnerUp.avgScore) * 10) / 10;
  return { best, runnerUp, margin, decisive: margin >= DECISIVE_MARGIN };
}
