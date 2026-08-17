import type { Reaction } from "./types";

/**
 * The network finishes whenever it finishes — two variants run in parallel and
 * arrive in batches of ten. That is fast, but it reads as three jumps and a
 * verdict. The pacer decouples presentation from arrival: reactions are
 * buffered and released on a clock, both variants advancing together, and the
 * verdict only lands once the whole room has reacted.
 */

/** total time the reveal should take, excluding the closing beat */
export const REVEAL_BUDGET_MS = 17_000;
export const MIN_INTERVAL_MS = 90;
export const MAX_INTERVAL_MS = 800;
/** slower cadence for the closing events, so the verdict gets a beat */
export const TAIL_INTERVAL_MS = 700;

export type VariantId = "variant-1" | "variant-2";

export type TailEvent =
  | { kind: "results"; data: unknown }
  | { kind: "rewrite"; data: unknown }
  | { kind: "done" };

export type PacerQueue = {
  a: Reaction[];
  b: Reaction[];
  /** set when the server says that variant has finished streaming */
  aComplete: boolean;
  bComplete: boolean;
  /** false for a single-variant run, so the pacer never waits on B */
  hasB: boolean;
  tail: TailEvent[];
};

export type Release =
  /** one step of the reveal: at most one reaction from each variant */
  | { type: "reactions"; items: { variantId: VariantId; reaction: Reaction }[] }
  | { type: "tail"; event: TailEvent }
  /** nothing buffered yet, but more is coming — hold the frame */
  | { type: "wait" }
  /** everything has been released */
  | { type: "end" };

export function emptyQueue(hasB: boolean): PacerQueue {
  return { a: [], b: [], aComplete: false, bComplete: !hasB, hasB, tail: [] };
}

/**
 * Decides what to show next. Pure and non-destructive: it reports the
 * decision, the caller shifts the queue.
 *
 * Both variants advance on the same tick so the two counters climb side by
 * side. If one runs dry the other keeps going rather than stalling the whole
 * reveal on a slow half of the network.
 */
export function pickNext(q: PacerQueue): Release {
  const items: { variantId: VariantId; reaction: Reaction }[] = [];
  if (q.a.length > 0) items.push({ variantId: "variant-1", reaction: q.a[0] });
  if (q.hasB && q.b.length > 0) {
    items.push({ variantId: "variant-2", reaction: q.b[0] });
  }
  if (items.length > 0) return { type: "reactions", items };

  // nothing buffered: is more still coming?
  if (!q.aComplete) return { type: "wait" };
  if (q.hasB && !q.bComplete) return { type: "wait" };

  if (q.tail.length > 0) return { type: "tail", event: q.tail[0] };
  return { type: "end" };
}

/**
 * Spread the reveal across the budget. The unit is a *step*, not a reaction:
 * one step reveals one follower per variant, so a two-variant run takes the
 * same wall time as a single one.
 */
export function intervalFor(steps: number): number {
  if (steps <= 0) return MAX_INTERVAL_MS;
  const raw = REVEAL_BUDGET_MS / steps;
  return Math.round(Math.min(Math.max(raw, MIN_INTERVAL_MS), MAX_INTERVAL_MS));
}
