import { describe, expect, it } from "vitest";
import {
  EMPTY_CAMPAIGN,
  GOALS,
  GOAL_BRIEF,
  MAX_CONTEXT,
  hasContext,
  isGoal,
  sanitizeCampaign,
} from "../campaign";
import { fallbackReactions } from "../fallback";
import { AUDIENCES } from "../audiences";

describe("isGoal", () => {
  it("accepts every declared goal and nothing else", () => {
    for (const g of GOALS) expect(isGoal(g.id)).toBe(true);
    expect(isGoal("conversions")).toBe(false);
    expect(isGoal(7)).toBe(false);
  });
});

describe("GOAL_BRIEF", () => {
  it("describes every goal the UI can select", () => {
    for (const g of GOALS) {
      expect(GOAL_BRIEF[g.id]).toBeTruthy();
    }
  });
});

describe("sanitizeCampaign", () => {
  it("falls back to the empty campaign for junk", () => {
    expect(sanitizeCampaign(null)).toEqual(EMPTY_CAMPAIGN);
    expect(sanitizeCampaign("nope")).toEqual(EMPTY_CAMPAIGN);
    expect(sanitizeCampaign(undefined)).toEqual(EMPTY_CAMPAIGN);
  });

  it("keeps a valid campaign", () => {
    expect(sanitizeCampaign({ context: " 49 EUR/mo ", goal: "signups" })).toEqual({
      context: "49 EUR/mo",
      goal: "signups",
    });
  });

  it("coerces an unknown goal instead of trusting it", () => {
    expect(sanitizeCampaign({ context: "x", goal: "world-domination" }).goal).toBe("engagement");
  });

  it("clamps context that would otherwise bloat the prompt", () => {
    const out = sanitizeCampaign({ context: "x".repeat(5000), goal: "clicks" });
    expect(out.context.length).toBe(MAX_CONTEXT);
  });

  it("ignores a non-string context", () => {
    expect(sanitizeCampaign({ context: { evil: true }, goal: "clicks" }).context).toBe("");
  });
});

describe("hasContext", () => {
  it("treats whitespace as no context", () => {
    expect(hasContext({ context: "   ", goal: "engagement" })).toBe(false);
    expect(hasContext({ context: "a product", goal: "engagement" })).toBe(true);
  });
});

describe("fallbackReactions with context", () => {
  const profile = AUDIENCES[0].profiles.find((p) => p.tone === "numbers")!;
  const copy = "We rebuilt onboarding this quarter.";

  it("counts proof supplied in the context, not just in the post", () => {
    const without = fallbackReactions([profile], copy);
    const withProof = fallbackReactions([profile], copy, {
      context: "Onboarding time fell from 40 minutes to 4.",
      goal: "engagement",
    });
    expect(withProof[0].score).toBeGreaterThan(without[0].score);
  });

  it("counts a free trial named only in the context", () => {
    const meme = AUDIENCES[0].profiles.find((p) => p.engagement === "meme")!;
    const without = fallbackReactions([meme], copy);
    const derisked = fallbackReactions([meme], copy, {
      context: "14-day free trial, no credit card.",
      goal: "engagement",
    });
    expect(derisked[0].score).toBeGreaterThan(without[0].score);
  });

  it("does not let context inflate interest matching", () => {
    // interests describe what they read in the post, not what they were told
    const hit = fallbackReactions([profile], `A post about ${profile.interests[0]}.`);
    const viaContext = fallbackReactions([profile], "A post about nothing.", {
      context: profile.interests.join(", "),
      goal: "engagement",
    });
    expect(viaContext[0].score).toBeLessThan(hit[0].score);
  });

  it("stays deterministic with the same context", () => {
    const c = { context: "49 EUR/mo", goal: "clicks" as const };
    expect(fallbackReactions([profile], copy, c)).toEqual(
      fallbackReactions([profile], copy, c),
    );
  });
});
