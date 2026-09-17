import { describe, expect, it } from "vitest";
import { ratioOf } from "./contrast";
import { oklchLuminance, parseOklch } from "./oklch";
import { type Palette, readPalettes } from "./tokens";

/** 글자로 쓰이는 조합만 본다. 면(surface·sunken)과 선(border·divider)은 4.5 기준의 대상이 아니다. */
const TEXT_ON_PAPER = ["ink", "ink-2", "ink-3", "accent", "danger"] as const;

/** WCAG AA. 4.5를 포함한다. */
const AA = 4.5;

/** 토큰 이름으로 휘도를 구한다. **값을 베껴 적지 않고 globals.css에서 읽는다.** */
function lum(palette: Palette, name: string): number {
  return oklchLuminance(parseOklch(palette[name]));
}

describe("AC-VISUAL-07 · AC-READ-06 · AC-DS2-04 · 글자 토큰의 대비가 AA를 넘는다", () => {
  const palettes = readPalettes();

  for (const [mode, palette] of Object.entries(palettes)) {
    for (const name of TEXT_ON_PAPER) {
      it(`${mode} · ${name}이 배경 위에서 ${AA} 이상이다`, () => {
        expect(
          ratioOf(lum(palette, name), lum(palette, "paper")),
        ).toBeGreaterThanOrEqual(AA);
      });
    }

    it(`${mode} · on-ink가 ink 위에서 ${AA} 이상이다`, () => {
      // primary 버튼이다 — 배경이 ink, 글자가 on-ink.
      expect(
        ratioOf(lum(palette, "on-ink"), lum(palette, "ink")),
      ).toBeGreaterThanOrEqual(AA);
    });
  }
});

/**
 * 읽힘 — docs/specs/2026-09-15-readability.md, 2026-09-17에 Clean Ledger로 갱신
 *
 * <p>원래 문제는 라이트 모드만 유독 흐렸던 것이다(muted 4.74:1 대 다크 7.66:1). 토큰이
 * oklch로 바뀌면서 값은 달라졌지만 **지켜야 할 것은 그대로다** — 라이트가 다크보다 흐리지 않을 것,
 * 그리고 오류가 보조 텍스트보다 잘 보일 것.
 *
 * <p><b>값을 리터럴로 고정하던 방식을 대비 하한으로 바꿨다.</b> 색 값은 디자인이 소유하고
 * (`docs/design/design_handoff_kaldi_note/README.md`), 테스트가 소유하는 것은 **읽힘의 기준**이다.
 */
describe("읽힘 — 대비의 하한", () => {
  const { light, dark } = readPalettes();

  it("AC-READ-01 · 보조 텍스트의 대비가 4.72:1 이상이다", () => {
    // 라이트 4.7295 · 다크 6.6329 (2026-09-17 실측). 라이트가 AA(4.5)를 겨우 넘는다 —
    // 이 하한을 더 낮추면 원래 문제(「라이트만 유독 흐리다」)로 돌아간다.
    expect(
      ratioOf(lum(light, "ink-3"), lum(light, "paper")),
    ).toBeGreaterThanOrEqual(4.72);
    expect(
      ratioOf(lum(dark, "ink-3"), lum(dark, "paper")),
    ).toBeGreaterThanOrEqual(4.72);
  });

  it("AC-READ-02 · 테두리가 배경과 구분된다", () => {
    /*
     * ★ 이 하한은 2026-09-17에 1.98에서 1.35로 **내려갔다.** 주의해서 읽을 것.
     *
     * readability 스펙은 `line`이 1.48:1이라 「카드 경계가 사실상 보이지 않는다」고 진단하고
     * 1.98:1로 올렸다. 그런데 핸드오프의 `border`는 **라이트 1.3956 · 다크 1.3531**이라
     * 그때 문제로 지목한 값보다도 흐리다.
     *
     * 디자인이 준 값을 그대로 쓰되(그림자 없이 1px 보더와 면의 명도 차이로만 층을 만드는
     * 체계다), **이것이 폰에서 실제로 보이는지는 자동 테스트가 답할 수 없다.**
     * 계획의 수동 확인 항목으로 올려두었다 — 안 보이면 디자인 쪽에 되돌린다.
     */
    expect(
      ratioOf(lum(light, "border"), lum(light, "paper")),
    ).toBeGreaterThanOrEqual(1.35);
    expect(
      ratioOf(lum(dark, "border"), lum(dark, "paper")),
    ).toBeGreaterThanOrEqual(1.35);
  });

  it("AC-READ-03 · AC-DS2-03 · 오류색이 보조 텍스트보다 잘 보인다", () => {
    // 「고쳐야 할 것」이 「안 읽어도 되는 것」보다 안 보이면 안 된다.
    for (const palette of [light, dark]) {
      const paper = lum(palette, "paper");
      expect(ratioOf(lum(palette, "danger"), paper)).toBeGreaterThan(
        ratioOf(lum(palette, "ink-3"), paper),
      );
    }
  });

  it("AC-READ-16 · 판정이 4.72를 통과로, 4.73을 미달로 준다", () => {
    // 라이트 ink-3의 실제 대비는 4.7295…다. 상수를 그냥 true로 돌려주는 판정이 아님을 이것으로 본다.
    const ratio = ratioOf(lum(light, "ink-3"), lum(light, "paper"));

    expect(ratio >= 4.72).toBe(true);
    expect(ratio >= 4.73).toBe(false);
  });

  it("AC-READ-05 · 다크 모드도 같은 기준을 만족한다", () => {
    // 예전에는 다크 값 8개를 리터럴로 고정했다. 이제는 두 모드가 같은 기준을 통과하는지 본다 —
    // 어느 한쪽만 흐려지는 것이 원래 문제였다.
    const paper = lum(dark, "paper");
    const below = TEXT_ON_PAPER.filter(
      (name) => ratioOf(lum(dark, name), paper) < AA,
    );

    expect(below).toEqual([]);
  });
});
