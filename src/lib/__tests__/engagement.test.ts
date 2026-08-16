import { describe, expect, it } from "vitest";
import { engagementFromReaction, sumEngagement } from "@/lib/engagement";

describe("engagementFromReaction", () => {
  it("maps low score to a minimal ripple", () => {
    const e = engagementFromReaction({ score: 10 });
    expect(e.likes).toBe(18);
    expect(e.replies).toBe(0);
    expect(e.reposts).toBe(0);
    expect(e.impressions).toBe(216);
  });

  it("mid score gets replies", () => {
    const e = engagementFromReaction({ score: 70 });
    expect(e.likes).toBe(126);
    expect(e.replies).toBe(1);
    expect(e.reposts).toBe(0);
    expect(e.impressions).toBe(1512);
  });

  it("high score gets a repost", () => {
    const e = engagementFromReaction({ score: 92 });
    expect(e.likes).toBe(166);
    expect(e.replies).toBe(2);
    expect(e.reposts).toBe(1);
    expect(e.impressions).toBe(1992);
  });

  it("is monotonic across the full range", () => {
    for (let s = 1; s < 100; s++) {
      const a = engagementFromReaction({ score: s });
      const b = engagementFromReaction({ score: s + 1 });
      expect(b.likes).toBeGreaterThanOrEqual(a.likes);
      expect(b.impressions).toBeGreaterThanOrEqual(a.impressions);
    }
  });

  it("stays in bounds at the extremes", () => {
    expect(engagementFromReaction({ score: 0 }).likes).toBe(0);
    const top = engagementFromReaction({ score: 100 });
    expect(top.likes).toBe(180);
    expect(top.impressions).toBe(2160);
    expect(top.replies).toBeGreaterThanOrEqual(2);
  });
});

describe("sumEngagement", () => {
  it("aggregates a list", () => {
    const total = sumEngagement([
      { likes: 80, replies: 0, reposts: 0, impressions: 960 },
      { likes: 126, replies: 1, reposts: 0, impressions: 1512 },
    ]);
    expect(total).toEqual({ likes: 206, replies: 1, reposts: 0, impressions: 2472 });
  });

  it("returns zeros for an empty list", () => {
    expect(sumEngagement([])).toEqual({ likes: 0, replies: 0, reposts: 0, impressions: 0 });
  });
});