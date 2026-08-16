import type { FollowerProfile, Reaction } from "./types";

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function fallbackReactions(profiles: FollowerProfile[], copy: string): Reaction[] {
  const copyLower = copy.toLowerCase();
  return profiles.map((p) => {
    const interestHits = p.interests.filter((i) => copyLower.includes(i.toLowerCase())).length;
    const toneBonus =
      p.tone === "cheerleader" ? 12 : p.tone === "numbers" ? 6 : p.tone === "questioner" ? 3 : 0;
    const base = 42 + interestHits * 14 + toneBonus + (hash(`${p.id}:${copy}`) % 14);
    const score = Math.max(8, Math.min(96, base));
    return {
      followerId: p.id,
      name: p.name,
      handle: p.handle,
      segment: p.segment,
      score,
      comment:
        score >= 75
          ? `Curious — ${p.objection}`.slice(0, 120)
          : score >= 50
            ? `Hmm. ${p.objection}`.slice(0, 120)
            : `Not for me. ${p.objection}`.slice(0, 120),
      objection: score >= 75 ? "" : p.objection,
    };
  });
}