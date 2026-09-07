import { describe, expect, it } from "vitest";
import { TOKEN_NAMES, readPalettes } from "./tokens";

describe("디자인 토큰", () => {
  it("AC-VISUAL-06 · 토큰 8개가 라이트·다크 값을 모두 갖는다", () => {
    const { light, dark } = readPalettes();
    const expected = [...TOKEN_NAMES].sort();

    expect(Object.keys(light).sort()).toEqual(expected);
    expect(Object.keys(dark).sort()).toEqual(expected);
  });
});
