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

/**
 * Order matters: the first rule that matches wins. Keep the patterns wide
 * enough that real objections land in a named bucket — an "other" pile that
 * outgrows every real theme tells the user nothing about what to fix.
 */
const CLUSTER_RULES: [string, RegExp][] = [
  [
    "pricing",
    /cost|price|pricing|\bpay\b|payment|free tier|one[- ]time|subscription|per (seat|month|user)/i,
  ],
  [
    "proof",
    /number|revenue|retention|churn|\bcac\b|\bltv\b|\barr\b|\bmrr\b|case stud|evidence|traction|metric|experiment|sample size|how many|customer|active user|unit econom|\broi\b|show me|conversion rate|p-value|benchmark|\beval|failure mode|open the source/i,
  ],
  [
    "scope",
    /who is this for|who is the|target (user|audience)|problem|use case|different|procurement|buyer|feature|integrat|workflow|scale|\btoy\b|save (me|my|us)|worth it|for exactly|\bapi\b|template|viable|pipeline/i,
  ],
  [
    "usability",
    /learning curve|beautiful|in practice|first value|human .*loop|onboarding look|how fast to/i,
  ],
  ["access", /\blink\b|get in early|try it|demo|waitlist|early access|invite/i],
  [
    "trust",
    /support|security|privacy|compliance|\bdata\b|migration|warranty|burned|\blie\b|defensib|lock[- ]in|threat model/i,
  ],
  [
    "skepticism",
    /hype|wrapper|generic|gimmick|\bclaim|vague|another (ai|agent|tool)|buzzword|every tool|next big thing/i,
  ],
];

export function clusterFor(text: string): string {
  for (const [label, re] of CLUSTER_RULES) {
    if (re.test(text)) return label;
  }
  return "other";
}

export function objectionClusters(reactions: Reaction[]): ObjectionCluster[] {
  // count is how many followers raised it; examples are only the first few we
  // show. Deriving one from the other would cap every cluster at 3.
  const map = new Map<string, { count: number; examples: string[] }>();
  for (const r of reactions) {
    if (!r.objection) continue;
    const label = clusterFor(r.objection);
    const entry = map.get(label) ?? { count: 0, examples: [] };
    entry.count++;
    if (entry.examples.length < 3) entry.examples.push(r.objection);
    map.set(label, entry);
  }
  return [...map.entries()]
    .map(([objection, { count, examples }]) => ({ objection, count, examples }))
    .sort((a, b) => b.count - a.count || a.objection.localeCompare(b.objection));
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