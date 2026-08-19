import { describe, expect, it } from "vitest";
import { POST } from "./route";

// Imported audiences reach this endpoint as inline profiles + an audienceId —
// the exact shape Composer sends after an import.
const PROFILES = [
  {
    id: "import-fans-builder-0",
    name: "Mara Delgado",
    handle: "@marabuilds",
    bio: "Bootstrapped to $10k MRR.",
    interests: ["pricing", "indie web"],
    tone: "numbers",
    engagement: "thread",
    objection: "Show the revenue.",
    segment: "builder",
  },
];

async function run(body: unknown) {
  const res = await POST(
    new Request("http://localhost/api/simulate", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
  const text = await res.text();
  return { status: res.status, text };
}

describe("simulate route", () => {
  it("accepts inline profiles from an imported audience", async () => {
    const { status } = await run({
      audienceId: "import-fans",
      variants: ["Post A"],
      profiles: PROFILES,
    });
    expect(status).toBe(200);
  });

  it("rejects inline profiles that fail sanitization", async () => {
    const { status, text } = await run({
      audienceId: "import-fans",
      variants: ["Post A"],
      profiles: [{ id: "p1" }],
    });
    expect(status).toBe(400);
    expect(text).toContain("Invalid audience profiles");
  });

  it("rejects an unknown audience when no profiles are sent", async () => {
    const { status } = await run({ audienceId: "nope", variants: ["Post A"] });
    expect(status).toBe(404);
  });

  it("rejects malformed input", async () => {
    const { status } = await run({ variants: [] });
    expect(status).toBe(400);
  });
});