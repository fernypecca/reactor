import { describe, expect, it } from "vitest";
import { AUDIENCES, expandAudience } from "@/lib/audiences";

describe("audiences", () => {
  it("has three demo audiences", () => {
    expect(AUDIENCES.map((a) => a.id)).toEqual([
      "indie-hackers",
      "saas-founders",
      "ai-enthusiasts",
    ]);
  });

  it("each audience has a profile for every declared segment", () => {
    for (const audience of AUDIENCES) {
      for (const seg of audience.segments) {
        expect(audience.profiles.some((p) => p.segment === seg.id)).toBe(true);
      }
    }
  });

  it("expands to the declared profile count with unique ids", () => {
    for (const audience of AUDIENCES) {
      const ids = audience.profiles.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(audience.profiles.length).toBeGreaterThanOrEqual(24);
    }
  });

  it("every profile is fully populated", () => {
    for (const audience of AUDIENCES) {
      for (const p of audience.profiles) {
        expect(p.handle.length).toBeGreaterThan(0);
        expect(p.name.length).toBeGreaterThan(0);
        expect(p.bio.length).toBeGreaterThan(0);
        expect(p.objection.length).toBeGreaterThan(0);
        expect(p.interests.length).toBeGreaterThan(0);
      }
    }
  });

  it("is deterministic", () => {
    const a = expandAudience(AUDIENCES[0]);
    const b = expandAudience(AUDIENCES[0]);
    expect(a).toEqual(b);
  });
});