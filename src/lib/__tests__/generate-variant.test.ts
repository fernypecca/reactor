import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/llm", () => ({
  complete: vi.fn(),
  completeJSON: vi.fn((opts, validate) => {
    const raw = { variant: "", angle: "Direct & benefit-first" };
    if (validate(raw)) return Promise.resolve(raw);
    return Promise.reject(new Error("schema mismatch"));
  }),
}));

import { fallbackVariant, generateVariant } from "@/lib/generate-variant";
import { completeJSON } from "@/lib/llm";

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
});