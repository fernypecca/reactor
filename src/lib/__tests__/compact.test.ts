import { describe, expect, it } from "vitest";
import { compact } from "@/components/Viz";

describe("compact", () => {
  it("formats plain numbers with separators", () => {
    expect(compact(0)).toBe("0");
    expect(compact(842)).toBe("842");
  });

  it("abbreviates thousands and millions", () => {
    expect(compact(1_000)).toBe("1k");
    expect(compact(38_200)).toBe("38.2k");
    expect(compact(1_500_000)).toBe("1.5M");
  });

  it("never leaks decimals from a count-up tween", () => {
    // the animated counter passes through fractional values on every frame
    expect(compact(482.043)).toBe("482");
    expect(compact(9.7)).toBe("10");
    expect(compact(38_249.6)).toBe("38.2k");
  });
});
