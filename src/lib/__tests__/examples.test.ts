import { describe, expect, it } from "vitest";
import { EXAMPLE_POSTS, pickExample } from "../examples";

describe("EXAMPLE_POSTS", () => {
  it("offers several distinct starters", () => {
    expect(EXAMPLE_POSTS.length).toBeGreaterThanOrEqual(3);
    expect(new Set(EXAMPLE_POSTS).size).toBe(EXAMPLE_POSTS.length);
  });

  it("has no empty or placeholder copy", () => {
    for (const post of EXAMPLE_POSTS) {
      expect(post.trim().length).toBeGreaterThan(40);
      expect(post).not.toMatch(/lorem|\[.*\]|TODO/i);
    }
  });

  it("covers more than one persuasion angle", () => {
    // at least one with hard numbers and at least one without, so the
    // simulator visibly reacts differently depending on what you paste
    expect(EXAMPLE_POSTS.some((p) => /\d/.test(p))).toBe(true);
    expect(EXAMPLE_POSTS.some((p) => !/\d/.test(p))).toBe(true);
  });
});

describe("pickExample", () => {
  it("returns one of the known posts", () => {
    expect(EXAMPLE_POSTS).toContain(pickExample());
  });

  it("never repeats the post already on screen", () => {
    for (const current of EXAMPLE_POSTS) {
      for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
        expect(pickExample(current, () => r)).not.toBe(current);
      }
    }
  });

  it("still returns something when the current post is unknown", () => {
    expect(EXAMPLE_POSTS).toContain(pickExample("something the user typed"));
  });

  it("stays in range at the top of the random interval", () => {
    expect(pickExample(undefined, () => 0.9999999)).toBeDefined();
    expect(EXAMPLE_POSTS).toContain(pickExample(undefined, () => 0.9999999));
  });

  it("reaches every post across the interval", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(pickExample(undefined, () => i / 200));
    expect(seen.size).toBe(EXAMPLE_POSTS.length);
  });
});
