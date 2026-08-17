import { describe, expect, it } from "vitest";
import { assembleAudience, splitCount, type AudienceBrief } from "../generate-audience";
import { buildGraph } from "../graph";

const brief: AudienceBrief = {
  name: "Wedding Photographers",
  description: "Freelance photographers who book 20-30 weddings a year.",
  segments: [
    { id: "veteran", label: "Veteran", brief: "Booked out, allergic to gimmicks." },
    { id: "rising", label: "Rising", brief: "Two seasons in, hungry for leads." },
  ],
};

const follower = (n: number) => ({
  name: `Person ${n}`,
  handle: `@person${n}`,
  bio: `Shoots weddings, run number ${n}.`,
  interests: ["weddings", "lighting", "pricing"],
  tone: "numbers",
  engagement: "short",
  objection: "Does this actually book me clients?",
});

describe("splitCount", () => {
  it("splits evenly when it divides", () => {
    expect(splitCount(9, 3)).toEqual([3, 3, 3]);
  });

  it("gives the remainder to the earliest segments", () => {
    expect(splitCount(26, 3)).toEqual([9, 9, 8]);
    expect(splitCount(10, 3)).toEqual([4, 3, 3]);
  });

  it("always sums to the target", () => {
    for (const [total, segs] of [
      [26, 3],
      [17, 4],
      [8, 3],
      [5, 5],
    ]) {
      expect(splitCount(total, segs).reduce((a, b) => a + b, 0)).toBe(total);
    }
  });

  it("returns nothing for zero segments", () => {
    expect(splitCount(26, 0)).toEqual([]);
  });
});

describe("assembleAudience", () => {
  const bySegment = [
    { segment: brief.segments[0], followers: [follower(1), follower(2)] },
    { segment: brief.segments[1], followers: [follower(3), follower(4)] },
  ];

  it("gives every follower a unique, segment-scoped id", () => {
    const a = assembleAudience("custom-x", brief, bySegment);
    expect(a.profiles).toHaveLength(4);
    expect(new Set(a.profiles.map((p) => p.id)).size).toBe(4);
    expect(a.profiles[0].id).toBe("custom-x-veteran-0");
    expect(a.profiles[2].id).toBe("custom-x-rising-0");
  });

  it("tags each follower with its own segment", () => {
    const a = assembleAudience("custom-x", brief, bySegment);
    expect(a.profiles.filter((p) => p.segment === "veteran")).toHaveLength(2);
    expect(a.profiles.filter((p) => p.segment === "rising")).toHaveLength(2);
  });

  it("carries the segment labels through", () => {
    const a = assembleAudience("custom-x", brief, bySegment);
    expect(a.segments).toEqual([
      { id: "veteran", label: "Veteran" },
      { id: "rising", label: "Rising" },
    ]);
  });

  it("drops a handle the model reused across parallel segments", () => {
    const clashing = [
      { segment: brief.segments[0], followers: [follower(1), follower(2)] },
      { segment: brief.segments[1], followers: [follower(1), follower(3)] },
    ];
    const a = assembleAudience("custom-x", brief, clashing);
    expect(a.profiles).toHaveLength(3);
    expect(new Set(a.profiles.map((p) => p.handle)).size).toBe(3);
  });

  it("skips malformed follower entries without failing the batch", () => {
    const messy = [
      { segment: brief.segments[0], followers: [follower(1), null, "nope", follower(2)] },
    ];
    const a = assembleAudience("custom-x", brief, messy);
    expect(a.profiles).toHaveLength(2);
  });

  it("throws when nothing usable came back", () => {
    expect(() =>
      assembleAudience("custom-x", brief, [{ segment: brief.segments[0], followers: [null] }]),
    ).toThrow();
  });

  it("produces an audience the graph can lay out", () => {
    const a = assembleAudience("custom-x", brief, bySegment);
    const g = buildGraph(a);
    expect(g.nodes).toHaveLength(a.profiles.length);
    expect(g.clusters).toHaveLength(2);
    for (const n of g.nodes) {
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.x).toBeLessThanOrEqual(1);
    }
  });
});
