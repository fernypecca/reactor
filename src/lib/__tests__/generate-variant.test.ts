import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/llm", () => ({
  complete: vi.fn(),
  hasModel: vi.fn(() => true),
  completeJSON: vi.fn((opts, validate) => {
    const raw = { variant: "", angle: "Direct & benefit-first" };
    if (validate(raw)) return Promise.resolve(raw);
    return Promise.reject(new Error("schema mismatch"));
  }),
}));

import { fallbackVariant, generateVariant } from "@/lib/generate-variant";
import { completeJSON, hasModel } from "@/lib/llm";

const COPY =
  "We just shipped the fastest onboarding in SaaS. New users go from signup to first win in 4 minutes. Try it free.";

describe("fallbackVariant", () => {
  it("is deterministic and non-empty", () => {
    const a = fallbackVariant(COPY);
    const b = fallbackVariant(COPY);
    expect(a).toEqual(b);
    expect(a.variant.length).toBeGreaterThan(0);
    expect(a.angle.length).toBeGreaterThan(0);
  });

  it("handles short copy", () => {
    const out = fallbackVariant("Ship faster.");
    expect(out.variant.length).toBeGreaterThan(0);
  });

  it("produces copy that actually differs from the original", () => {
    // A fallback that echoes the input makes the A/B comparison meaningless.
    expect(fallbackVariant(COPY).variant).not.toBe(COPY);
  });

  it("leads with the sentence carrying the hardest number", () => {
    expect(fallbackVariant(COPY).variant.startsWith("New users go from signup")).toBe(true);
    expect(fallbackVariant(COPY).angle).toBe("Proof-first");
  });

  it("keeps every sentence of the original", () => {
    const out = fallbackVariant(COPY);
    for (const sentence of COPY.split(/(?<=[.!?])\s+/)) {
      expect(out.variant).toContain(sentence.trim());
    }
  });

  it("leads with the closing line when the copy has no numbers", () => {
    const noNumbers = "We rebuilt onboarding. It is simpler now. Try it free.";
    const out = fallbackVariant(noNumbers);
    expect(out.variant.startsWith("Try it free.")).toBe(true);
    expect(out.angle).toBe("Outcome-first");
  });
});

describe("generateVariant", () => {
  it("falls back when the LLM fails", async () => {
    vi.mocked(completeJSON).mockRejectedValue(new Error("boom"));
    const out = await generateVariant(COPY);
    expect(out.variant.length).toBeGreaterThan(0);
    expect(out.angle.length).toBeGreaterThan(0);
  });

  it("returns the LLM result when valid", async () => {
    vi.mocked(completeJSON).mockResolvedValue({
      variant: "4 minutes to first win. Or your first month is on us.",
      angle: "Loss aversion",
    });
    const out = await generateVariant(COPY);
    expect(out.variant).toBe("4 minutes to first win. Or your first month is on us.");
    expect(out.angle).toBe("Loss aversion");
  });

  it("falls back when the LLM returns an empty variant", async () => {
    vi.mocked(completeJSON).mockResolvedValue({
      variant: "",
      angle: "Direct & benefit-first",
    });
    const out = await generateVariant(COPY);
    expect(out.variant.length).toBeGreaterThan(0);
  });

  it("skips the model and uses the fallback variant when no key is set", async () => {
    vi.mocked(hasModel).mockReturnValue(false);
    vi.mocked(completeJSON).mockClear();
    const out = await generateVariant(COPY);
    expect(out).toEqual(fallbackVariant(COPY));
    expect(vi.mocked(completeJSON)).not.toHaveBeenCalled();
  });
});