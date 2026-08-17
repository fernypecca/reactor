import { describe, expect, it } from "vitest";
import {
  MAX_PROFILES,
  isEngagement,
  isTone,
  normalizeHandle,
  sanitizeProfiles,
  segmentsFromProfiles,
  slugify,
} from "../audience-schema";

const valid = (over: Record<string, unknown> = {}) => ({
  id: "a-1",
  name: "Mara Delgado",
  handle: "@marabuilds",
  bio: "Bootstrapped to $10k MRR.",
  interests: ["pricing", "indie web"],
  tone: "numbers",
  engagement: "thread",
  objection: "Show the revenue.",
  segment: "builder",
  ...over,
});

describe("normalizeHandle", () => {
  it("adds the @ and lowercases", () => {
    expect(normalizeHandle("MaraBuilds")).toBe("@marabuilds");
  });

  it("collapses repeated @ and strips punctuation", () => {
    expect(normalizeHandle("@@mara.builds!")).toBe("@marabuilds");
  });

  it("returns empty for a handle with nothing usable", () => {
    expect(normalizeHandle("!!!")).toBe("");
    expect(normalizeHandle(42)).toBe("");
  });
});

describe("slugify", () => {
  it("kebab-cases a label", () => {
    expect(slugify("Early Adopter", "x")).toBe("early-adopter");
  });

  it("falls back when nothing survives", () => {
    expect(slugify("!!!", "segment-1")).toBe("segment-1");
  });
});

describe("isTone / isEngagement", () => {
  it("accepts only the known values", () => {
    expect(isTone("skeptic")).toBe(true);
    expect(isTone("angry")).toBe(false);
    expect(isEngagement("meme")).toBe(true);
    expect(isEngagement("video")).toBe(false);
  });
});

describe("sanitizeProfiles", () => {
  it("accepts a well-formed list", () => {
    const out = sanitizeProfiles([valid()]);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.profiles[0].handle).toBe("@marabuilds");
  });

  it("rejects anything that is not an array", () => {
    expect(sanitizeProfiles({}).ok).toBe(false);
    expect(sanitizeProfiles(null).ok).toBe(false);
  });

  it("rejects a list longer than the cap", () => {
    const many = Array.from({ length: MAX_PROFILES + 1 }, (_, i) =>
      valid({ id: `a-${i}`, handle: `@u${i}` }),
    );
    const out = sanitizeProfiles(many);
    expect(out).toEqual({ ok: false, error: "too-many" });
  });

  it("rejects duplicate ids so reaction mapping cannot silently break", () => {
    const out = sanitizeProfiles([valid(), valid({ handle: "@other" })]);
    expect(out).toEqual({ ok: false, error: "duplicate-ids" });
  });

  it("drops entries missing a required field", () => {
    const out = sanitizeProfiles([valid(), valid({ id: "a-2", name: "" })]);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.profiles).toHaveLength(1);
  });

  it("drops entries with no usable interests", () => {
    const out = sanitizeProfiles([valid({ interests: [] })]);
    expect(out).toEqual({ ok: false, error: "empty" });
  });

  it("clamps long free text instead of rejecting it", () => {
    const out = sanitizeProfiles([valid({ bio: "x".repeat(5000) })]);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.profiles[0].bio.length).toBeLessThanOrEqual(200);
  });

  it("caps the number of interests", () => {
    const out = sanitizeProfiles([
      valid({ interests: ["a", "b", "c", "d", "e", "f", "g", "h"] }),
    ]);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.profiles[0].interests.length).toBeLessThanOrEqual(6);
  });

  it("coerces unknown tone and engagement to safe defaults", () => {
    const out = sanitizeProfiles([valid({ tone: "furious", engagement: "livestream" })]);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.profiles[0].tone).toBe("questioner");
      expect(out.profiles[0].engagement).toBe("short");
    }
  });

  it("preserves ids exactly, since the client maps reactions by them", () => {
    const out = sanitizeProfiles([valid({ id: "custom-abc-builder-0" })]);
    if (out.ok) expect(out.profiles[0].id).toBe("custom-abc-builder-0");
  });
});

describe("segmentsFromProfiles", () => {
  it("lists each segment once, in first-seen order", () => {
    const out = sanitizeProfiles([
      valid({ id: "1", handle: "@a", segment: "builder" }),
      valid({ id: "2", handle: "@b", segment: "lurker" }),
      valid({ id: "3", handle: "@c", segment: "builder" }),
    ]);
    if (!out.ok) throw new Error("expected ok");
    expect(segmentsFromProfiles(out.profiles).map((s) => s.id)).toEqual([
      "builder",
      "lurker",
    ]);
  });

  it("uses supplied labels when available", () => {
    const out = sanitizeProfiles([valid()]);
    if (!out.ok) throw new Error("expected ok");
    const segs = segmentsFromProfiles(out.profiles, new Map([["builder", "Builder"]]));
    expect(segs[0].label).toBe("Builder");
  });
});
