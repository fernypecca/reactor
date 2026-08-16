import type {
  ObjectionCluster,
  Reaction,
  VariantResult,
} from "./types";
import { engagementFromReaction, sumEngagement } from "./engagement";

export function avgScore(reactions: Reaction[]): number {
  if (reactions.length === 0) return 0;
  const total = reactions.reduce((sum, r) => sum + r.score, 0);
  return Math.round((total / reactions.length) * 10) / 10;
}

const CLUSTER_RULES: [string, RegExp][] = [
  ["pricing", /cost|price|pricing|pay|payment|free tier|trial/i],
  ["proof", /number|revenue|retention|cac|ltv|case stud|evidence|traction|metric|experiment|sample size/i],
  ["scope", /who is this for|problem|use case|different|procurement|buyer|feature|integration|workflow|scale/i],
  ["trust", /support|security|data|migration|warranty|burned|lie|defensib/i],
  ["skepticism", /hype|wrapper|generic|gimmick|claim|vague/i],
];

function clusterFor(text: string): string {
  for (const [label, re] of CLUSTER_RULES) {
    if (re.test(text)) return label;
  }
  return "other";
}

export function objectionClusters(reactions: Reaction[]): ObjectionCluster[] {
  const map = new Map<string, string[]>();
  for (const r of reactions) {
    if (!r.objection) continue;
    const label = clusterFor(r.objection);
    const list = map.get(label) ?? [];
    if (list.length < 3) list.push(r.objection);
    map.set(label, list);
  }
  return [...map.entries()]
    .map(([objection, examples]) => ({ objection, count: examples.length, examples }))
    .sort((a, b) => b.count - a.count);
}

export function segmentScores(reactions: Reaction[]): { segment: string; avg: number }[] {
  const bySegment = new Map<string, Reaction[]>();
  for (const r of reactions) {
    const list = bySegment.get(r.segment) ?? [];
    list.push(r);
    bySegment.set(r.segment, list);
  }
  return [...bySegment.entries()].map(([segment, list]) => ({
    segment,
    avg: avgScore(list),
  }));
}

export function buildVariantResult(
  variantId: string,
  copy: string,
  reactions: Reaction[],
): VariantResult {
  return {
    variantId,
    copy,
    reactions,
    avgScore: avgScore(reactions),
    objectionClusters: objectionClusters(reactions),
    segmentScores: segmentScores(reactions),
    engagement: sumEngagement(reactions.map(engagementFromReaction)),
  };
}

export function pickBestVariant(variants: VariantResult[]): string {
  let best = variants[0]?.variantId ?? "";
  let bestScore = -1;
  for (const v of variants) {
    if (v.avgScore > bestScore) {
      bestScore = v.avgScore;
      best = v.variantId;
    }
  }
  return best;
}