import {
  MAX_PROFILES,
  sanitizeProfiles,
  segmentsFromProfiles,
  slugify,
} from "./audience-schema";
import type { Audience } from "./types";

/**
 * Audiences scraped from a real page arrive as JSON written by
 * scripts/scrape-audience.sh. That file is the user's own machine, so this is
 * the same trust boundary as everything else that reaches the simulate
 * prompt: every field is clamped before it can become a token somebody pays
 * for. Rather than duplicating the sanitizers, this routes straight through
 * audience-schema.
 */

export class ImportError extends Error {}

const ERRORS: Record<
  "not-an-array" | "empty" | "too-many" | "duplicate-ids",
  string
> = {
  "not-an-array": "profiles must be a list of followers.",
  empty:
    "None of the followers survived validation — each needs a name, handle, bio, interests and segment.",
  "too-many": `An audience can hold at most ${MAX_PROFILES} profiles.`,
  "duplicate-ids": "Two followers share the same id, which would break the reaction graph.",
};

function labelsFrom(raw: unknown): Map<string, string> {
  const labels = new Map<string, string>();
  if (!Array.isArray(raw)) return labels;
  for (const s of raw) {
    const seg = s as Record<string, unknown> | null;
    if (typeof seg?.id === "string" && typeof seg?.label === "string") {
      labels.set(seg.id, seg.label);
    }
  }
  return labels;
}

/**
 * Turn a pasted audience JSON blob into a usable Audience.
 * The id is derived from the name rather than trusted from the JSON, so an
 * imported audience can never collide with a built-in one — and re-importing
 * the same JSON replaces the previous copy instead of duplicating it.
 */
export function parseImportedAudience(json: string): Audience {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new ImportError("That is not valid JSON.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ImportError("That JSON is not an audience object.");
  }
  const o = parsed as Record<string, unknown>;

  const name = typeof o.name === "string" ? o.name.trim().slice(0, 60) : "";
  if (!name) throw new ImportError("The audience needs a name.");

  const result = sanitizeProfiles(o.profiles);
  if (!result.ok) throw new ImportError(ERRORS[result.error]);

  return {
    id: `import-${slugify(name, "audience")}`,
    name,
    description:
      typeof o.description === "string" ? o.description.trim().slice(0, 400) : "",
    segments: segmentsFromProfiles(result.profiles, labelsFrom(o.segments)),
    profiles: result.profiles,
  };
}