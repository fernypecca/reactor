import { describe, expect, it } from "vitest";
import { parseStored } from "../audience-store";

const profile = (i: number, segment = "veteran") => ({
  id: `custom-x-${segment}-${i}`,
  name: `Person ${i}`,
  handle: `@person${i}`,
  bio: "Shoots weddings on weekends.",
  interests: ["weddings", "pricing"],
  tone: "numbers",
  engagement: "short",
  objection: "Does it book clients?",
  segment,
});

const audience = (over: Record<string, unknown> = {}) => ({
  id: "custom-x",
  name: "Wedding Photographers",
  description: "Freelancers booking 20-30 weddings a year.",
  segments: [{ id: "veteran", label: "Veteran" }],
  profiles: [profile(0), profile(1)],
  ...over,
});

describe("parseStored", () => {
  it("returns nothing for empty or missing storage", () => {
    expect(parseStored(null)).toEqual([]);
    expect(parseStored("")).toEqual([]);
  });

  it("survives corrupted JSON instead of throwing", () => {
    expect(parseStored("{not json")).toEqual([]);
    expect(parseStored('"a string"')).toEqual([]);
    expect(parseStored("42")).toEqual([]);
  });

  it("round-trips a valid audience", () => {
    const out = parseStored(JSON.stringify([audience()]));
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("Wedding Photographers");
    expect(out[0].profiles).toHaveLength(2);
    expect(out[0].segments).toEqual([{ id: "veteran", label: "Veteran" }]);
  });

  it("drops an audience whose profiles no longer validate", () => {
    expect(parseStored(JSON.stringify([audience({ profiles: [] })]))).toEqual([]);
    expect(parseStored(JSON.stringify([audience({ profiles: "nope" })]))).toEqual([]);
  });

  it("drops entries missing an id or a name", () => {
    expect(parseStored(JSON.stringify([audience({ id: 3 })]))).toEqual([]);
    expect(parseStored(JSON.stringify([audience({ name: undefined })]))).toEqual([]);
  });

  it("keeps the good entries and discards the bad ones", () => {
    const out = parseStored(
      JSON.stringify([audience(), null, audience({ id: "custom-y", profiles: [] })]),
    );
    expect(out.map((a) => a.id)).toEqual(["custom-x"]);
  });

  it("rebuilds segments from the profiles when the stored list is junk", () => {
    const out = parseStored(JSON.stringify([audience({ segments: "nope" })]));
    expect(out[0].segments).toEqual([{ id: "veteran", label: "veteran" }]);
  });

  it("clamps how many audiences it will load", () => {
    const many = Array.from({ length: 40 }, (_, i) => audience({ id: `custom-${i}` }));
    expect(parseStored(JSON.stringify(many)).length).toBeLessThanOrEqual(12);
  });

  it("re-clamps oversized fields that were edited in storage by hand", () => {
    const tampered = audience({ profiles: [{ ...profile(0), bio: "x".repeat(9000) }] });
    const out = parseStored(JSON.stringify([tampered]));
    expect(out[0].profiles[0].bio.length).toBeLessThanOrEqual(200);
  });
});
