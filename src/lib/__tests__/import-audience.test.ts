import { describe, expect, it } from "vitest";
import { MAX_PROFILES } from "../audience-schema";
import { ImportError, parseImportedAudience } from "../import-audience";

const follower = (over: Record<string, unknown> = {}) => ({
  id: "scraped-builder-0",
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

const audienceJson = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    id: "scraped-wedding-photographers",
    name: "Wedding Photographers Spain",
    description: "Cloned from a public directory.",
    segments: [
      { id: "builder", label: "Builder" },
      { id: "lurker", label: "Lurker" },
    ],
    profiles: [
      follower(),
      follower({ id: "scraped-lurker-0", handle: "@ivanp", segment: "lurker" }),
    ],
    ...over,
  });

describe("parseImportedAudience", () => {
  it("parses a script-shaped audience into a usable Audience", () => {
    const a = parseImportedAudience(audienceJson());
    expect(a.name).toBe("Wedding Photographers Spain");
    expect(a.description).toBe("Cloned from a public directory.");
    expect(a.profiles).toHaveLength(2);
    expect(a.profiles[0].handle).toBe("@marabuilds");
  });

  it("derives the id from the name so imports can never collide with built-ins", () => {
    const a = parseImportedAudience(audienceJson());
    expect(a.id).toBe("import-wedding-photographers-spain");
    expect(a.id.startsWith("import-")).toBe(true);
  });

  it("is deterministic: re-importing the same JSON replaces, not duplicates", () => {
    const a1 = parseImportedAudience(audienceJson());
    const a2 = parseImportedAudience(audienceJson());
    expect(a2.id).toBe(a1.id);
  });

  it("uses the segment labels declared in the JSON", () => {
    const a = parseImportedAudience(audienceJson());
    expect(a.segments.map((s) => s.label)).toEqual(["Builder", "Lurker"]);
  });

  it("falls back to segment ids when no labels are declared", () => {
    const a = parseImportedAudience(audienceJson({ segments: [] }));
    expect(a.segments.length).toBeGreaterThan(0);
    expect(a.segments[0].label).toBe("builder");
  });

  it("normalizes handles and coerces unknown tone/engagement through the schema", () => {
    const a = parseImportedAudience(
      audienceJson({
        profiles: [follower({ handle: "MaraBuilds!", tone: "furious", engagement: "video" })],
      }),
    );
    expect(a.profiles[0].handle).toBe("@marabuilds");
    expect(a.profiles[0].tone).toBe("questioner");
    expect(a.profiles[0].engagement).toBe("short");
  });

  it("clamps long free text instead of rejecting it", () => {
    const a = parseImportedAudience(audienceJson({ profiles: [follower({ bio: "x".repeat(5000) })] }));
    expect(a.profiles[0].bio.length).toBeLessThanOrEqual(200);
  });

  it("rejects invalid JSON", () => {
    expect(() => parseImportedAudience("{ nope")).toThrow(ImportError);
  });

  it("rejects a non-object payload", () => {
    expect(() => parseImportedAudience(JSON.stringify([1, 2, 3]))).toThrow(ImportError);
    expect(() => parseImportedAudience(JSON.stringify(null))).toThrow(ImportError);
  });

  it("rejects a missing name", () => {
    expect(() => parseImportedAudience(audienceJson({ name: "  " }))).toThrow(
      "needs a name",
    );
  });

  it("rejects profiles that are not a list", () => {
    expect(() => parseImportedAudience(audienceJson({ profiles: {} }))).toThrow(
      "profiles must be a list",
    );
  });

  it("rejects more profiles than the cap", () => {
    const many = Array.from({ length: MAX_PROFILES + 1 }, (_, i) =>
      follower({ id: `p-${i}`, handle: `@u${i}` }),
    );
    expect(() => parseImportedAudience(audienceJson({ profiles: many }))).toThrow(
      "at most 60",
    );
  });

  it("rejects duplicate ids", () => {
    expect(() =>
      parseImportedAudience(
        audienceJson({ profiles: [follower(), follower({ handle: "@other" })] }),
      ),
    ).toThrow("same id");
  });

  it("rejects a list where every follower fails validation", () => {
    expect(() =>
      parseImportedAudience(audienceJson({ profiles: [{ id: "p1" }] })),
    ).toThrow("None of the followers");
  });
});