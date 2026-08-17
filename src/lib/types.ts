export type Tone = "cheerleader" | "skeptic" | "numbers" | "questioner";

export type FollowerProfile = {
  id: string;
  name: string;
  handle: string;
  bio: string;
  interests: string[];
  tone: Tone;
  engagement: "short" | "thread" | "meme";
  objection: string;
  segment: string;
};

export type Audience = {
  id: string;
  name: string;
  description: string;
  segments: { id: string; label: string }[];
  profiles: FollowerProfile[];
};

export type Reaction = {
  followerId: string;
  name: string;
  handle: string;
  segment: string;
  score: number;
  comment: string;
  objection: string;
};

export type ObjectionCluster = {
  objection: string;
  count: number;
  examples: string[];
};

import type { Engagement } from "./engagement";

export type VariantResult = {
  variantId: string;
  copy: string;
  reactions: Reaction[];
  avgScore: number;
  objectionClusters: ObjectionCluster[];
  segmentScores: { segment: string; avg: number }[];
  engagement: Engagement;
};

/**
 * `source` tells the UI whether this is a real rewrite or just the winning
 * copy handed back because no model was available. Presenting the second one
 * as a rewrite would be a lie in the most important card on the page.
 */
export type RewriteResult = {
  rewrite: string;
  why: string;
  source: "llm" | "fallback";
};

export type SimulationResult = {
  audienceId: string;
  variants: VariantResult[];
  bestVariantId: string;
  rewrite: string;
};

export type SimulateInput = {
  audienceId: string;
  variants: string[];
};