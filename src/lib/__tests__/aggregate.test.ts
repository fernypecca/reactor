import { describe, expect, it } from "vitest";
import {
  avgScore,
  buildVariantResult,
  objectionClusters,
  pickBestVariant,
  segmentScores,
} from "@/lib/aggregate";
import type { Reaction } from "@/lib/types";

const reactions: Reaction[] = [
  { followerId: "a", name: "A", handle: "@a", segment: "builder", score: 90, comment: "love it", objection: "" },
  { followerId: "b", name: "B", handle: "@b", segment: "builder", score: 40, comment: "meh", objection: "What does it cost per month, really?" },
  { followerId: "c", name: "C", handle: "@c", segment: "operator", score: 60, comment: "ok", objection: "Show me the revenue number." },
  { followerId: "d", name: "D", handle: "@d", segment: "operator", score: 30, comment: "no", objection: "What does it cost per month?" },
];

describe("aggregate", () => {
  it("avgScore rounds to one decimal", () => {
    expect(avgScore(reactions)).toBe(55);
  });

  it("objectionClusters groups by keyword, sorted desc, capped at 3 examples", () => {
    const clusters = objectionClusters(reactions);
    expect(clusters[0].objection).toBe("pricing");
    expect(clusters[0].count).toBe(2);
    expect(clusters[0].examples.length).toBe(2);
    expect(clusters[1].objection).toBe("proof");
  });

  it("segmentScores averages per segment", () => {
    const segs = segmentScores(reactions);
    expect(segs.find((s) => s.segment === "builder")?.avg).toBe(65);
    expect(segs.find((s) => s.segment === "operator")?.avg).toBe(45);
  });

  it("pickBestVariant returns highest avg, ties to first", () => {
    expect(
      pickBestVariant([
        { variantId: "v1", copy: "", reactions, avgScore: 55, objectionClusters: [], segmentScores: [] },
        { variantId: "v2", copy: "", reactions, avgScore: 70, objectionClusters: [], segmentScores: [] },
      ]),
    ).toBe("v2");
    expect(
      pickBestVariant([
        { variantId: "v1", copy: "", reactions, avgScore: 55, objectionClusters: [], segmentScores: [] },
        { variantId: "v2", copy: "", reactions, avgScore: 55, objectionClusters: [], segmentScores: [] },
      ]),
    ).toBe("v1");
  });

  it("buildVariantResult assembles a full result", () => {
    const v = buildVariantResult("v1", "my copy", reactions);
    expect(v.variantId).toBe("v1");
    expect(v.copy).toBe("my copy");
    expect(v.avgScore).toBe(55);
    expect(v.objectionClusters.length).toBeGreaterThan(0);
    expect(v.segmentScores.length).toBe(2);
  });
});