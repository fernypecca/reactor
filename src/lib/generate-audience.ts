import {
  MAX_PROFILES,
  sanitizeProfiles,
  segmentsFromProfiles,
  slugify,
} from "./audience-schema";
import { completeJSON } from "./llm";
import type { Audience, FollowerProfile } from "./types";

export type SegmentBrief = { id: string; label: string; brief: string };
export type AudienceBrief = {
  name: string;
  description: string;
  segments: SegmentBrief[];
};

/** 26 followers, split the way the hand-written audiences are. */
export const DEFAULT_SPLIT = [10, 8, 8];

function isBrief(v: unknown): v is AudienceBrief {
  const o = v as Partial<AudienceBrief> | null;
  return (
    !!o &&
    typeof o.name === "string" &&
    o.name.trim().length > 0 &&
    typeof o.description === "string" &&
    Array.isArray(o.segments) &&
    o.segments.length >= 2 &&
    o.segments.length <= 4 &&
    o.segments.every(
      (s) =>
        !!s &&
        typeof s.label === "string" &&
        s.label.trim().length > 0 &&
        typeof s.brief === "string",
    )
  );
}

type RawFollowerList = { followers: unknown[] };

function isFollowerList(v: unknown): v is RawFollowerList {
  const o = v as Partial<RawFollowerList> | null;
  return !!o && Array.isArray(o.followers) && o.followers.length > 0;
}

const STRUCTURE_SYSTEM = `You segment B2B audiences. Given a description of who someone posts to, split that audience into 3 distinct segments that would react DIFFERENTLY to the same launch post — not three flavours of the same person. Each segment needs a short label (one or two words) and a one-sentence brief describing what that group cares about and what makes them scroll past.
Respond with ONLY valid JSON: {"name": string, "description": string, "segments": [{"label": string, "brief": string}]}`;

const FOLLOWERS_SYSTEM = `You write realistic social-media follower profiles for a marketing simulator.

HARD RULES:
- Every person must be FICTIONAL. Never use the name or handle of a real person, company, or public figure. These profiles get put in someone's mouth, so they must belong to nobody.
- Vary names across regions and genders. Never reuse a first name inside one batch.
- bio: max 90 characters, written in that person's voice, concrete not generic.
- interests: exactly 3 lowercase tags, 1-2 words each.
- objection: the single sharpest reason THIS person would not act on a post, max 90 characters, phrased as they would say it.
- tone: one of "cheerleader", "skeptic", "numbers", "questioner".
- engagement: one of "short", "thread", "meme".
- Spread tone and engagement across the batch. A segment where everyone is a skeptic is useless.

Respond with ONLY valid JSON: {"followers": [{"name": string, "handle": string, "bio": string, "interests": [string], "tone": string, "engagement": string, "objection": string}]}`;

export async function generateStructure(icp: string): Promise<AudienceBrief> {
  const brief = await completeJSON<AudienceBrief>(
    {
      system: STRUCTURE_SYSTEM,
      prompt: `AUDIENCE DESCRIPTION:\n"""\n${icp}\n"""\n\nSegment them.`,
      tier: "smart",
      maxTokens: 700,
    },
    isBrief,
  );

  const used = new Set<string>();
  const segments = brief.segments.map((s, i) => {
    let id = slugify(s.label, `segment-${i + 1}`);
    while (used.has(id)) id = `${id}-${i + 1}`;
    used.add(id);
    return { id, label: s.label.trim(), brief: s.brief.trim() };
  });

  return { name: brief.name.trim(), description: brief.description.trim(), segments };
}

export async function generateSegmentFollowers(
  icp: string,
  brief: AudienceBrief,
  segment: SegmentBrief,
  count: number,
): Promise<unknown[]> {
  const result = await completeJSON<RawFollowerList>(
    {
      system: FOLLOWERS_SYSTEM,
      prompt: `AUDIENCE: ${brief.name}
${brief.description}

ORIGINAL DESCRIPTION FROM THE CREATOR:
"""
${icp}
"""

SEGMENT: ${segment.label}
${segment.brief}

Write exactly ${count} followers for the "${segment.label}" segment.`,
      tier: "smart",
      maxTokens: 2200,
    },
    isFollowerList,
  );
  return result.followers;
}

/**
 * Stitches the per-segment batches into an Audience, giving every follower a
 * stable id and dropping duplicate handles — the model will occasionally
 * reuse one across two segments generated in parallel.
 */
export function assembleAudience(
  audienceId: string,
  brief: AudienceBrief,
  bySegment: { segment: SegmentBrief; followers: unknown[] }[],
): Audience {
  const seenHandles = new Set<string>();
  const raw: unknown[] = [];

  for (const { segment, followers } of bySegment) {
    let i = 0;
    for (const f of followers) {
      if (!f || typeof f !== "object") continue;
      const o = f as Record<string, unknown>;
      raw.push({
        ...o,
        id: `${audienceId}-${segment.id}-${i}`,
        segment: segment.id,
      });
      i++;
    }
  }

  const result = sanitizeProfiles(raw.slice(0, MAX_PROFILES));
  if (!result.ok) {
    throw new Error(`Generated audience was unusable (${result.error})`);
  }

  const profiles: FollowerProfile[] = [];
  for (const p of result.profiles) {
    if (seenHandles.has(p.handle)) continue;
    seenHandles.add(p.handle);
    profiles.push(p);
  }

  const labels = new Map(brief.segments.map((s) => [s.id, s.label]));

  return {
    id: audienceId,
    name: brief.name,
    description: brief.description,
    segments: segmentsFromProfiles(profiles, labels),
    profiles,
  };
}

/** Split a target headcount across N segments, biggest first. */
export function splitCount(total: number, segments: number): number[] {
  if (segments <= 0) return [];
  const base = Math.floor(total / segments);
  const out = Array.from({ length: segments }, () => base);
  let rest = total - base * segments;
  for (let i = 0; rest > 0; i = (i + 1) % segments, rest--) out[i]++;
  return out;
}
