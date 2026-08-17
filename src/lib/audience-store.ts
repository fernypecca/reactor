import { sanitizeProfiles, segmentsFromProfiles } from "./audience-schema";
import type { Audience } from "./types";

/**
 * Generated audiences are expensive to make, so they survive a reload.
 * Exposed as an external store rather than component state: the server
 * snapshot is a stable empty array, which keeps hydration honest without
 * anyone reaching for setState inside an effect.
 */

const KEY = "reactor:audiences:v1";
const MAX_STORED = 12;
const EMPTY: Audience[] = [];

let cache: Audience[] = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

/** Anything in localStorage is user-editable, so re-validate on the way in. */
export function parseStored(raw: string | null): Audience[] {
  if (!raw) return EMPTY;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return EMPTY;
  }
  if (!Array.isArray(parsed)) return EMPTY;

  const out: Audience[] = [];
  for (const entry of parsed.slice(0, MAX_STORED)) {
    if (!entry || typeof entry !== "object") continue;
    const o = entry as Record<string, unknown>;
    if (typeof o.id !== "string" || typeof o.name !== "string") continue;

    const result = sanitizeProfiles(o.profiles);
    if (!result.ok) continue;

    const labels = new Map<string, string>();
    if (Array.isArray(o.segments)) {
      for (const s of o.segments) {
        const seg = s as Record<string, unknown>;
        if (typeof seg?.id === "string" && typeof seg?.label === "string") {
          labels.set(seg.id, seg.label);
        }
      }
    }

    out.push({
      id: o.id,
      name: o.name,
      description: typeof o.description === "string" ? o.description : "",
      segments: segmentsFromProfiles(result.profiles, labels),
      profiles: result.profiles,
    });
  }
  return out;
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache.slice(0, MAX_STORED)));
  } catch {
    /* quota or private mode — the audience still works for this session */
  }
}

function emit() {
  for (const fn of listeners) fn();
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getSnapshot(): Audience[] {
  if (!loaded) {
    try {
      cache = parseStored(localStorage.getItem(KEY));
    } catch {
      cache = EMPTY;
    }
    loaded = true;
  }
  return cache;
}

export function getServerSnapshot(): Audience[] {
  return EMPTY;
}

export function addAudience(audience: Audience) {
  cache = [audience, ...getSnapshot().filter((a) => a.id !== audience.id)].slice(0, MAX_STORED);
  persist();
  emit();
}

export function removeAudience(id: string) {
  cache = getSnapshot().filter((a) => a.id !== id);
  persist();
  emit();
}
