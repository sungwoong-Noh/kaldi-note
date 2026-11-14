import { describe, expect, it } from "vitest";
import { brewCountLabel } from "./brewCountLabel";

describe("brewCountLabel", () => {
  it("AC-HOMECAL-41 · 1건은 1잔, 0건은 0잔이고 활동일수가 있으면 N일 · M잔이다", () => {
    expect(brewCountLabel(1)).toBe("1잔");
    expect(brewCountLabel(0)).toBe("0잔");
    expect(brewCountLabel(9)).toBe("9잔");
    expect(brewCountLabel(12, 8)).toBe("8일 · 12잔");
  });
});
