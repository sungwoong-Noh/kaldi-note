import { describe, expect, it } from "vitest";
import { contrastRatio } from "./contrast";
import { readPalettes } from "./tokens";

/** 글자로 쓰이는 조합만 본다. line·surface는 구분선과 면이라 4.5 기준의 대상이 아니다. */
const TEXT_ON_BACKGROUND = ["brand", "danger", "muted", "foreground"] as const;
const ACCENT_SURFACES = ["brand", "danger"] as const;

/** WCAG AA. 4.5를 포함한다. */
const AA = 4.5;

describe("AC-VISUAL-07 · AC-READ-06 · 글자 토큰의 대비가 AA를 넘는다", () => {
  const palettes = readPalettes();

  for (const [mode, palette] of Object.entries(palettes)) {
    for (const name of TEXT_ON_BACKGROUND) {
      it(`${mode} · ${name}이 배경 위에서 ${AA} 이상이다`, () => {
        expect(
          contrastRatio(palette[name], palette.background),
        ).toBeGreaterThanOrEqual(AA);
      });
    }

    for (const name of ACCENT_SURFACES) {
      it(`${mode} · on-accent가 ${name} 위에서 ${AA} 이상이다`, () => {
        expect(
          contrastRatio(palette["on-accent"], palette[name]),
        ).toBeGreaterThanOrEqual(AA);
      });
    }
  }
});

/**
 * 읽힘 — docs/specs/2026-09-15-readability.md
 *
 * <p>라이트 모드만 유독 흐렸다. muted가 4.74:1인데 다크는 7.66:1이라, 낮에 부엌에서 라벨이
 * 읽히지 않고 밤에는 괜찮았다. 두 모드가 대칭이 되도록 라이트만 올린다.
 */
describe("읽힘 — 라이트 모드의 대비", () => {
  const { light, dark } = readPalettes();

  it("AC-READ-01 · 보조색이 #545454이고 대비가 7.57:1 이상이다", () => {
    expect(light.muted).toBe("#545454");
    expect(contrastRatio(light.muted, light.background)).toBeGreaterThanOrEqual(
      7.57,
    );
  });

  it("AC-READ-02 · 테두리색이 #b8b8b8이다", () => {
    expect(light.line).toBe("#b8b8b8");
    expect(contrastRatio(light.line, light.background)).toBeGreaterThanOrEqual(
      1.98,
    );
  });

  it("AC-READ-03 · 오류색이 #b91c1c이고 대비가 6.47:1 이상이다", () => {
    expect(light.danger).toBe("#b91c1c");
    expect(contrastRatio(light.danger, light.background)).toBeGreaterThanOrEqual(
      6.47,
    );
  });

  it("AC-READ-16 · 판정이 7.57을 통과로, 7.58을 미달로 준다", () => {
    // 실제 대비는 7.5749…다. 상수를 그냥 true로 돌려주는 판정이 아님을 이것으로 본다.
    const ratio = contrastRatio(light.muted, light.background);

    expect(ratio >= 7.57).toBe(true);
    expect(ratio >= 7.58).toBe(false);
  });

  it("AC-READ-05 · 다크 모드 값 8개가 그대로다", () => {
    expect(dark).toEqual({
      background: "#0a0a0a",
      foreground: "#ededed",
      brand: "#c9a98a",
      "on-accent": "#171717",
      danger: "#f87171",
      muted: "#a1a1a1",
      line: "#404040",
      surface: "#262626",
    });
  });
});
