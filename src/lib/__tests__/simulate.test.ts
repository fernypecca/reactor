import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/llm", () => ({
  complete: vi.fn(),
  completeJSON: vi.fn(),
}));

import { simulateVariant } from "@/lib/simulate";
import { completeJSON } from "@/lib/llm";
import { AUDIENCES } from "@/lib/audiences";
import type { Reaction } from "@/lib/types";

const audience = AUDIENCES[0];

function fakeReaction(p: { id: string; name: string; handle: string; segment: string }): Reaction {
  return {
    followerId: p.id,
    name: p.name,
    handle: p.handle,
    segment: p.segment,
    score: 80,
    comment: "solid",
    objection: "",
  };
}

describe("simulateVariant", () => {
  it("calls the LLM once per 10-profile batch and returns all reactions", async () => {
    vi.mocked(completeJSON).mockImplementation(async (_opts, _validate) =>
      audience.profiles.slice(0, 10).map((p) => fakeReaction(p)),
    );

    const reactions = await simulateVariant(audience.profiles, "Launch copy here", () => {});
    expect(vi.mocked(completeJSON)).toHaveBeenCalledTimes(Math.ceil(audience.profiles.length / 10));
    expect(reactions.length).toBe(audience.profiles.length);
  });

  it("falls back per batch when the LLM fails", async () => {
    vi.mocked(completeJSON).mockRejectedValue(new Error("api down"));

    const reactions = await simulateVariant(audience.profiles, "Launch copy here", () => {});
    expect(reactions.length).toBe(audience.profiles.length);
    expect(reactions.every((r) => r.comment.length > 0)).toBe(true);
  });

  it("never duplicates a follower", async () => {
    vi.mocked(completeJSON).mockRejectedValue(new Error("api down"));
    const reactions = await simulateVariant(audience.profiles, "Launch copy here", () => {});
    const ids = reactions.map((r) => r.followerId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});