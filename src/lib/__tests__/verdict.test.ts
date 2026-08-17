import { describe, expect, it } from "vitest";
import { DECISIVE_MARGIN, verdictFor } from "../verdict";
import type { VariantResult } from "../types";

const variant = (id: string, avgScore: number): VariantResult => ({
  variantId: id,
  copy: `copy ${id}`,
  reactions: [],
  avgScore,
  objectionClusters: [],
  segmentScores: [],
  engagement: { likes: 0, replies: 0, reposts: 0, impressions: 0 },
});

describe("verdictFor", () => {
  it("returns null when there are no variants", () => {
    expect(verdictFor([], "variant-1")).toBeNull();
  });

  it("treats a single variant as decisive with no margin", () => {
    const v = verdictFor([variant("variant-1", 71)], "variant-1")!;
    expect(v.best.variantId).toBe("variant-1");
    expect(v.runnerUp).toBeUndefined();
    expect(v.margin).toBe(0);
    expect(v.decisive).toBe(true);
  });

  it("reports the gap between two variants", () => {
    const v = verdictFor([variant("variant-1", 61.2), variant("variant-2", 74.8)], "variant-2")!;
    expect(v.best.variantId).toBe("variant-2");
    expect(v.runnerUp?.variantId).toBe("variant-1");
    expect(v.margin).toBe(13.6);
    expect(v.decisive).toBe(true);
  });

  it("refuses to call a winner inside the noise floor", () => {
    const v = verdictFor([variant("variant-1", 68.1), variant("variant-2", 68.4)], "variant-2")!;
    expect(v.margin).toBe(0.3);
    expect(v.decisive).toBe(false);
  });

  it("treats exactly the threshold as decisive", () => {
    const v = verdictFor(
      [variant("variant-1", 60), variant("variant-2", 60 + DECISIVE_MARGIN)],
      "variant-2",
    )!;
    expect(v.decisive).toBe(true);
  });

  it("falls back to the first variant when the id is unknown", () => {
    const v = verdictFor([variant("variant-1", 50), variant("variant-2", 90)], "nope")!;
    expect(v.best.variantId).toBe("variant-1");
    expect(v.margin).toBe(40);
  });

  it("never reports a negative margin", () => {
    const v = verdictFor([variant("variant-1", 90), variant("variant-2", 40)], "variant-2")!;
    expect(v.margin).toBeGreaterThan(0);
  });
});
