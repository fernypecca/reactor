import type { Audience, FollowerProfile } from "./types";

/**
 * Deterministic force-directed layout for the audience constellation.
 *
 * No dependencies, no randomness at render time: the same audience always
 * produces the same shape, so the graph is stable across re-renders, reruns
 * and SSR. Coordinates are normalised to 0..1 so the canvas can scale freely.
 */

export type GraphNode = {
  id: string;
  index: number;
  x: number;
  y: number;
  /** relative radius multiplier, ~0.8..1.4 — derived from engagement style */
  r: number;
  segment: string;
  profile: FollowerProfile;
};

export type GraphEdge = {
  /** node indices */
  a: number;
  b: number;
  /** number of shared interests */
  w: number;
};

export type GraphCluster = {
  id: string;
  label: string;
  x: number;
  y: number;
  count: number;
};

export type Graph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  clusters: GraphCluster[];
};

/** mulberry32 — small, fast, fully deterministic PRNG */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A thread-writer carries more reach than a meme-replier. */
const SIZE_BY_ENGAGEMENT: Record<FollowerProfile["engagement"], number> = {
  thread: 1.35,
  short: 1.0,
  meme: 0.82,
};

export function nodeWeight(profile: FollowerProfile): number {
  const base = SIZE_BY_ENGAGEMENT[profile.engagement] ?? 1;
  const jitter = (hash(profile.id) % 100) / 100 - 0.5; // -0.5..0.5
  return Math.round((base + jitter * 0.16) * 1000) / 1000;
}

function sharedInterests(a: FollowerProfile, b: FollowerProfile): number {
  let n = 0;
  for (const i of a.interests) {
    if (b.interests.includes(i)) n++;
  }
  return n;
}

/**
 * Edges connect followers who share interests — the real affinity signal in
 * the data. Keep strong ties (2+ shared interests), then guarantee every node
 * has at least one link so nobody floats alone.
 */
export function buildEdges(profiles: FollowerProfile[]): GraphEdge[] {
  const strong: GraphEdge[] = [];
  const best: (GraphEdge | null)[] = profiles.map(() => null);

  for (let i = 0; i < profiles.length; i++) {
    for (let j = i + 1; j < profiles.length; j++) {
      const w = sharedInterests(profiles[i], profiles[j]);
      if (w === 0) continue;
      const edge: GraphEdge = { a: i, b: j, w };
      if (w >= 2) strong.push(edge);
      if (!best[i] || w > best[i]!.w) best[i] = edge;
      if (!best[j] || w > best[j]!.w) best[j] = edge;
    }
  }

  const key = (e: GraphEdge) => `${e.a}-${e.b}`;
  const seen = new Set(strong.map(key));
  const connected = new Set<number>();
  for (const e of strong) {
    connected.add(e.a);
    connected.add(e.b);
  }

  for (let i = 0; i < profiles.length; i++) {
    if (connected.has(i)) continue;
    const e = best[i];
    if (!e || seen.has(key(e))) continue;
    seen.add(key(e));
    strong.push(e);
    connected.add(e.a);
    connected.add(e.b);
  }

  // Cap density so the field stays readable rather than becoming a hairball.
  const cap = Math.max(profiles.length * 3, 24);
  return strong.sort((x, y) => y.w - x.w || x.a - y.a || x.b - y.b).slice(0, cap);
}

const ITERATIONS = 320;
const PULL_TO_CLUSTER = 0.012;
const EDGE_PULL = 0.0022;
const MIN_DIST = 0.082;
const REPULSION = 0.5;

export function buildGraph(audience: Audience): Graph {
  const profiles = audience.profiles;
  const segmentIds = audience.segments.map((s) => s.id);
  const random = rng(hash(audience.id));

  // One centroid per segment, spread evenly on a ring around the centre.
  const ring = segmentIds.length > 1 ? 0.28 : 0;
  const centroids = new Map<string, { x: number; y: number }>();
  segmentIds.forEach((id, i) => {
    const angle = (i / segmentIds.length) * Math.PI * 2 - Math.PI / 2;
    centroids.set(id, {
      x: 0.5 + Math.cos(angle) * ring,
      y: 0.5 + Math.sin(angle) * ring * 0.86,
    });
  });

  const xs = new Float64Array(profiles.length);
  const ys = new Float64Array(profiles.length);
  const rs = profiles.map(nodeWeight);

  profiles.forEach((p, i) => {
    const c = centroids.get(p.segment) ?? { x: 0.5, y: 0.5 };
    const angle = random() * Math.PI * 2;
    const dist = Math.sqrt(random()) * 0.13;
    xs[i] = c.x + Math.cos(angle) * dist;
    ys[i] = c.y + Math.sin(angle) * dist;
  });

  const edges = buildEdges(profiles);

  for (let step = 0; step < ITERATIONS; step++) {
    const vx = new Float64Array(profiles.length);
    const vy = new Float64Array(profiles.length);

    // pull each node toward its own segment
    profiles.forEach((p, i) => {
      const c = centroids.get(p.segment) ?? { x: 0.5, y: 0.5 };
      vx[i] += (c.x - xs[i]) * PULL_TO_CLUSTER;
      vy[i] += (c.y - ys[i]) * PULL_TO_CLUSTER;
    });

    // shared-interest links pull gently, never enough to collapse clusters
    for (const e of edges) {
      const dx = xs[e.b] - xs[e.a];
      const dy = ys[e.b] - ys[e.a];
      const f = EDGE_PULL * e.w;
      vx[e.a] += dx * f;
      vy[e.a] += dy * f;
      vx[e.b] -= dx * f;
      vy[e.b] -= dy * f;
    }

    // repulsion keeps nodes from overlapping (n is small, O(n^2) is free)
    for (let i = 0; i < profiles.length; i++) {
      for (let j = i + 1; j < profiles.length; j++) {
        const dx = xs[j] - xs[i];
        const dy = ys[j] - ys[i];
        const d2 = dx * dx + dy * dy;
        const min = MIN_DIST * ((rs[i] + rs[j]) / 2);
        if (d2 >= min * min) continue;
        const d = Math.sqrt(d2) || 0.0001;
        const push = ((min - d) / d) * REPULSION;
        vx[i] -= dx * push;
        vy[i] -= dy * push;
        vx[j] += dx * push;
        vy[j] += dy * push;
      }
    }

    for (let i = 0; i < profiles.length; i++) {
      xs[i] += vx[i];
      ys[i] += vy[i];
    }
  }

  // normalise into 0..1 with a margin so nothing clips at the canvas edge
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < profiles.length; i++) {
    if (xs[i] < minX) minX = xs[i];
    if (xs[i] > maxX) maxX = xs[i];
    if (ys[i] < minY) minY = ys[i];
    if (ys[i] > maxY) maxY = ys[i];
  }
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const M = 0.07;
  const norm = (v: number, min: number, span: number) =>
    M + ((v - min) / span) * (1 - M * 2);

  const nodes: GraphNode[] = profiles.map((p, i) => ({
    id: p.id,
    index: i,
    x: Math.round(norm(xs[i], minX, spanX) * 10000) / 10000,
    y: Math.round(norm(ys[i], minY, spanY) * 10000) / 10000,
    r: rs[i],
    segment: p.segment,
    profile: p,
  }));

  const clusters: GraphCluster[] = audience.segments.map((s) => {
    const members = nodes.filter((n) => n.segment === s.id);
    const cx = members.reduce((sum, n) => sum + n.x, 0) / (members.length || 1);
    const cy = members.reduce((sum, n) => sum + n.y, 0) / (members.length || 1);
    return { id: s.id, label: s.label, x: cx, y: cy, count: members.length };
  });

  return { nodes, edges, clusters };
}

/** Score bands drive every colour decision in the UI. One source of truth. */
export type Band = "strong" | "mixed" | "weak";

export function bandFor(score: number): Band {
  if (score >= 70) return "strong";
  if (score >= 40) return "mixed";
  return "weak";
}

export const BAND_COLOR: Record<Band, string> = {
  strong: "#1d9e4b",
  mixed: "#c2650a",
  weak: "#e11d48",
};

export const BAND_LABEL: Record<Band, string> = {
  strong: "Will engage",
  mixed: "On the fence",
  weak: "Will scroll past",
};
