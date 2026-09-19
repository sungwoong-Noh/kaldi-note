import { describe, expect, it } from "vitest";
import { brewCountLabel } from "./brewCountLabel";

describe("brewCountLabel", () => {
  it("AC-HOMECAL-41 · 1건은 1 BREW, 0건은 0 BREWS다", () => {
    expect(brewCountLabel(1)).toBe("1 BREW");
    expect(brewCountLabel(0)).toBe("0 BREWS");
    expect(brewCountLabel(9)).toBe("9 BREWS");
  });
});
