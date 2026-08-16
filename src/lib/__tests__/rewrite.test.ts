import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/llm", () => ({
  complete: vi.fn(),
  completeJSON: vi.fn((opts, validate) => {
    // Simulate completeJSON calling complete() then validating
    const raw = { rewrite: "", why: "x" }; // simulated LLM response
    if (validate(raw)) return Promise.resolve(raw);
    // After 3 attempts, throw
    return Promise.reject(new Error("schema mismatch"));
  }),
}));

import { rewriteVariant } from "@/lib/rewrite";
import { completeJSON } from "@/lib/llm";
import type { VariantResult } from "@/lib/types";

const variants: VariantResult[] = [
  {
    variantId: "v1",
    copy: "We launch the fastest onboarding in SaaS.",
    reactions: [],
    avgScore: 60,
    objectionClusters: [],
    segmentScores: [],
  },
  {
    variantId: "v2",
    copy: "Onboard 3x faster, or it's free for a month.",
    reactions: [],
    avgScore: 82,
    objectionClusters: [],
    segmentScores: [],
  },
];

describe("rewriteVariant", () => {
  it("returns a rewrite and a reason", async () => {
    vi.mocked(completeJSON).mockResolvedValue({
      rewrite: "Onboard 3x faster. If not, the first month is on us.",
      why: "It keeps the number and adds risk reversal.",
    });

    const out = await rewriteVariant(variants);
    expect(out.rewrite.length).toBeGreaterThan(0);
    expect(out.why.length).toBeGreaterThan(0);
  });

  it("falls back to the best variant copy on LLM failure", async () => {
    vi.mocked(completeJSON).mockRejectedValue(new Error("boom"));
    const out = await rewriteVariant(variants);
    expect(out.rewrite).toBe(variants[1].copy);
    expect(out.why.length).toBeGreaterThan(0);
  });

  it("returns empty result when variants array is empty", async () => {
    vi.mocked(completeJSON).mockResolvedValue({ rewrite: "x", why: "y" });
    const out = await rewriteVariant([]);
    expect(out).toEqual({ rewrite: "", why: "No variants to rewrite." });
  });

  it("treats empty rewrite string as invalid and falls back to best variant", async () => {
    vi.mocked(completeJSON).mockResolvedValue({ rewrite: "", why: "x" });
    const out = await rewriteVariant(variants);
    expect(out.rewrite).toBe(variants[1].copy);
    expect(out.why.length).toBeGreaterThan(0);
  });
});