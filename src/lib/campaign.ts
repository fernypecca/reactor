/**
 * What the simulator knows beyond the post itself.
 *
 * Without this the model sees a sentence with no product behind it, so every
 * follower asks the same three questions — price, audience, proof — because a
 * real reader with no context would too. Supplying it turns "what does this
 * cost?" into an objection about the actual number.
 */

export type Goal = "engagement" | "clicks" | "replies" | "signups" | "awareness";

export type Campaign = {
  /** free text: what the product is, who it is for, price, offer */
  context: string;
  goal: Goal;
};

export const GOALS: { id: Goal; label: string; hint: string }[] = [
  { id: "engagement", label: "Engagement", hint: "likes, reposts, general reach" },
  { id: "clicks", label: "Clicks", hint: "get them to the link" },
  { id: "replies", label: "Replies", hint: "start a conversation" },
  { id: "signups", label: "Signups", hint: "get them to try it" },
  { id: "awareness", label: "Awareness", hint: "be remembered, not acted on" },
];

export const GOAL_BRIEF: Record<Goal, string> = {
  engagement: "score how likely this follower is to like or repost it",
  clicks: "score how likely this follower is to click the link",
  replies: "score how likely this follower is to reply in their own words",
  signups: "score how likely this follower is to actually sign up or start a trial",
  awareness: "score how likely this follower is to remember this a week from now",
};

export const MAX_CONTEXT = 600;
export const EMPTY_CAMPAIGN: Campaign = { context: "", goal: "engagement" };

export function isGoal(v: unknown): v is Goal {
  return typeof v === "string" && GOALS.some((g) => g.id === v);
}

/** Clamped and coerced before it can reach a prompt. */
export function sanitizeCampaign(raw: unknown): Campaign {
  if (!raw || typeof raw !== "object") return EMPTY_CAMPAIGN;
  const o = raw as Record<string, unknown>;
  return {
    context: typeof o.context === "string" ? o.context.trim().slice(0, MAX_CONTEXT) : "",
    goal: isGoal(o.goal) ? o.goal : "engagement",
  };
}

export function hasContext(c: Campaign): boolean {
  return c.context.trim().length > 0;
}
