import { afterEach, describe, expect, it, vi } from "vitest";

const captured: { system: string; prompt: string }[] = [];
let respond: (opts: { prompt: string }) => unknown = () => [];

vi.mock("@/lib/llm", () => ({
  complete: vi.fn(),
  hasModel: vi.fn(() => true),
  completeJSON: vi.fn((opts: { system: string; prompt: string }, validate: (v: unknown) => boolean) => {
    captured.push({ system: opts.system, prompt: opts.prompt });
    const raw = respond(opts);
    if (validate(raw)) return Promise.resolve(raw);
    return Promise.reject(new Error("schema mismatch"));
  }),
}));

import { simulateVariant } from "@/lib/simulate";
import { hasModel } from "@/lib/llm";
import type { FollowerProfile } from "@/lib/types";

const profiles: FollowerProfile[] = [
  {
    id: "aud-builder-0",
    name: "Mara Delgado",
    handle: "@marabuilds",
    bio: "Bootstrapped to $10k MRR.",
    interests: ["pricing", "indie web"],
    tone: "numbers",
    engagement: "thread",
    objection: "Show the revenue.",
    segment: "builder",
  },
  {
    id: "aud-builder-1",
    name: "Ivan Petrov",
    handle: "@ivanships",
    bio: "Solopreneur, 6 products.",
    interests: ["launch"],
    tone: "skeptic",
    engagement: "short",
    objection: "How many customers?",
    segment: "builder",
  },
];

const answer = (ids: string[]) =>
  ids.map((id) => ({ followerId: id, score: 80, comment: "sharp", objection: "" }));

afterEach(() => vi.mocked(hasModel).mockReturnValue(true));

describe("simulateVariant prompt", () => {
  it("sends every follower id, or the model cannot answer with one", () => {
    captured.length = 0;
    respond = () => answer(profiles.map((p) => p.id));
    return simulateVariant(profiles, "some copy", () => {}).then(() => {
      const prompt = captured[0].prompt;
      for (const p of profiles) expect(prompt).toContain(p.id);
    });
  });

  it("tells the model to copy the id verbatim", () => {
    captured.length = 0;
    respond = () => answer(profiles.map((p) => p.id));
    return simulateVariant(profiles, "copy", () => {}).then(() => {
      expect(captured[0].system).toMatch(/followerId MUST be copied verbatim/i);
    });
  });

  it("includes the context and goal when a campaign is supplied", () => {
    captured.length = 0;
    respond = () => answer(profiles.map((p) => p.id));
    return simulateVariant(profiles, "copy", () => {}, {
      context: "29 EUR/mo, free trial",
      goal: "signups",
    }).then(() => {
      expect(captured[0].prompt).toContain("29 EUR/mo, free trial");
      expect(captured[0].prompt).toMatch(/sign up or start a trial/i);
    });
  });
});

describe("simulateVariant matching", () => {
  it("uses the LLM answer when ids come back correctly", async () => {
    respond = () => answer(profiles.map((p) => p.id));
    const out = await simulateVariant(profiles, "copy", () => {});
    expect(out).toHaveLength(2);
    expect(out.every((r) => r.comment === "sharp")).toBe(true);
  });

  it("accepts a handle where the id was asked for, rather than binning the batch", async () => {
    respond = () => answer(profiles.map((p) => p.handle));
    const out = await simulateVariant(profiles, "copy", () => {});
    expect(out).toHaveLength(2);
    expect(out.every((r) => r.comment === "sharp")).toBe(true);
    // ids must be normalised back to the real profile ids
    expect(out.map((r) => r.followerId).sort()).toEqual(["aud-builder-0", "aud-builder-1"]);
  });

  it("falls back only when the answer really is unusable", async () => {
    respond = () => answer(["who-even-is-this", "nope"]);
    const out = await simulateVariant(profiles, "copy", () => {});
    expect(out).toHaveLength(2);
    // fallback comments carry the profile's own objection, not the LLM text
    expect(out.every((r) => r.comment !== "sharp")).toBe(true);
  });

  it("never emits the same follower twice", async () => {
    respond = () => answer([profiles[0].id, profiles[0].id, profiles[1].id]);
    const out = await simulateVariant(profiles, "copy", () => {});
    expect(new Set(out.map((r) => r.followerId)).size).toBe(out.length);
  });

  it("reports every follower exactly once overall", async () => {
    respond = () => answer(profiles.map((p) => p.id));
    const out = await simulateVariant(profiles, "copy", () => {});
    expect(out.map((r) => r.followerId).sort()).toEqual(profiles.map((p) => p.id).sort());
  });

  it("skips the LLM entirely when no model is configured", async () => {
    vi.mocked(hasModel).mockReturnValue(false);
    captured.length = 0;
    const out = await simulateVariant(profiles, "copy", () => {});
    // the fallback answers in the followers' own voice, never the mock's "sharp"
    expect(captured).toHaveLength(0);
    expect(out).toHaveLength(2);
    expect(out.every((r) => r.comment !== "sharp")).toBe(true);
  });
});
