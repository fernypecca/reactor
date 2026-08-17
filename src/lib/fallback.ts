import type { FollowerProfile, Reaction } from "./types";

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/**
 * How receptive each temperament is before the copy is even read.
 * A room of skeptics and cheerleaders should never score as one flat block.
 */
const TONE_BIAS: Record<FollowerProfile["tone"], number> = {
  cheerleader: 24,
  numbers: 2,
  questioner: -6,
  skeptic: -20,
};

const ENGAGEMENT_BIAS: Record<FollowerProfile["engagement"], number> = {
  thread: 5,
  short: 0,
  meme: -3,
};

const HYPE = /\b(amazing|revolutionary|game[- ]changing|insane|magical|10x|unlock|supercharge)\b/i;
const PROOF = /\d/;
const RISK_REVERSAL = /\b(free|trial|no credit card|money[- ]back|cancel anytime)\b/i;

/**
 * Deterministic stand-in for the LLM. It reads the same profile fields the
 * real simulator does — tone, engagement style, interests, objection — and
 * reacts to concrete properties of the copy, so the spread across the
 * audience is a real signal rather than noise around a constant.
 */
export function fallbackReactions(profiles: FollowerProfile[], copy: string): Reaction[] {
  const copyLower = copy.toLowerCase();
  const hasProof = PROOF.test(copy);
  const isHypey = HYPE.test(copy);
  const derisked = RISK_REVERSAL.test(copy);

  return profiles.map((p) => {
    const interestHits = p.interests.filter((i) => copyLower.includes(i.toLowerCase())).length;

    let score = 52;
    score += TONE_BIAS[p.tone];
    score += ENGAGEMENT_BIAS[p.engagement];
    score += interestHits * 13;

    // hard numbers win over the people who ask for them, and buy some
    // patience from the ones who assume you have none
    if (hasProof) score += p.tone === "numbers" ? 16 : p.tone === "skeptic" ? 9 : 4;
    else if (p.tone === "numbers" || p.tone === "skeptic") score -= 10;

    // hype costs you exactly the people who were already suspicious
    if (isHypey) score += p.tone === "skeptic" ? -16 : p.tone === "cheerleader" ? 4 : -7;

    // a free way in matters most to the people who never commit
    if (derisked) score += p.engagement === "meme" ? 12 : 6;

    // long copy loses the short-form crowd
    if (copy.length > 280 && p.engagement === "short") score -= 6;

    score += (hash(`${p.id}:${copy}`) % 17) - 8;

    const final = Math.max(4, Math.min(98, Math.round(score)));

    return {
      followerId: p.id,
      name: p.name,
      handle: p.handle,
      segment: p.segment,
      score: final,
      comment:
        final >= 75
          ? `Curious — ${p.objection}`.slice(0, 120)
          : final >= 50
            ? `Hmm. ${p.objection}`.slice(0, 120)
            : `Not for me. ${p.objection}`.slice(0, 120),
      objection: final >= 75 ? "" : p.objection,
    };
  });
}
