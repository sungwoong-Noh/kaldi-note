# 시각 위계 정비 구현 계획

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.

**Spec:** `docs/specs/2026-09-07-visual-hierarchy.md`

**Goal:** 색을 CSS 변수 토큰 8개로, 글자 크기를 역할 5단계로 잠근다. 허용목록 밖의 색·크기 클래스가
소스에 하나도 남지 않고, 실제 브라우저에서 잰 값이 토큰과 일치한다.

**Architecture:** 토큰을 먼저 세우고(Task 1), 그 위에서 눈에 보이는 규칙(대표 수치·화면 제목)을
테스트로 못박은 뒤(Task 2·3), 남은 파일을 일괄로 옮기며 소스 잠금을 건다(Task 4). 실제 렌더값은
마지막에 브라우저로 잰다(Task 5).

**소스 잠금(AC-01~05)을 Task 4에 두는 이유는 그 전에는 반드시 빨갛기 때문이다.** 31개 파일이 다
옮겨지기 전까지 「허용목록 밖 0곳」은 성립할 수 없는데, **각 태스크는 초록으로 끝나야 한다.**
그래서 Task 4 안에서 「검사 작성 → 빨강 확인 → 일괄 이관 → 초록 확인」을 한 사이클로 돈다.

**작업 위치:** `frontend/`

**반드시 먼저 읽을 것:** `CLAUDE.md`(루트) → `frontend/CLAUDE.md` → `docs/conventions/frontend.md` → `docs/conventions/git.md`

---

## AC 커버리지 매핑

| AC ID | 요약 | 담당 태스크 | 검증 방식 |
|---|---|---|---|
| AC-VISUAL-01 | 앰버 클래스 0곳 | Task 4 | 소스 검사 (vitest) |
| AC-VISUAL-02 | 팔레트 색 클래스 0곳 | Task 4 | 소스 검사 (vitest) |
| AC-VISUAL-03 | `dark:` 색 클래스 0곳 | Task 4 | 소스 검사 (vitest) |
| AC-VISUAL-04 | 임의값 색 0곳 | Task 4 | 소스 검사 (vitest) |
| AC-VISUAL-05 | 허용 크기 5개 밖 0곳 | Task 4 | 소스 검사 (vitest) |
| AC-VISUAL-06 | 토큰 8개가 양쪽 값을 가짐 | Task 1 | 소스 검사 (vitest) |
| AC-VISUAL-07 | 글자 토큰 대비 ≥ 4.5 | Task 1 | 계산 테스트 (vitest) |
| AC-VISUAL-08 | 레시피 카드 대표 수치 | Task 2 | 컴포넌트 테스트 |
| AC-VISUAL-09 | 로그 카드 대표 수치 = 비율 | Task 2 | 컴포넌트 테스트 |
| AC-VISUAL-10 | 비율 없으면 온도 승격 | Task 2 | 컴포넌트 테스트 |
| AC-VISUAL-11 | 승격된 값은 보조줄에서 빠짐 | Task 2 | 컴포넌트 테스트 |
| AC-VISUAL-12 | 대표 수치는 언제나 1개 | Task 2 | 컴포넌트 테스트 |
| AC-VISUAL-13 | h1 11곳이 같은 단계 | Task 3 | 소스 검사 (vitest) |
| AC-VISUAL-14 | 주 액션 버튼 배경 실측 | Task 5 | e2e (Playwright) |
| AC-VISUAL-15 | h1 20px 실측 | Task 5 | e2e (Playwright) |
| AC-VISUAL-16 | 대표 수치 18px 실측 | Task 5 | e2e (Playwright) |
| AC-VISUAL-17 | 라벨 색 실측 | Task 5 | e2e (Playwright) |
| AC-VISUAL-18 | 다크모드에서 쌍이 바뀜 | Task 5 | e2e (Playwright) |

**스펙의 AC 18개 중 18개가 매핑됐다.**

---

## Global Constraints

- **백엔드를 건드리지 않는다.** `backend/` 아래 파일 변경 0건이어야 한다.
- **픽스처를 지어내지 않는다.** `brewRatio`가 없는 픽스처는 실제 응답에서 그 필드만 덜어내 만든다
  (`docs/conventions/frontend.md`「픽스처는 실제 응답에서 뜬다」).
- **각 태스크는 초록으로 끝난다.** 다음 태스크로 넘어가기 전 `pnpm test`가 통과해야 한다.
- **기존 테스트 325개를 깨뜨리지 않는다.** 클래스를 단언하는 기존 테스트는 `BottomNav.test.tsx`의
  레이아웃 클래스(`mt-auto`·`sticky`·`bottom-0`) 하나뿐이라 색·크기 이관의 영향을 받지 않는다.
- **`pnpm format`을 무심코 돌리지 않는다.** `pnpm-lock.yaml`까지 포맷해 무관한 파일이 커밋에 딸려
  들어간 적이 있다(`docs/JOURNAL.md` 2026-09-07).

---

## File Structure

```
frontend/
├── src/
│   ├── app/globals.css                      수정 — 토큰 8개
│   ├── test/
│   │   ├── tokens.ts                        신규 — globals.css 파서
│   │   ├── contrast.ts                      신규 — WCAG 대비 계산
│   │   ├── contrast.test.ts                 신규 — AC-07
│   │   ├── designTokens.test.ts             신규 — AC-01~06
│   │   └── headings.test.ts                 신규 — AC-13
│   ├── components/                          수정 — ErrorState · LoadingState · BottomNav
│   ├── features/                            수정 — 카드 · 상세 · 폼 · 다이얼로그
│   └── app/**/page.tsx                       수정 — 화면 9개
└── e2e/visual.spec.ts                       신규 — AC-14~18
```

---

## 색 이관 대응표

**Task 2·3·4가 공통으로 쓴다.** 왼쪽을 오른쪽으로 바꾼다. `dark:` 짝은 **지운다** — 토큰이 처리한다.

| 기존 | 새 |
|---|---|
| `bg-neutral-900 text-white` (+ `dark:bg-white dark:text-neutral-900`) | `bg-brand text-on-accent` |
| `bg-red-600 text-white` | `bg-danger text-on-accent` |
| `text-red-600` (+ `dark:text-red-400`) | `text-danger` |
| `border-red-300` (+ `dark:border-red-800`) | `border-danger` |
| `text-neutral-500` · `text-neutral-600` (+ `dark:text-neutral-400` · `dark:text-neutral-300`) | `text-muted` |
| `text-neutral-900` | 삭제 — 본문색이 기본값이다 |
| `border-neutral-300` · `border-neutral-200` · `border-black/10` (+ `dark:` 짝) | `border-line` |
| `bg-neutral-100` · `bg-neutral-50` · `bg-neutral-200` (+ `dark:` 짝) | `bg-surface` |
| `bg-white` · `bg-[var(--background)]` | `bg-background` |
| `text-amber-600` — 「부족합니다」·「초과합니다」 | `text-danger` |
| `text-amber-600` — 「환산 정보가 없습니다」 | `text-muted` |
| `text-2xl font-bold` (h1) | `text-xl font-semibold` |
| `text-xl` (별 아이콘) | `text-[22px]` |

**손대지 않는 것**

- `bg-black/40` 4곳 — 다이얼로그 배경막. 스펙이 명시한 예외다.
- `opacity-50` (비활성 버튼) — 색 클래스가 아니다.

**판단이 필요했던 두 곳** (스펙이 직접 정하지 않아 보수적으로 옮긴다)

- **`LoadingState`의 스피너** `border-neutral-300 border-t-neutral-900` → `border-line border-t-foreground`.
  브랜드색을 쓰면 눈에 띄지만 **스펙이 승인한 것은 「색은 액션에만」이고 스피너는 액션이 아니다.**
  지금 인상을 그대로 옮기는 쪽을 택한다.
- **`BottomNav`의 비활성 탭** `opacity-60` → `text-muted`. 같은 목적(보조로 내리기)에 투명도와 색을
  섞어 쓰던 것을 색으로 통일한다. 활성 탭은 `font-semibold text-brand`를 받는다.

---

## Task 1: 토큰 정의와 대비 잠금

**Files:**
- Create: `frontend/src/test/tokens.ts`
- Create: `frontend/src/test/contrast.ts`
- Create: `frontend/src/test/contrast.test.ts`
- Create: `frontend/src/test/designTokens.test.ts`
- Modify: `frontend/src/app/globals.css`

**Covers:** AC-VISUAL-06, AC-VISUAL-07

**Interfaces:**
- Produces: `readPalettes(): { light: Palette; dark: Palette }` · `contrastRatio(a: string, b: string): number` · `TOKEN_NAMES: readonly string[]`
- Consumes: 없음

- [x] **Step 1: 시작 전 초록을 확인한다**

Run: `cd frontend && pnpm test`
Expected: PASS. **325개**.

- [x] **Step 2: 실패하는 테스트 작성 — 파서와 대비**

`src/test/tokens.ts` (헬퍼, 테스트 아님):

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** 스펙이 정한 토큰 8개. 이 목록이 곧 허용목록이다. */
export const TOKEN_NAMES = [
  "background",
  "foreground",
  "brand",
  "on-accent",
  "danger",
  "muted",
  "line",
  "surface",
] as const;

export type Palette = Record<string, string>;

const CSS_PATH = join("src", "app", "globals.css");
const DARK_MARKER = "@media (prefers-color-scheme: dark)";

/**
 * `--name: #rrggbb;`만 긁는다. `@theme inline`이 `var(...)`로 넘기는 줄은 hex가 아니라 걸리지 않는다.
 */
function hexes(css: string): Palette {
  const found: Palette = {};
  for (const match of css.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    found[match[1]] = match[2].toLowerCase();
  }
  return found;
}

/**
 * 라이트는 다크 블록 앞, 다크는 그 뒤.
 *
 * <p><b>값을 표에서 베끼지 않고 실제 파일을 읽는다.</b> 베끼면 토큰을 고쳐도 테스트가 옛 값을 검사한다.
 */
export function readPalettes(): { light: Palette; dark: Palette } {
  const css = readFileSync(CSS_PATH, "utf8");
  const at = css.indexOf(DARK_MARKER);
  if (at < 0) throw new Error(`${DARK_MARKER} 블록이 없다`);
  return { light: hexes(css.slice(0, at)), dark: hexes(css.slice(at)) };
}
```

`src/test/contrast.ts` (헬퍼):

```ts
/** WCAG 2.1 상대 휘도. sRGB 채널을 선형화해 가중합한다. */
function channel(value: number): number {
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map(
    (index) => parseInt(hex.slice(index, index + 2), 16) / 255,
  );
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}
```

`src/test/contrast.test.ts`:

```ts
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
```

`src/test/designTokens.test.ts` (이번엔 AC-06만. AC-01~05는 Task 4에서 더한다):

```ts
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
```

- [x] **Step 3: 실행 — 실패 확인**

Run: `cd frontend && pnpm test src/test/contrast.test.ts src/test/designTokens.test.ts`
Expected: FAIL — 지금 `globals.css`에는 `--background`·`--foreground` 둘뿐이라 AC-06이
`["background","foreground"]`와 8개를 비교하며 깨지고, 대비 테스트는 `palette.brand`가
`undefined`라 `parseInt`가 `NaN`을 낸다.

- [x] **Step 4: globals.css에 토큰을 박는다**

```css
@import "tailwindcss";

:root {
  --background: #ffffff;
  --foreground: #171717;

  /* 의미색. 강조는 액션에만 쓴다 — 수치는 크기로 올린다(docs/specs/2026-09-07-visual-hierarchy.md). */
  --brand: #6f4e37;
  --on-accent: #ffffff;
  --danger: #dc2626;
  --muted: #737373;

  /* 표면색. 글자가 아니라 4.5:1 기준의 대상이 아니다. 지금 쓰는 neutral-300·100과 같은 색이다. */
  --line: #d4d4d4;
  --surface: #f5f5f5;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-brand: var(--brand);
  --color-on-accent: var(--on-accent);
  --color-danger: var(--danger);
  --color-muted: var(--muted);
  --color-line: var(--line);
  --color-surface: var(--surface);
  /*
   * 웹폰트를 받지 않는다. 부엌에서 폰으로, 느린 회선에서 쓰는 것이 주 환경이라
   * 0바이트·즉시 렌더가 실질 이득이 크다(docs/specs/2026-09-05-polish.md).
   */
  --font-sans:
    system-ui, -apple-system, "Segoe UI", Roboto, "Apple SD Gothic Neo",
    "Noto Sans KR", "Malgun Gothic", sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, monospace;
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #0a0a0a;
    --foreground: #ededed;

    /* 밝은 브라운 위에는 흰 글자가 2.20:1로 미달이라 on-accent가 검정으로 뒤집힌다. */
    --brand: #c9a98a;
    --on-accent: #171717;
    --danger: #f87171;
    --muted: #a1a1a1;

    --line: #404040;
    --surface: #262626;
  }
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans);
  /* 이 앱은 숫자가 주인공이다. 자릿수가 정렬돼야 목록에서 값이 흔들리지 않는다. */
  font-variant-numeric: tabular-nums;
}
```

> **`--font-mono`가 hex를 갖지 않으므로 파서에 걸리지 않는다.** `@theme inline`의 `var(...)` 줄도
> 마찬가지다. 파서가 긁는 것은 `:root` 두 블록의 hex 8개씩뿐이다.

- [x] **Step 5: 실행 — 통과 확인**

Run: `cd frontend && pnpm test`
Expected: PASS. **338개**(325 + 대비 12 + 토큰 1).

- [x] **Step 6: 커밋**

```bash
cd frontend && pnpm typecheck && pnpm lint && pnpm test && cd ..
git add frontend/src/app/globals.css frontend/src/test
git commit -m "feat(web): 색 토큰 8개와 대비 잠금 (AC-VISUAL-06·07)"
```

---

## Task 2: 대표 수치와 카드

**Files:**
- Modify: `frontend/src/features/recipe/components/RecipeCard.tsx`
- Create: `frontend/src/features/recipe/components/RecipeCard.test.tsx` — **계획은 `Modify`로 적었으나 카드에는 전용 테스트가 없었다. 화면 테스트를 통해서만 렌더되고 있었다**
- Modify: `frontend/src/features/brewlog/components/BrewLogCard.tsx`
- Create: `frontend/src/features/brewlog/components/BrewLogCard.test.tsx` — 위와 같음

**Covers:** AC-VISUAL-08, 09, 10, 11, 12

**Interfaces:**
- Consumes: Task 1의 토큰 유틸리티(`text-muted`·`border-line`·`bg-surface`)
- Produces: 대표 수치 규칙 — `text-lg font-semibold`를 가진 요소가 카드마다 정확히 1개

- [x] **Step 1: 실패하는 테스트 작성 — 레시피 카드**

`RecipeCard.test.tsx`에 더한다.

```ts
  it("AC-VISUAL-08 · 대표 수치는 도즈와 물이고 18px 단계를 받는다", () => {
    render(
      <ul>
        <RecipeCard recipe={kasuyaSummary} />
      </ul>,
    );

    // 20.0g과 300.0g이 한 줄에 묶여 있고, 그 줄이 대표 수치 단계를 받는다.
    const line = screen.getByText("20.0g").parentElement;
    expect(line).toHaveClass("text-lg", "font-semibold");
    expect(line).toHaveTextContent("300.0g");
  });
```

- [x] **Step 2: 실패하는 테스트 작성 — 로그 카드**

`BrewLogCard.test.tsx`에 더한다. **비율 없는 픽스처는 실제 응답에서 그 필드만 덜어내 만든다.**

```ts
/** 실제 응답에서 brewRatio만 덜어낸 것. 지어내지 않는다. */
const withoutRatio = (() => {
  const { brewRatio, ...rest } = brewLogPage.content[0];
  return rest;
})();

  it("AC-VISUAL-09 · 비율이 있으면 그것이 대표 수치다", () => {
    render(
      <ul>
        <BrewLogCard log={brewLogPage.content[0]} recipeLabel="Kasuya 4:6" />
      </ul>,
    );

    expect(screen.getByText("1:15.0")).toHaveClass("text-lg", "font-semibold");
  });

  it("AC-VISUAL-10 · 비율이 없으면 물 온도가 승격된다", () => {
    render(
      <ul>
        <BrewLogCard log={withoutRatio} recipeLabel="Kasuya 4:6" />
      </ul>,
    );

    expect(screen.getByText("92°C")).toHaveClass("text-lg", "font-semibold");
  });

  it("AC-VISUAL-11 · 승격된 값은 보조줄에 다시 나오지 않는다", () => {
    render(
      <ul>
        <BrewLogCard log={withoutRatio} recipeLabel="Kasuya 4:6" />
      </ul>,
    );

    expect(screen.getAllByText("92°C")).toHaveLength(1);
  });

  it("AC-VISUAL-12 · 대표 수치는 두 경우 모두 정확히 1개다", () => {
    for (const log of [brewLogPage.content[0], withoutRatio]) {
      const { container, unmount } = render(
        <ul>
          <BrewLogCard log={log} recipeLabel="Kasuya 4:6" />
        </ul>,
      );

      expect(container.querySelectorAll(".text-lg.font-semibold")).toHaveLength(1);
      unmount();
    }
  });
```

- [x] **Step 3: 실행 — 실패 확인**

Run: `cd frontend && pnpm test RecipeCard BrewLogCard`
Expected: FAIL — 지금 두 카드 모두 `text-sm` 한 줄에 값을 나열하므로 `text-lg`가 0개다.
AC-VISUAL-10은 `92°C`를 찾긴 하지만 클래스가 없어 깨진다.

- [x] **Step 4: RecipeCard를 고친다**

`<dl>`을 두 줄로 나눈다. 첫 줄이 대표 수치, 둘째 줄이 보조다.

```tsx
        <dl className="mt-2 flex flex-col gap-1">
          <div className="flex items-center gap-1 text-lg font-semibold">
            <dt className="sr-only">원두</dt>
            <dd>{formatGrams(recipe.doseG)}</dd>
            <span aria-hidden>→</span>
            <dt className="sr-only">물</dt>
            <dd>{formatGrams(recipe.waterG)}</dd>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <div>
              <dt className="sr-only">비율</dt>
              <dd>{formatRatio(recipe.ratio)}</dd>
            </div>

            {recipe.waterTempC !== undefined && (
              <div>
                <dt className="sr-only">물 온도</dt>
                <dd>{formatTemperature(recipe.waterTempC)}</dd>
              </div>
            )}

            {recipe.totalTimeSeconds !== undefined && (
              <div>
                <dt className="sr-only">총 시간</dt>
                <dd>{formatDuration(recipe.totalTimeSeconds)}</dd>
              </div>
            )}
          </div>
        </dl>
```

같은 커밋에서 카드 껍데기도 대응표대로 옮긴다.

```tsx
        className="block rounded-lg border border-line p-4 active:bg-surface"
```

CURATED 칩:

```tsx
            <span className="shrink-0 rounded bg-surface px-1.5 py-0.5 text-xs text-muted">
```

- [x] **Step 5: BrewLogCard를 고친다**

대표 수치를 고르고, 고른 값을 보조 목록에서 뺀다.

```tsx
/**
 * 대표 수치. 목록에서 카드마다 정확히 하나가 18px로 뜬다.
 *
 * <p><b>비율이 우선이다.</b> 레시피 카드가 「도즈 → 물」을 보여주므로 같은 축에서 비교된다.
 *
 * <p><b>비율이 없으면 물 온도로 내려간다.</b> `brewRatio`는 프론트 스키마에서 옵션이라 타입상
 * 빌 수 있다. 지금 백엔드로는 도달할 수 없지만(`actual_dose_g`·`actual_water_g`가 둘 다
 * `nullable = false`이고 분기 없이 나눈다), 분기를 두는 한 그 안이 비면 대표 자리가 조용히
 * 사라진다. 물 온도는 필수라 마지막 보루가 된다.
 */
function headline(log: BrewLogSummary): { label: string; value: string } {
  return log.brewRatio !== undefined
    ? { label: "브루 비율", value: formatRatio(log.brewRatio) }
    : { label: "물 온도", value: formatTemperature(log.actualWaterTempC) };
}
```

`summaryEntries`가 대표로 뽑힌 라벨을 빼도록 인자를 받는다.

```tsx
function summaryEntries(
  log: BrewLogSummary,
  taken: string,
): { label: string; value: string }[] {
  const entries = [
    { label: "내린 날", value: formatBrewedDate(log.brewedAt) },
    { label: "브루 비율", value: log.brewRatio && formatRatio(log.brewRatio) },
    { label: "물 온도", value: formatTemperature(log.actualWaterTempC) },
    {
      label: "추출 시간",
      value:
        log.actualTotalTimeSeconds !== undefined &&
        formatDuration(log.actualTotalTimeSeconds),
    },
    {
      label: "추출 수율",
      value:
        log.extractionYieldPercent !== undefined &&
        `${log.extractionYieldPercent} %`,
    },
  ];

  return entries.filter(
    (entry): entry is { label: string; value: string } =>
      typeof entry.value === "string" && entry.label !== taken,
  );
}
```

본문:

```tsx
  const lead = headline(log);

  ...

        <dl className="mt-2 flex flex-col gap-1">
          <div className="text-lg font-semibold">
            <dt className="sr-only">{lead.label}</dt>
            <dd>{lead.value}</dd>
          </div>

          <div className="flex flex-wrap items-center gap-x-1 gap-y-1 text-xs text-muted">
            {summaryEntries(log, lead.label).map((entry, index) => (
              <div key={entry.label} className="flex items-center gap-1">
                {index > 0 && <span aria-hidden>·</span>}
                <dt className="sr-only">{entry.label}</dt>
                <dd>{entry.value}</dd>
              </div>
            ))}
          </div>
        </dl>
```

껍데기와 별점도 대응표대로 옮긴다.

```tsx
        className="block rounded-lg border border-line p-4 active:bg-surface"
```

```tsx
            <span className="shrink-0 text-sm text-muted">
```

> **`screen.getByText("1:15.0")`이 `dd`를 잡는데 클래스는 부모 `div`에 있다.** 그래서 대표 수치
> 줄은 `dd`가 아니라 **감싸는 `div`에 `text-lg font-semibold`를 준다**. 로그 카드는 `dd`가 하나뿐이라
> `getByText`가 `dd`를 돌려주므로, 테스트가 `toHaveClass`를 거는 대상이 어긋난다.
> **Step 2의 AC-09·10은 `dd`가 아니라 그 부모를 봐야 한다.** 실행해서 실패 메시지를 확인한 뒤
> `.parentElement`로 맞춘다 — 레시피 카드(AC-08)가 이미 그 형태다.

- [x] **Step 6: 실행 — 통과 확인**

Run: `cd frontend && pnpm test`
Expected: PASS. **343개**(338 + 5).

- [x] **Step 7: 커밋**

```bash
cd frontend && pnpm typecheck && pnpm lint && pnpm test && cd ..
git add frontend/src/features
git commit -m "feat(web): 목록 카드의 대표 수치 (AC-VISUAL-08~12)"
```

---

## Task 3: 화면 제목 통일

**Files:**
- Create: `frontend/src/test/headings.test.ts`
- Modify: `frontend/src/app/login/page.tsx`
- Modify: `frontend/src/app/login/test/page.tsx`
- Modify: `frontend/src/app/offline/page.tsx`
- Modify: `frontend/src/features/user/components/UserProfile.tsx`

**Covers:** AC-VISUAL-13

**Interfaces:**
- Consumes: 없음
- Produces: `<h1`이 `text-xl font-semibold`를 갖는다는 불변식

- [x] **Step 1: 실패하는 테스트 작성**

`src/test/headings.test.ts`:

```ts
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const SOURCES = walk("src").filter(
  (path) => path.endsWith(".tsx") && !path.includes(".test."),
);

/** `<h1 className="...">`의 클래스 문자열만 뽑는다. */
function headingClasses(source: string): string[] {
  return [...source.matchAll(/<h1[^>]*className="([^"]*)"/g)].map((m) => m[1]);
}

describe("AC-VISUAL-13 · 화면 제목 14곳이 같은 단계를 쓴다", () => {
  const found = SOURCES.flatMap((path) =>
    headingClasses(readFileSync(path, "utf8")).map((className) => ({
      path,
      className,
    })),
  );

  it("h1이 14곳이다", () => {
    expect(found).toHaveLength(14);
  });

  it("모든 h1이 text-xl font-semibold다", () => {
    const offenders = found.filter(
      ({ className }) =>
        !className.includes("text-xl") || !className.includes("font-semibold"),
    );
    expect(offenders).toEqual([]);
  });
});
```

- [x] **Step 2: 실행 — 실패 확인**

Run: `cd frontend && pnpm test src/test/headings.test.ts`
Expected: FAIL — 개수 단언은 통과하고(14곳), 클래스 단언이 깨진다. offenders에 넷이 담긴다 —
`/login`(`text-2xl font-semibold`), `/login/test`·`/offline`·`UserProfile`(`text-2xl font-bold`).

> **14곳은 세어서 확정한 값이다.** `app/page.tsx` · `app/brews/page.tsx` ·
> `app/gear/grind-converter/page.tsx` · `app/more/page.tsx` · `app/recipes/new/page.tsx` ·
> `app/recipes/page.tsx` · `app/login/page.tsx` · `app/login/test/page.tsx` · `app/offline/page.tsx` ·
> `BrewLogForm.tsx` · `BrewLogEditor.tsx` · `RecipeEditor.tsx` · `RecipeDetail.tsx` · `UserProfile.tsx`.
> **개수가 14가 아니면 화면이 늘거나 줄어든 것이다** — 테스트를 개수에 맞추지 말고 무엇이 바뀌었는지
> 먼저 본다.

- [x] **Step 3: 네 곳을 규칙에 맞춘다**

```tsx
<h1 className="text-xl font-semibold">kaldi note</h1>
<h1 className="text-xl font-semibold">테스트 로그인</h1>
<h1 className="text-xl font-semibold">연결 없음</h1>
<h1 className="text-xl font-semibold">{profile.data.nickname}</h1>
```

- [x] **Step 4: 실행 — 통과 확인**

Run: `cd frontend && pnpm test`
Expected: PASS. **345개**(343 + 2).

- [x] **Step 5: 커밋**

```bash
cd frontend && pnpm typecheck && pnpm lint && pnpm test && cd ..
git add frontend/src
git commit -m "feat(web): 화면 제목을 한 단계로 통일 (AC-VISUAL-13)"
```

---

## Task 4: 전면 이관과 소스 잠금

**Files:**
- Modify: `frontend/src/test/designTokens.test.ts`
- Modify: 대응표가 걸리는 나머지 파일 전부 (Task 2·3에서 이미 옮긴 것 제외)
- Modify: `frontend/src/features/brewlog/components/RatingInput.tsx`

**Covers:** AC-VISUAL-01, 02, 03, 04, 05

**Interfaces:**
- Consumes: 「색 이관 대응표」
- Produces: 허용목록 밖 클래스가 0곳이라는 불변식

- [x] **Step 1: 실패하는 검사를 먼저 쓴다**

`src/test/designTokens.test.ts`에 더한다. **이 파일 자신은 검사 대상에서 뺀다** — 금지 문자열을
리터럴로 담고 있어 넣어두면 무엇을 고치든 자기 자신이 offender로 잡힌다(`polish.test.ts`의 선례).

```ts
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const SELF = join("src", "test", "designTokens.test.ts");

const SOURCES = walk("src").filter(
  (path) => /\.(ts|tsx)$/.test(path) && path !== SELF,
);

function offenders(pattern: RegExp): string[] {
  return SOURCES.filter((path) => pattern.test(readFileSync(path, "utf8")));
}

describe("허용목록", () => {
  it("AC-VISUAL-01 · 앰버 클래스가 없다", () => {
    expect(offenders(/\b(?:text|bg|border|ring)-amber-/)).toEqual([]);
  });

  it("AC-VISUAL-02 · 팔레트 색 클래스가 없다", () => {
    // 다이얼로그 배경막 bg-black/40만 예외다. border-black/10은 예외가 아니라 border-line으로 옮긴다.
    // `bg-black\b`로 쓰면 `/`가 단어 경계라 배경막까지 잡힌다 — 14개 경우로 확인했다.
    const palette =
      /\b(?:text|bg|border|ring)-(?:neutral-|red-|white\b)|\b(?:text|border|ring)-black\b|\bbg-black(?![/\w])/;
    expect(offenders(palette)).toEqual([]);
  });

  it("AC-VISUAL-03 · dark: 색 클래스가 없다", () => {
    expect(offenders(/\bdark:(?:text|bg|border|ring)-/)).toEqual([]);
  });

  it("AC-VISUAL-04 · 임의값 색이 없다", () => {
    expect(offenders(/\b(?:text|bg|border)-\[#/)).toEqual([]);
  });

  it("AC-VISUAL-05 · 허용된 글자 크기 다섯 개만 쓴다", () => {
    // RatingInput의 text-[22px]는 별 아이콘 크기라 글자 위계와 무관하다.
    const sizes = /\btext-(?!xs\b|sm\b|base\b|lg\b|xl\b|\[22px\]|muted\b|brand\b|danger\b|foreground\b|on-accent\b|center\b|left\b|right\b)[a-z0-9[\]-]+/;
    expect(offenders(sizes)).toEqual([]);
  });
});
```

> **AC-05의 정규식이 이 계획에서 가장 깨지기 쉬운 부분이다.** `text-`는 크기뿐 아니라 색
> (`text-muted`)과 정렬(`text-center`)에도 쓰인다. 위 부정형 목록이 실제 소스를 다 덮는지는
> **돌려봐야 안다.** Step 2에서 나오는 offender 목록을 읽고, 크기가 아닌 것이 걸렸으면 목록에
> 더한다. **걸린 것을 목록에 더하는 것과 진짜 위반을 고치는 것을 혼동하지 않는다.**

- [x] **Step 2: 실행 — 실패 확인**

Run: `cd frontend && pnpm test src/test/designTokens.test.ts`
Expected: FAIL — 다섯 개가 모두 빨갛다. offender 목록에 이관하지 않은 파일들이 나온다.
**그 목록을 그대로 이관 체크리스트로 쓴다.**

- [x] **Step 3: 대응표대로 일괄 이관한다**

Step 2가 뱉은 파일을 하나씩 연다. 「색 이관 대응표」 그대로 바꾸고 `dark:` 짝은 지운다.

`RatingInput.tsx:30`:

```tsx
          className="px-1 text-[22px] leading-none"
```

`BottomNav.tsx`:

```tsx
      className="mt-auto sticky bottom-0 z-10 grid grid-cols-4 border-t border-line bg-background"
```

```tsx
            className={`py-3 text-center text-sm ${active ? "font-semibold text-brand" : "text-muted"}`}
```

`LoadingState.tsx`:

```tsx
        className="size-6 animate-spin rounded-full border-2 border-line border-t-foreground"
```

`ErrorState.tsx`:

```tsx
        className="rounded-md border border-line px-3 py-1.5 text-sm"
```

`GrindSettingField.tsx:152` — 조치할 수 없는 안내다:

```tsx
    return <p className="text-sm text-muted">{message}</p>;
```

`RecipeStepEditor.tsx:206·211` — 사용자가 고쳐야 한다:

```tsx
        <span className="text-danger">
```

주 액션 버튼(9곳):

```tsx
          className="self-start rounded-md bg-brand px-4 py-2 text-sm text-on-accent disabled:opacity-50"
```

삭제 버튼(2곳):

```tsx
            className="rounded-md bg-danger px-3 py-1.5 text-sm text-on-accent"
```

- [x] **Step 4: 실행 — 통과 확인**

Run: `cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: PASS. **350개**(345 + 5). 빌드도 통과해야 한다 — 존재하지 않는 유틸리티를 쓰면
Tailwind가 클래스를 만들지 않아 조용히 색이 빠진다.

> **`pnpm build`를 여기서 반드시 돌린다.** `bg-brand`는 `@theme`에 `--color-brand`가 있어야
> 생성된다. 이름을 하나라도 틀리면 테스트는 초록인데 화면에서 색이 사라진다 — 소스 검사는
> 「금지된 것이 없다」만 보지 「의도한 것이 있다」는 보지 않는다. 그건 Task 5가 잡는다.

- [x] **Step 5: 커밋**

```bash
git add frontend/src
git commit -m "feat(web): 색을 토큰으로 일괄 이관하고 허용목록을 잠근다 (AC-VISUAL-01~05)"
```

---

## Task 5: 실제 렌더값 실측

**Files:**
- Create: `frontend/e2e/visual.spec.ts`

**Covers:** AC-VISUAL-14, 15, 16, 17, 18

**Interfaces:**
- Consumes: `installStubs` (`e2e/stubs.ts`), 픽스처 `hoffmannSummary`(`30.0g` · `500.0g` · `1:16.7`)
- Produces: 없음

- [x] **Step 1: 실패하는 테스트 작성**

`e2e/visual.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { installStubs } from "./stubs";

/** globals.css의 토큰을 rgb()로 옮긴 값. 브라우저는 hex를 rgb로 정규화해 돌려준다. */
const BRAND_LIGHT = "rgb(111, 78, 55)";
const BRAND_DARK = "rgb(201, 169, 138)";
const ON_ACCENT_DARK = "rgb(23, 23, 23)";
const MUTED_LIGHT = "rgb(115, 115, 115)";

test.describe("시각 위계 — 라이트", () => {
  test("AC-VISUAL-14 · 주 액션 버튼이 브랜드 색이다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/recipes/new");

    const save = page.getByRole("button", { name: "저장" });
    await expect(save).toBeVisible();
    expect(
      await save.evaluate((el) => getComputedStyle(el).backgroundColor),
    ).toBe(BRAND_LIGHT);
  });

  test("AC-VISUAL-15 · 화면 제목이 20px다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/recipes");

    const heading = page.getByRole("heading", { level: 1 });
    expect(
      await heading.evaluate((el) => getComputedStyle(el).fontSize),
    ).toBe("20px");
  });

  test("AC-VISUAL-16 · 카드 대표 수치가 18px다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/recipes");

    // 목록 첫 카드는 hoffmannSummary다 — 30.0g → 500.0g.
    const dose = page.getByText("30.0g").first();
    expect(await dose.evaluate((el) => getComputedStyle(el).fontSize)).toBe(
      "18px",
    );
  });

  test("AC-VISUAL-17 · 보조줄이 muted 색이다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/recipes");

    const ratio = page.getByText("1:16.7").first();
    expect(await ratio.evaluate((el) => getComputedStyle(el).color)).toBe(
      MUTED_LIGHT,
    );
  });
});

test.describe("시각 위계 — 다크", () => {
  test.use({ colorScheme: "dark" });

  test("AC-VISUAL-18 · 다크에서 버튼 쌍이 뒤집힌다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/recipes/new");

    const save = page.getByRole("button", { name: "저장" });
    await expect(save).toBeVisible();

    const style = await save.evaluate((el) => {
      const computed = getComputedStyle(el);
      return { background: computed.backgroundColor, color: computed.color };
    });

    expect(style.background).toBe(BRAND_DARK);
    expect(style.color).toBe(ON_ACCENT_DARK);
  });
});
```

- [x] **Step 2: 실행 — 실패 확인**

Run: `cd frontend && pnpm e2e visual`
Expected: FAIL이면 안 된다 — Task 4까지 끝났으면 **이미 통과해야 한다.** 이 태스크의 테스트는
「고칠 것」을 찾는 것이 아니라 **소스 검사가 못 보는 것을 확인**하는 것이다.

> **빨갛게 나오면 그것이 이 태스크의 수확이다.** 클래스 이름을 틀렸거나 토큰이 생성되지 않은
> 것이며, 소스 검사 5개는 그것을 잡을 수 없다. 실패하면 Task 4로 돌아가 고친다.

- [x] **Step 3: 실행 — 전체 확인**

Run: `cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm e2e`
Expected: PASS. 단위 **350개**, e2e **70개**(65 + 5).

- [x] **Step 4: 커버리지 확인**

Run: `cd .. && ./scripts/check-spec-coverage.sh`
Expected: PASS. 스펙의 `status`를 아직 올리지 않았으므로 이 스펙은 **건너뛴다**고 나온다.

- [x] **Step 5: 스펙 status를 올린다**

`docs/specs/2026-09-07-visual-hierarchy.md` — `status: 초안` → `status: 구현완료`,
`plan: docs/plans/2026-09-07-plan-visual-hierarchy.md`.

**수동 확인 3개는 전부 비차단형이다.** 하나도 밟지 못해도 올린다
(`docs/conventions/verification.md`). 남은 항목이 몇 개이고 무엇인지 스펙의 인용 블록에 적는다.

- [x] **Step 6: 커밋**

```bash
git add frontend/e2e docs/specs/2026-09-07-visual-hierarchy.md
git commit -m "test(web): 렌더값을 브라우저로 재고 스펙을 올린다 (AC-VISUAL-14~18)"
```

---

## 완료 기준

- [x] `cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build` 통과 — **350개**
- [x] `cd frontend && pnpm e2e` 통과 — **70개**. `pnpm test:worker`도 6개 통과했다
- [x] `cd backend && ./gradlew clean check` 통과 — **505개**
- [x] `./scripts/check-spec-coverage.sh` 통과 — **710개**, 스펙 28건
- [x] `git diff --stat main...HEAD`에 `backend/`가 **없다** — 확인함
- [x] 스펙의 `status`를 `구현완료`로 변경
- [ ] 스펙 「수동 확인」 3개 — **전부 비차단형이라 `status`를 막지 않는다.** 폰 실물과 실제 조명이 필요해 남겼다

---

## 자체 검토 결과

**AC 커버리지:** 스펙의 AC **18개** 중 **18개**가 태스크에 매핑됨

**자리표시자 검사:** `TODO`, `TBD`, "나중에", "비슷하게" 없음

**타입 일관성:** `readPalettes`·`contrastRatio`·`TOKEN_NAMES`를 Task 1이 정의하고 Task 4가 그대로
쓴다. `headline(log)`는 Task 2 안에서 닫힌다.

**검증되지 않은 가정:**

- ~~`<h1`이 11곳이라는 것.~~ **확인했고 거짓이었다. 실제로는 14곳이다.** 스펙의 「11곳」을
  14로 고쳤다. 10곳은 이미 `text-xl font-semibold`이고 넷이 어긋난다 — `/login`은
  `text-2xl font-semibold`, `/login/test`·`/offline`·`UserProfile`은 `text-2xl font-bold`.
- **AC-05의 `text-` 정규식이 크기만 골라낸다는 것.** `text-muted`·`text-center` 같은 비크기
  용법을 부정형 목록으로 걸러내는데, 그 목록이 실제 소스를 다 덮는지는 돌려봐야 안다.
- **`getByText("1:16.7")`이 보조줄의 `dd`를 잡는다는 것.** `text-muted`는 감싸는 `div`에 있고
  `color`는 상속되므로 `dd`에서 읽어도 같은 값이 나와야 한다. **상속이 끊겨 있으면 부모를 본다.**
- **`installStubs`만으로 `/recipes/new`가 열린다는 것.** `layout.spec.ts`가 이미 그 경로를 열고
  있으므로 참일 것이다. 거짓이면 세션 스텁을 더한다.
- ~~`bg-black/40`이 AC-02 정규식에 걸리지 않는다는 것.~~ **확인했고 거짓이었다.** `bg-black\b`는
  `/`를 단어 경계로 보아 배경막까지 잡는다. 계획을 쓰는 중에 14개 경우로 검증한 정규식으로
  교체했다 — `bg-black/40`은 통과, `bg-black`·`border-black/10`·`text-white`는 잡힌다.
