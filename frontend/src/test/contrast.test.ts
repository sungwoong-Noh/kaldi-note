import { describe, expect, it } from "vitest";
import { contrastRatio } from "./contrast";
import { readPalettes } from "./tokens";

/** 글자로 쓰이는 조합만 본다. line·surface는 구분선과 면이라 4.5 기준의 대상이 아니다. */
const TEXT_ON_BACKGROUND = ["brand", "danger", "muted", "foreground"] as const;
const ACCENT_SURFACES = ["brand", "danger"] as const;

/** WCAG AA. 4.5를 포함한다. */
const AA = 4.5;

describe("AC-VISUAL-07 · 글자 토큰의 대비가 AA를 넘는다", () => {
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
