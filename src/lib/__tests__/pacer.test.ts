import { describe, expect, it } from "vitest";
import {
  MAX_INTERVAL_MS,
  MIN_INTERVAL_MS,
  REVEAL_BUDGET_MS,
  emptyQueue,
  intervalFor,
  pickNext,
  type PacerQueue,
} from "../pacer";
import type { Reaction } from "../types";

const r = (id: string): Reaction => ({
  followerId: id,
  name: id,
  handle: `@${id}`,
  segment: "builder",
  score: 70,
  comment: "ok",
  objection: "",
});

const q = (over: Partial<PacerQueue> = {}): PacerQueue => ({
  ...emptyQueue(true),
  ...over,
});

describe("emptyQueue", () => {
  it("marks B complete up front for a single-variant run", () => {
    expect(emptyQueue(false).bComplete).toBe(true);
    expect(emptyQueue(true).bComplete).toBe(false);
  });
});

describe("pickNext", () => {
  it("advances both variants on the same step", () => {
    const out = pickNext(q({ a: [r("a1")], b: [r("b1")] }));
    expect(out).toEqual({
      type: "reactions",
      items: [
        { variantId: "variant-1", reaction: r("a1") },
        { variantId: "variant-2", reaction: r("b1") },
      ],
    });
  });

  it("keeps one variant moving when the other has nothing buffered yet", () => {
    const out = pickNext(q({ a: [], b: [r("b1")], aComplete: false }));
    expect(out).toEqual({
      type: "reactions",
      items: [{ variantId: "variant-2", reaction: r("b1") }],
    });
  });

  it("ignores the B queue entirely on a single-variant run", () => {
    const single: PacerQueue = { ...emptyQueue(false), a: [r("a1")], b: [r("stray")] };
    const out = pickNext(single);
    expect(out).toEqual({
      type: "reactions",
      items: [{ variantId: "variant-1", reaction: r("a1") }],
    });
  });

  it("waits instead of revealing the verdict while either variant is streaming", () => {
    expect(pickNext(q({ aComplete: false, bComplete: true, tail: [{ kind: "done" }] }))).toEqual({
      type: "wait",
    });
    expect(pickNext(q({ aComplete: true, bComplete: false, tail: [{ kind: "done" }] }))).toEqual({
      type: "wait",
    });
  });

  it("releases the tail once both variants are done and drained", () => {
    const out = pickNext(
      q({ aComplete: true, bComplete: true, tail: [{ kind: "results", data: 1 }] }),
    );
    expect(out).toEqual({ type: "tail", event: { kind: "results", data: 1 } });
  });

  it("reports the end when nothing is left", () => {
    expect(pickNext(q({ aComplete: true, bComplete: true }))).toEqual({ type: "end" });
  });

  it("finishes both variants in step, never one before the other", () => {
    const queue = q({
      a: [r("a1"), r("a2"), r("a3")],
      b: [r("b1"), r("b2"), r("b3")],
      aComplete: true,
      bComplete: true,
      tail: [{ kind: "done" }],
    });
    const steps: string[] = [];
    for (let guard = 0; guard < 50; guard++) {
      const next = pickNext(queue);
      if (next.type === "end" || next.type === "wait") break;
      if (next.type === "reactions") {
        steps.push(next.items.map((i) => (i.variantId === "variant-1" ? "A" : "B")).join(""));
        for (const item of next.items) {
          (item.variantId === "variant-1" ? queue.a : queue.b).shift();
        }
      } else {
        steps.push("tail");
        queue.tail.shift();
      }
    }
    expect(steps).toEqual(["AB", "AB", "AB", "tail"]);
  });

  it("lets the longer queue finish alone when the variants are uneven", () => {
    const queue = q({
      a: [r("a1")],
      b: [r("b1"), r("b2")],
      aComplete: true,
      bComplete: true,
      tail: [],
    });
    const steps: string[] = [];
    for (let guard = 0; guard < 20; guard++) {
      const next = pickNext(queue);
      if (next.type !== "reactions") break;
      steps.push(next.items.map((i) => (i.variantId === "variant-1" ? "A" : "B")).join(""));
      for (const item of next.items) {
        (item.variantId === "variant-1" ? queue.a : queue.b).shift();
      }
    }
    expect(steps).toEqual(["AB", "B"]);
  });
});

describe("intervalFor", () => {
  it("spreads the steps across the budget", () => {
    expect(intervalFor(26)).toBe(Math.round(REVEAL_BUDGET_MS / 26));
  });

  it("stays watchable for a tiny audience", () => {
    expect(intervalFor(4)).toBe(MAX_INTERVAL_MS);
  });

  it("stays bearable for a huge one", () => {
    expect(intervalFor(1000)).toBe(MIN_INTERVAL_MS);
  });

  it("never divides by zero", () => {
    expect(intervalFor(0)).toBe(MAX_INTERVAL_MS);
  });

  it("takes the same wall time for one variant as for two", () => {
    // steps are per-variant now, so the headcount drives the runtime
    const steps = 26;
    const ms = intervalFor(steps) * steps;
    expect(ms).toBeGreaterThan(14_000);
    expect(ms).toBeLessThan(20_000);
  });
});
