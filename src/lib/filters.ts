import { clusterFor } from "./aggregate";
import { bandFor, type Band } from "./graph";
import type { Reaction } from "./types";

/**
 * One filter shared by the feed and the constellation, so clicking a segment,
 * a score band or an objection always highlights the same followers in both.
 */
export type Filter = {
  segment: string | null;
  band: Band | null;
  cluster: string | null;
};

export const NO_FILTER: Filter = { segment: null, band: null, cluster: null };

export function isFiltered(f: Filter): boolean {
  return f.segment !== null || f.band !== null || f.cluster !== null;
}

export function matches(r: Reaction, f: Filter): boolean {
  if (f.segment && r.segment !== f.segment) return false;
  if (f.band && bandFor(r.score) !== f.band) return false;
  if (f.cluster) {
    if (!r.objection) return false;
    if (clusterFor(r.objection) !== f.cluster) return false;
  }
  return true;
}

export function applyFilter(reactions: Reaction[], f: Filter): Reaction[] {
  return isFiltered(f) ? reactions.filter((r) => matches(r, f)) : reactions;
}

/** Toggle a facet off when the same value is clicked twice. */
export function toggleFacet<K extends keyof Filter>(
  f: Filter,
  key: K,
  value: Filter[K],
): Filter {
  return { ...f, [key]: f[key] === value ? null : value };
}

export function bandCounts(reactions: Reaction[]): Record<Band, number> {
  const counts: Record<Band, number> = { strong: 0, mixed: 0, weak: 0 };
  for (const r of reactions) counts[bandFor(r.score)]++;
  return counts;
}
