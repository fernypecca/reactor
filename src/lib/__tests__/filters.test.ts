import { describe, expect, it } from "vitest";
import {
  applyFilter,
  bandCounts,
  isFiltered,
  matches,
  NO_FILTER,
  toggleFacet,
} from "../filters";
import type { Reaction } from "../types";

const r = (over: Partial<Reaction>): Reaction => ({
  followerId: "f1",
  name: "Test",
  handle: "@test",
  segment: "builder",
  score: 80,
  comment: "ok",
  objection: "",
  ...over,
});

const sample: Reaction[] = [
  r({ followerId: "a", score: 90, segment: "builder", objection: "" }),
  r({ followerId: "b", score: 55, segment: "builder", objection: "What is the price?" }),
  r({ followerId: "c", score: 20, segment: "operator", objection: "Show me the retention number" }),
  r({ followerId: "d", score: 75, segment: "lurker", objection: "" }),
];

describe("isFiltered", () => {
  it("is false for the empty filter", () => {
    expect(isFiltered(NO_FILTER)).toBe(false);
  });

  it("is true when any facet is set", () => {
    expect(isFiltered({ ...NO_FILTER, segment: "builder" })).toBe(true);
    expect(isFiltered({ ...NO_FILTER, band: "weak" })).toBe(true);
    expect(isFiltered({ ...NO_FILTER, cluster: "pricing" })).toBe(true);
  });
});

describe("applyFilter", () => {
  it("returns everything when nothing is selected", () => {
    expect(applyFilter(sample, NO_FILTER)).toHaveLength(4);
  });

  it("filters by segment", () => {
    const out = applyFilter(sample, { ...NO_FILTER, segment: "builder" });
    expect(out.map((x) => x.followerId)).toEqual(["a", "b"]);
  });

  it("filters by score band", () => {
    expect(applyFilter(sample, { ...NO_FILTER, band: "strong" }).map((x) => x.followerId)).toEqual(
      ["a", "d"],
    );
    expect(applyFilter(sample, { ...NO_FILTER, band: "weak" }).map((x) => x.followerId)).toEqual([
      "c",
    ]);
  });

  it("filters by objection cluster and excludes reactions with no objection", () => {
    const out = applyFilter(sample, { ...NO_FILTER, cluster: "pricing" });
    expect(out.map((x) => x.followerId)).toEqual(["b"]);
  });

  it("intersects facets", () => {
    const out = applyFilter(sample, { segment: "builder", band: "mixed", cluster: null });
    expect(out.map((x) => x.followerId)).toEqual(["b"]);
  });

  it("can return nothing without throwing", () => {
    expect(applyFilter(sample, { segment: "lurker", band: "weak", cluster: null })).toEqual([]);
  });
});

describe("matches", () => {
  it("agrees with applyFilter", () => {
    const f = { ...NO_FILTER, segment: "operator" };
    expect(sample.filter((x) => matches(x, f))).toEqual(applyFilter(sample, f));
  });
});

describe("toggleFacet", () => {
  it("sets a value that was not set", () => {
    expect(toggleFacet(NO_FILTER, "segment", "builder").segment).toBe("builder");
  });

  it("clears the value when clicked twice", () => {
    const once = toggleFacet(NO_FILTER, "segment", "builder");
    expect(toggleFacet(once, "segment", "builder").segment).toBeNull();
  });

  it("leaves the other facets untouched", () => {
    const f = toggleFacet({ ...NO_FILTER, band: "weak" }, "segment", "builder");
    expect(f.band).toBe("weak");
    expect(f.segment).toBe("builder");
  });
});

describe("bandCounts", () => {
  it("counts every reaction exactly once", () => {
    const c = bandCounts(sample);
    expect(c).toEqual({ strong: 2, mixed: 1, weak: 1 });
    expect(c.strong + c.mixed + c.weak).toBe(sample.length);
  });

  it("returns zeroes for an empty run", () => {
    expect(bandCounts([])).toEqual({ strong: 0, mixed: 0, weak: 0 });
  });
});
