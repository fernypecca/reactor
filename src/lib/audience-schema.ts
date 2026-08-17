import type { Audience, FollowerProfile, Tone } from "./types";

/**
 * Generated audiences live in the browser, so the simulate endpoint has to
 * accept follower profiles from the client. That makes this file a trust
 * boundary: every field is clamped before it can reach a prompt, because each
 * profile is tokens somebody pays for.
 */

export const MAX_PROFILES = 60;
export const MAX_SEGMENTS = 6;
export const MAX_INTERESTS = 6;

const LIMITS = {
  id: 120,
  name: 60,
  handle: 32,
  bio: 200,
  objection: 180,
  interest: 40,
  label: 40,
  description: 400,
} as const;

const TONES: Tone[] = ["cheerleader", "skeptic", "numbers", "questioner"];
const ENGAGEMENTS: FollowerProfile["engagement"][] = ["short", "thread", "meme"];

export function isTone(v: unknown): v is Tone {
  return typeof v === "string" && (TONES as string[]).includes(v);
}

export function isEngagement(v: unknown): v is FollowerProfile["engagement"] {
  return typeof v === "string" && (ENGAGEMENTS as string[]).includes(v);
}

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export function normalizeHandle(v: unknown): string {
  const raw = str(v, LIMITS.handle).replace(/^@+/, "");
  const cleaned = raw.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase();
  return cleaned ? `@${cleaned}` : "";
}

/** kebab-case slug, safe to use in a DOM id or a profile id */
export function slugify(v: string, fallback: string): string {
  const s = v
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return s || fallback;
}

function sanitizeProfile(raw: unknown, index: number): FollowerProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const name = str(o.name, LIMITS.name);
  const handle = normalizeHandle(o.handle);
  const bio = str(o.bio, LIMITS.bio);
  const segment = str(o.segment, LIMITS.label);
  if (!name || !handle || !bio || !segment) return null;

  const interests = Array.isArray(o.interests)
    ? o.interests
        .map((i) => str(i, LIMITS.interest).toLowerCase())
        .filter(Boolean)
        .slice(0, MAX_INTERESTS)
    : [];
  if (interests.length === 0) return null;

  return {
    id: str(o.id, LIMITS.id) || `profile-${index}`,
    name,
    handle,
    bio,
    interests,
    tone: isTone(o.tone) ? o.tone : "questioner",
    engagement: isEngagement(o.engagement) ? o.engagement : "short",
    objection: str(o.objection, LIMITS.objection),
    segment,
  };
}

export type SanitizeError = "not-an-array" | "empty" | "too-many" | "duplicate-ids";

/**
 * Profile ids are how the client maps streamed reactions back onto graph
 * nodes, so they are preserved exactly rather than regenerated — and
 * duplicates are rejected instead of silently renamed, which would break
 * that mapping in a way that is very hard to see.
 */
export function sanitizeProfiles(
  raw: unknown,
): { ok: true; profiles: FollowerProfile[] } | { ok: false; error: SanitizeError } {
  if (!Array.isArray(raw)) return { ok: false, error: "not-an-array" };
  if (raw.length > MAX_PROFILES) return { ok: false, error: "too-many" };

  const profiles = raw
    .map((p, i) => sanitizeProfile(p, i))
    .filter((p): p is FollowerProfile => p !== null);

  if (profiles.length === 0) return { ok: false, error: "empty" };

  const ids = new Set(profiles.map((p) => p.id));
  if (ids.size !== profiles.length) return { ok: false, error: "duplicate-ids" };

  return { ok: true, profiles };
}

/** Derive the segment list from whatever segments the profiles actually claim. */
export function segmentsFromProfiles(
  profiles: FollowerProfile[],
  labels?: Map<string, string>,
): Audience["segments"] {
  const seen: Audience["segments"] = [];
  for (const p of profiles) {
    if (seen.some((s) => s.id === p.segment)) continue;
    seen.push({ id: p.segment, label: labels?.get(p.segment) ?? p.segment });
  }
  return seen.slice(0, MAX_SEGMENTS);
}
