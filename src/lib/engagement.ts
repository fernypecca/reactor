export type Engagement = {
  likes: number;
  replies: number;
  reposts: number;
  impressions: number;
};

export function engagementFromReaction(r: Pick<import("./types").Reaction, "score">): Engagement {
  const likes = Math.round(r.score * 1.8);
  const replies = r.score >= 65 ? Math.floor((r.score - 50) / 20) : 0;
  const reposts = r.score >= 80 ? 1 : 0;
  return { likes, replies, reposts, impressions: likes * 12 };
}

export function sumEngagement(items: Engagement[]): Engagement {
  return items.reduce(
    (acc, e) => ({
      likes: acc.likes + e.likes,
      replies: acc.replies + e.replies,
      reposts: acc.reposts + e.reposts,
      impressions: acc.impressions + e.impressions,
    }),
    { likes: 0, replies: 0, reposts: 0, impressions: 0 },
  );
}