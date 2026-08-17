import { describe, expect, it } from "vitest";
import {
  avgScore,
  buildVariantResult,
  clusterFor,
  objectionClusters,
  pickBestVariant,
  segmentScores,
} from "@/lib/aggregate";
import { AUDIENCES } from "@/lib/audiences";
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

  it("counts every follower in a cluster even past the 3 shown examples", () => {
    const many: Reaction[] = Array.from({ length: 7 }, (_, i) => ({
      followerId: `p${i}`,
      name: `P${i}`,
      handle: `@p${i}`,
      segment: "builder",
      score: 30,
      comment: "no",
      objection: `What does it cost, question ${i}?`,
    }));
    const [cluster] = objectionClusters(many);
    expect(cluster.objection).toBe("pricing");
    expect(cluster.count).toBe(7);
    expect(cluster.examples.length).toBe(3);
  });

  it("routes the objections the demo audiences actually raise", () => {
    const cases: [string, string][] = [
      ["What does it cost per month?", "pricing"],
      ["Is it a one-time payment?", "pricing"],
      ["How many customers actually use this?", "proof"],
      ["Whats the retention number?", "proof"],
      ["Show me the ROI.", "proof"],
      ["Does it integrate with HubSpot?", "scope"],
      ["Does this save my team hours or is it a toy?", "scope"],
      ["Who is the target user?", "scope"],
      ["Where does the data actually live?", "trust"],
      ["Another AI tool. Whats different?", "scope"],
    ];
    for (const [text, expected] of cases) {
      expect([text, clusterFor(text)]).toEqual([text, expected]);
    }
  });

  it("keeps the catch-all bucket from swallowing a real audience", () => {
    const objections = AUDIENCES.flatMap((a) => a.profiles.map((p) => p.objection));
    const other = objections.filter((o) => clusterFor(o) === "other").length;
    expect(other / objections.length).toBeLessThan(0.2);
  });

  it("ignores reactions with no objection", () => {
    const clusters = objectionClusters([
      { followerId: "x", name: "X", handle: "@x", segment: "builder", score: 95, comment: "yes", objection: "" },
    ]);
    expect(clusters).toEqual([]);
  });

  it("segmentScores averages per segment", () => {
    const segs = segmentScores(reactions);
    expect(segs.find((s) => s.segment === "builder")?.avg).toBe(65);
    expect(segs.find((s) => s.segment === "operator")?.avg).toBe(45);
  });

  it("pickBestVariant returns highest avg, ties to first", () => {
    expect(
      pickBestVariant([
        { variantId: "v1", copy: "", reactions, avgScore: 55, objectionClusters: [], segmentScores: [], engagement: { likes: 0, replies: 0, reposts: 0, impressions: 0 } },
        { variantId: "v2", copy: "", reactions, avgScore: 70, objectionClusters: [], segmentScores: [], engagement: { likes: 0, replies: 0, reposts: 0, impressions: 0 } },
      ]),
    ).toBe("v2");
    expect(
      pickBestVariant([
        { variantId: "v1", copy: "", reactions, avgScore: 55, objectionClusters: [], segmentScores: [], engagement: { likes: 0, replies: 0, reposts: 0, impressions: 0 } },
        { variantId: "v2", copy: "", reactions, avgScore: 55, objectionClusters: [], segmentScores: [], engagement: { likes: 0, replies: 0, reposts: 0, impressions: 0 } },
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
    expect(v.engagement.likes).toBeGreaterThan(0);
  });
});