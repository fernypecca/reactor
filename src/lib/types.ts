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

export type VariantResult = {
  variantId: string;
  copy: string;
  reactions: Reaction[];
  avgScore: number;
  objectionClusters: ObjectionCluster[];
  segmentScores: { segment: string; avg: number }[];
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