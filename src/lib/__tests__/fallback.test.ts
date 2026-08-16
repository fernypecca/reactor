import { describe, expect, it } from "vitest";
import { fallbackReactions } from "@/lib/fallback";
import { AUDIENCES } from "@/lib/audiences";

const audience = AUDIENCES[0];

describe("fallbackReactions", () => {
  it("returns one reaction per profile", () => {
    const copy = "Launching a new pricing calculator for bootstrappers";
    const reactions = fallbackReactions(audience.profiles, copy);
    expect(reactions.length).toBe(audience.profiles.length);
  });

  it("is deterministic for the same copy", () => {
    const copy = "Launching a new pricing calculator";
    expect(fallbackReactions(audience.profiles, copy)).toEqual(
      fallbackReactions(audience.profiles, copy),
    );
  });

  it("scores between 0 and 100 with non-empty comments", () => {
    const reactions = fallbackReactions(audience.profiles, "AI agents for growth teams");
    for (const r of reactions) {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
      expect(r.comment.length).toBeGreaterThan(0);
      expect(r.name.length).toBeGreaterThan(0);
      expect(r.handle.length).toBeGreaterThan(0);
    }
  });

  it("uses the profile objection for low scores and none for high scores", () => {
    const reactions = fallbackReactions(audience.profiles, "unrelated fluff");
    const low = reactions.filter((r) => r.score < 50);
    expect(low.every((r) => r.objection.length > 0)).toBe(true);
  });
});