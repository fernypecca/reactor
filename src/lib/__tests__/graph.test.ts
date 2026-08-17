import { describe, expect, it } from "vitest";
import { AUDIENCES } from "../audiences";
import { bandFor, buildEdges, buildGraph, nodeWeight } from "../graph";

const audience = AUDIENCES[0];

describe("buildGraph", () => {
  it("returns one node per profile", () => {
    const g = buildGraph(audience);
    expect(g.nodes).toHaveLength(audience.profiles.length);
    expect(new Set(g.nodes.map((n) => n.id)).size).toBe(audience.profiles.length);
  });

  it("keeps every node inside the normalised canvas", () => {
    for (const a of AUDIENCES) {
      for (const n of buildGraph(a).nodes) {
        expect(n.x).toBeGreaterThanOrEqual(0);
        expect(n.x).toBeLessThanOrEqual(1);
        expect(n.y).toBeGreaterThanOrEqual(0);
        expect(n.y).toBeLessThanOrEqual(1);
      }
    }
  });

  it("is deterministic across calls", () => {
    const a = buildGraph(audience);
    const b = buildGraph(audience);
    expect(a.nodes.map((n) => [n.x, n.y])).toEqual(b.nodes.map((n) => [n.x, n.y]));
  });

  it("separates segments into distinct clusters", () => {
    const g = buildGraph(audience);
    expect(g.clusters).toHaveLength(audience.segments.length);
    // every pair of cluster centroids is meaningfully apart
    for (let i = 0; i < g.clusters.length; i++) {
      for (let j = i + 1; j < g.clusters.length; j++) {
        const dx = g.clusters[i].x - g.clusters[j].x;
        const dy = g.clusters[i].y - g.clusters[j].y;
        expect(Math.hypot(dx, dy)).toBeGreaterThan(0.15);
      }
    }
  });

  it("does not stack nodes on top of each other", () => {
    const g = buildGraph(audience);
    let tooClose = 0;
    for (let i = 0; i < g.nodes.length; i++) {
      for (let j = i + 1; j < g.nodes.length; j++) {
        const d = Math.hypot(g.nodes[i].x - g.nodes[j].x, g.nodes[i].y - g.nodes[j].y);
        if (d < 0.03) tooClose++;
      }
    }
    expect(tooClose).toBe(0);
  });

  it("gives every cluster its real member count", () => {
    const g = buildGraph(audience);
    const total = g.clusters.reduce((sum, c) => sum + c.count, 0);
    expect(total).toBe(audience.profiles.length);
  });
});

describe("buildEdges", () => {
  it("connects every follower to at least one other", () => {
    for (const a of AUDIENCES) {
      const edges = buildEdges(a.profiles);
      const connected = new Set(edges.flatMap((e) => [e.a, e.b]));
      expect(connected.size).toBe(a.profiles.length);
    }
  });

  it("only links followers that share interests", () => {
    const edges = buildEdges(audience.profiles);
    for (const e of edges) {
      const shared = audience.profiles[e.a].interests.filter((i) =>
        audience.profiles[e.b].interests.includes(i),
      );
      expect(shared.length).toBe(e.w);
      expect(e.w).toBeGreaterThan(0);
    }
  });

  it("never links a follower to itself or duplicates a pair", () => {
    const edges = buildEdges(audience.profiles);
    const seen = new Set<string>();
    for (const e of edges) {
      expect(e.a).not.toBe(e.b);
      const key = `${Math.min(e.a, e.b)}-${Math.max(e.a, e.b)}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("caps density so the field stays readable", () => {
    for (const a of AUDIENCES) {
      expect(buildEdges(a.profiles).length).toBeLessThanOrEqual(a.profiles.length * 3);
    }
  });
});

describe("nodeWeight", () => {
  it("gives thread writers more presence than meme repliers", () => {
    const thread = audience.profiles.find((p) => p.engagement === "thread")!;
    const meme = audience.profiles.find((p) => p.engagement === "meme")!;
    expect(nodeWeight(thread)).toBeGreaterThan(nodeWeight(meme));
  });

  it("is stable for the same profile", () => {
    const p = audience.profiles[0];
    expect(nodeWeight(p)).toBe(nodeWeight(p));
  });
});

describe("bandFor", () => {
  it("maps scores to bands at the documented thresholds", () => {
    expect(bandFor(100)).toBe("strong");
    expect(bandFor(70)).toBe("strong");
    expect(bandFor(69)).toBe("mixed");
    expect(bandFor(40)).toBe("mixed");
    expect(bandFor(39)).toBe("weak");
    expect(bandFor(0)).toBe("weak");
  });
});
