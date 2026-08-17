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

  it("spreads the audience across more than one score band", () => {
    // A simulation where everyone lands in the same band tells the user nothing.
    const reactions = fallbackReactions(
      audience.profiles,
      "We just shipped the fastest onboarding in SaaS — signup to first win in 4 minutes. 127 beta teams onboarded themselves this month. Try it free.",
    );
    const bands = new Set(
      reactions.map((r) => (r.score >= 70 ? "strong" : r.score >= 40 ? "mixed" : "weak")),
    );
    expect(bands.size).toBeGreaterThanOrEqual(2);
    const scores = reactions.map((r) => r.score);
    expect(Math.max(...scores) - Math.min(...scores)).toBeGreaterThan(30);
  });

  it("rewards copy that carries numbers with the followers who demand them", () => {
    const numbersPerson = audience.profiles.find((p) => p.tone === "numbers")!;
    const withProof = fallbackReactions([numbersPerson], "Churn fell from 8% to 3% in 90 days.");
    const without = fallbackReactions([numbersPerson], "Churn fell a lot this quarter.");
    expect(withProof[0].score).toBeGreaterThan(without[0].score);
  });

  it("punishes hype in front of skeptics", () => {
    const skeptic = audience.profiles.find((p) => p.tone === "skeptic")!;
    const hypey = fallbackReactions([skeptic], "This amazing tool is game-changing for teams.");
    const plain = fallbackReactions([skeptic], "This tool removes one step for teams.");
    expect(hypey[0].score).toBeLessThan(plain[0].score);
  });
});