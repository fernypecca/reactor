import { completeJSON } from "./llm";
import type { FollowerProfile, Reaction } from "./types";
import { fallbackReactions } from "./fallback";

const BATCH_SIZE = 10;

type ReactionPayload = {
  followerId: string;
  score: number;
  comment: string;
  objection: string;
};

function isReactionPayload(v: unknown): v is ReactionPayload[] {
  if (!Array.isArray(v)) return false;
  return v.every(
    (r) =>
      !!r &&
      typeof (r as ReactionPayload).followerId === "string" &&
      typeof (r as ReactionPayload).score === "number" &&
      typeof (r as ReactionPayload).comment === "string" &&
      typeof (r as ReactionPayload).objection === "string",
  );
}

const escapePrompt = (s: string) => s.replace(/[\\`"]/g, (c) => `\\${c}`);

const SIM_SYSTEM = `You are a realistic social-media simulator. A creator is about to launch copy to their audience of followers.
For each follower you are given their bio, interests, tone, engagement style and a typical objection. Reply AS that follower, in their voice, in one line or two.
Rules:
- score is how likely THIS follower is to engage positively, 0-100.
- comment is what the follower would reply, using THEIR tone and interests, NEVER generic AI praise.
- objection is a one-line concern from the follower's point of view, or "" if the follower would engage without raising one.
- Never invent facts about the product. Never use "amazing" or "game-changing".
Respond with ONLY valid JSON: an array of {"followerId": string, "score": number, "comment": string, "objection": string}`;

export async function simulateVariant(
  profiles: FollowerProfile[],
  copy: string,
  onBatch: (reactions: Reaction[]) => void,
): Promise<Reaction[]> {
  const all: Reaction[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < profiles.length; i += BATCH_SIZE) {
    const batch = profiles.slice(i, i + BATCH_SIZE);
    let reactions: Reaction[];

    try {
      const payload = await completeJSON<ReactionPayload[]>(
        {
          system: SIM_SYSTEM,
          prompt: `CREATOR'S LAUNCH COPY:\n"""\n${copy}\n"""\n\nFOLLOWERS TO SIMULATE:\n${batch
            .map(
              (p) =>
                `- ${escapePrompt(p.handle)} (${escapePrompt(p.name)}) | bio: ${escapePrompt(
                  p.bio,
                )} | interests: ${escapePrompt(p.interests.join(", "))} | tone: ${p.tone} | engagement: ${p.engagement} | typical objection: ${escapePrompt(
                  p.objection,
                )} | segment: ${escapePrompt(p.segment)}`,
            )
            .join("\n")}\n\nReply with one reaction object per follower.`,
          tier: "fast",
          maxTokens: 2000,
        },
        isReactionPayload,
      );

      const byId = new Map(batch.map((p) => [p.id, p]));
      reactions = payload.flatMap((r) => {
        const profile = byId.get(r.followerId);
        if (!profile || seen.has(r.followerId)) return [];
        seen.add(r.followerId);
        return [
          {
            followerId: r.followerId,
            name: profile.name,
            handle: profile.handle,
            segment: profile.segment,
            score: Math.max(0, Math.min(100, Math.round(r.score))),
            comment: r.comment,
            objection: r.objection,
          },
        ];
      });

      const covered = new Set(reactions.map((r) => r.followerId));
      const missingCount = batch.filter((p) => !covered.has(p.id)).length;
      if (missingCount > 0) {
        throw new Error(`LLM omitted ${missingCount} follower(s) from this batch`);
      }
    } catch (err) {
      console.warn("[simulate] batch failed, falling back:", err);
      const missing = batch.filter((p) => !seen.has(p.id));
      reactions = fallbackReactions(missing, copy).filter((r) => {
        if (seen.has(r.followerId)) return false;
        seen.add(r.followerId);
        return true;
      });
    }

    all.push(...reactions);
    onBatch(reactions);
  }

  return all;
}