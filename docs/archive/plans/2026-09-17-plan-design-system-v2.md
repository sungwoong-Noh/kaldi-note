# 디자인 시스템 교체 — Clean Ledger 구현 계획

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.

**Spec:** `docs/specs/2026-09-17-design-system-v2.md`

**Goal:** 이 계획을 다 실행하면 **버튼·입력·카드를 한 곳에서 고칠 수 있고**, 색·글자·간격이
전부 새 토큰에서 나온다. 화면 배치는 그대로다.

**Architecture:** 검사 도구를 먼저 oklch로 옮긴 뒤(T1) 토큰을 갈아끼운다(T2). 파서가 hex만
읽는 상태에서 토큰을 바꾸면 대비 AC가 전부 **거짓 통과**하기 때문이다. 이후 서체·타이포·모서리를
차례로 잠그고(T3~T5), 마지막에 흩어진 스타일 문자열을 프리미티브로 걷어낸다(T6~T7).
프리미티브를 먼저 만들지 않는 이유는, 토큰이 확정되기 전에 컴포넌트를 쓰면 두 번 고치기 때문이다.

**작업 위치:** `frontend/`

**반드시 먼저 읽을 것:** `CLAUDE.md`(루트) → `frontend/CLAUDE.md` → `docs/conventions/frontend.md` → `docs/conventions/git.md`

---

## AC 커버리지 매핑

| AC ID | 요약 | 담당 태스크 | 검증 방식 |
|---|---|---|---|
| AC-DS2-01 | 색 토큰 15개가 라이트·다크 모두 | Task 2 | 단위 (CSS 파싱) |
| AC-DS2-02 | 모든 색이 oklch | Task 2 | 단위 (CSS 파싱) |
| AC-DS2-03 | `danger` > `ink-3` 대비 | Task 2 | 단위 (대비 계산) |
| AC-DS2-04 | 글자 토큰 4.5:1 이상 | Task 2 | 단위 (대비 계산) |
| AC-DS2-05 | 대비 계산기 경계값 | **Task 1** | 단위 |
| AC-DS2-06 | Sans·Mono self-host | Task 3 | 단위 (CSS 파싱) |
| AC-DS2-07 | `font-display: swap` | Task 3 | 단위 (CSS 파싱) |
| AC-DS2-08 | Mono에 한글 없음 | Task 3 | 단위 (CSS 파싱) |
| AC-DS2-09 | `--font-sans` 첫 자리 | Task 3 | 단위 (CSS 파싱) |
| AC-DS2-10 | 폰트 파일 100KB 미만 | Task 3 | 단위 (파일 크기) |
| AC-DS2-11 | 웨이트 제한 | Task 3 | 단위 (CSS 파싱) |
| AC-DS2-12 | 글자 크기 10단계 | Task 4 | 단위 (소스 스캔) |
| AC-DS2-13 | 10단계 각각 쓰임 | Task 4 | 단위 (소스 스캔) |
| AC-DS2-14 | 대표 수치 Mono | Task 4 | 렌더 |
| AC-DS2-15 | 수치에 Sans 강제 없음 | Task 4 | 단위 (소스 스캔) |
| AC-DS2-16 | 모서리 4종 | Task 5 | 단위 (소스 스캔) |
| AC-DS2-17 | shadow 0곳 (포커스 링 예외) | Task 5 | 단위 (소스 스캔) |
| AC-DS2-18 | 프리미티브 6종 존재 | Task 6 | 단위 |
| AC-DS2-19 | Button 변형 4종 | Task 6 | 렌더 |
| AC-DS2-20 | 컨트롤 스타일 직접 사용 금지 | Task 6 | 단위 (소스 스캔) |
| AC-DS2-21 | 프리미티브 44px | Task 6 | 렌더 |
| AC-DS2-22 | 오류 보더 `danger` | Task 7 | 렌더 |
| AC-DS2-23 | `aria-invalid="true"` | Task 7 | 렌더 |
| AC-DS2-24 | 오류 없으면 속성 부재 | Task 7 | 렌더 |
| AC-DS2-25 | `data-*` 훅 보존 | Task 8 | 단위 (소스 스캔) |
| AC-DS2-26 | 팔레트 색·임의값 금지 | Task 2 | 단위 (소스 스캔) |

---

## Global Constraints

- **기존 AC ID를 지우지 않는다.** `check-spec-coverage.sh`가 `구현완료` 스펙의 AC를 테스트에서
  찾는다. 값이 바뀌는 AC는 **테스트 본문만 고치고 `it()`의 ID 문자열은 남긴다.**
- **각 태스크가 끝날 때 `pnpm test`가 초록이어야 한다.** 중간에 빨간 상태로 다음 태스크로 넘어가지 않는다.
- **값을 계획서나 테스트에 베껴 적지 않는다.** 색은 `globals.css`를 파싱해 읽는다
  (`src/test/tokens.ts`가 이미 그 방식이다).
- 기존 `data-*` 훅(`data-lead`·`data-compare`·`data-diff`·`data-empty`)을 건드리지 않는다.

---

## File Structure

```
frontend/
├── src/app/globals.css                    ← 토큰·@font-face·타입 스케일
├── src/components/ui/                     ← 신규
│   ├── Button.tsx  Input.tsx  Select.tsx
│   ├── Card.tsx    Badge.tsx  MetricRow.tsx
│   └── index.ts
├── src/test/
│   ├── oklch.ts                           ← 신규: oklch → 상대휘도
│   ├── contrast.ts                        ← 수정: hex → oklch
│   ├── tokens.ts                          ← 수정: 파서·TOKEN_NAMES
│   ├── fonts.test.ts                      ← 신규
│   ├── typography.test.ts                 ← 신규
│   ├── primitives.test.tsx                ← 신규
│   ├── contrast.test.ts                   ← 수정 (AC-READ-01~06 값 갱신)
│   ├── designTokens.test.ts               ← 수정 (AC-VISUAL-05~07 값 갱신)
│   └── spacing.test.ts                    ← 수정 (AC-SPACE-01~08 값 갱신)
└── public/fonts/                          ← 신규: woff2 (fontsource에서 복사)
```

---

## Task 1: oklch 대비 계산기

**Files:**
- Create: `src/test/oklch.ts`, `src/test/oklch.test.ts`
- Modify: `src/test/contrast.ts`

**Covers:** AC-DS2-05

**Interfaces:**
- Produces: `parseOklch(value: string): {L:number, C:number, h:number}`,
  `oklchLuminance(L, C, h): number`, `contrast(l1: number, l2: number): number`

> **이 태스크가 1번인 이유.** `contrast.ts`는 hex만 읽는다. 토큰을 oklch로 바꾼 뒤에
> 파서를 고치면, 그 사이의 모든 대비 AC가 **아무것도 검사하지 않은 채 통과**한다.

- [x] **Step 1: 실패하는 테스트 작성**

```ts
// src/test/oklch.test.ts
import { describe, expect, it } from "vitest";
import { contrast, oklchLuminance, parseOklch } from "./oklch";

describe("oklch 대비 계산기", () => {
  it("AC-DS2-05 · 4.50을 통과로, 4.49를 미달로 준다", () => {
    // 경계 자체를 검사한다. 계산기가 틀리면 나머지 대비 AC가 전부 거짓 통과한다.
    expect(4.5 >= 4.5).toBe(true);
    expect(4.49 >= 4.5).toBe(false);
  });

  it("AC-DS2-05 · 알려진 oklch 쌍의 대비가 기존 hex 계산과 일치한다", () => {
    // oklch(0.50 0.18 28)은 #b3241f에 해당하고, 흰 배경 대비 6.40:1이다.
    // 기존 danger(#b91c1c)가 6.47:1이었던 것과 같은 자리다.
    const danger = oklchLuminance(...Object.values(parseOklch("oklch(0.50 0.18 28)")) as [number, number, number]);
    const paper = oklchLuminance(0.99, 0.004, 85);
    expect(contrast(danger, paper)).toBeCloseTo(6.40, 1);
  });

  it("AC-DS2-05 · oklch 문자열을 L·C·h로 파싱한다", () => {
    expect(parseOklch("oklch(0.72 0.15 28)")).toEqual({ L: 0.72, C: 0.15, h: 28 });
  });
});
```

- [x] **Step 2: 테스트 실행 — 실패 확인** (`pnpm test oklch`)
- [x] **Step 3: `src/test/oklch.ts` 구현**

  oklch → oklab → linear sRGB → 상대휘도. 변환 계수는 표준 공식을 쓴다.
  **검증 방법:** 기존 hex 값 `#545454`(7.57:1)·`#b91c1c`(6.47:1)로 계산기를 맞춰본다 —
  이 둘은 `docs/specs/2026-09-15-readability.md`가 못박은 값이라 정답이 있다.

- [x] **Step 4: 통과 확인**
- [x] **Step 5: 대비 계산을 두 색 표현이 공유하도록 분리.** hex 경로는 남겨뒀다 —
      T2에서 기존 테스트가 아직 hex를 읽는 동안 필요하다.

  > **계획과 달라진 점(2026-09-17).** 계획은 「`contrast.ts`가 `oklch.ts`를 쓰도록」이라고
  > 적었으나 의존 방향을 반대로 했다. `oklch.ts`가 **휘도**만 만들고 `contrast.ts`의
  > 새 `ratioOf(lumA, lumB)`가 **비율**을 만든다. 대비 공식은 색 표현과 무관하므로
  > 이쪽이 순환 의존 없이 두 경로가 같은 공식을 쓰게 한다.
  > 덕분에 `oklch.test.ts`가 **oklch 경로와 hex 경로를 교차검증**할 수 있다 —
  > 서로를 부르지 않으므로 둘이 같은 답을 내면 변환 계수가 맞다는 뜻이 된다.
- [x] **Step 6: `pnpm test` 전체 초록 확인 후 커밋**

---

## Task 2: 색 토큰 15개

**Files:**
- Modify: `src/app/globals.css`, `src/test/tokens.ts`, `src/test/contrast.test.ts`, `src/test/designTokens.test.ts`
- Modify: `src/**/*.tsx` (클래스 이름 일괄 치환)

**Covers:** AC-DS2-01, 02, 03, 04, 26

**Interfaces:**
- Consumes: T1의 `oklchLuminance`, `contrast`
- Produces: 토큰 15개. 이후 모든 태스크가 이 이름을 쓴다

**토큰 이름 매핑 (일괄 치환 대상)**

| 기존 | 새 이름 | 치환 |
|---|---|---|
| `background` | `paper` | `bg-background` → `bg-paper` |
| `foreground` | `ink` | `text-foreground` → `text-ink` |
| `muted` | `ink-3` | `text-muted` → `text-ink-3` |
| `line` | `border` | `border-line` → `border-border` |
| `brand` | `accent` | `bg-brand`·`text-brand` → `bg-accent`·`text-accent` |
| `on-accent` | `on-ink` | `text-on-accent` → `text-on-ink` |
| `surface` | `surface` | 그대로 |
| `danger` | `danger` | 그대로 (값만 바뀜) |

신규 6개: `sunken` · `raised` · `divider` · `divider-strong` · `ink-2` · `accent-soft` · `accent-wash`

> **신규 토큰은 이 태스크에서 정의만 하고 쓰지 않아도 된다.** 쓰는 곳은 T6(프리미티브)과
> 다음 스펙(`screen-reskin`)이다. 단 `AC-DS2-01`이 15개 존재를 검사하므로 **정의는 지금 한다.**

- [x] **Step 1: 실패하는 테스트 작성**

```ts
// src/test/designTokens.test.ts — 기존 it()의 AC ID는 그대로 두고 본문만 바꾼다
it("AC-VISUAL-06 · AC-READ-04 · AC-DS2-01 · 토큰 15개가 라이트·다크 값을 모두 갖는다", () => {
  const { light, dark } = readPalettes();
  const expected = [...TOKEN_NAMES].sort();
  expect(Object.keys(light).sort()).toEqual(expected);
  expect(Object.keys(dark).sort()).toEqual(expected);
});

it("AC-DS2-02 · 모든 색 토큰이 oklch로 정의된다", () => {
  const { light, dark } = readPalettes();
  const values = [...Object.values(light), ...Object.values(dark)];
  expect(values.filter((v) => !v.startsWith("oklch("))).toEqual([]);
});

it("AC-DS2-03 · danger가 ink-3보다 대비가 높다", () => {
  for (const mode of ["light", "dark"] as const) {
    const p = readPalettes()[mode];
    const bg = lum(p["paper"]);
    expect(contrast(lum(p["danger"]), bg)).toBeGreaterThan(contrast(lum(p["ink-3"]), bg));
  }
});
```

- [x] **Step 2: 실패 확인** — 현재 토큰이 8개이고 hex라 세 개 다 실패해야 한다
- [x] **Step 3: `tokens.ts` 갱신** — `TOKEN_NAMES`를 15개로, 파서를 `oklch(...)`도 읽게
- [x] **Step 4: `globals.css` 교체**

  값은 **`docs/design/design_handoff_kaldi_note/README.md`의 Design Tokens 표**에서 가져온다.
  `danger`는 스펙이 정한 `oklch(0.50 0.18 28)` / `oklch(0.72 0.15 28)`.
  `raised`는 라이트에서 `paper`와 같은 값으로 둔다(스펙 「데이터」 절).
  `@theme inline`의 `--color-*` 매핑도 15개로 맞춘다.

- [x] **Step 5: 클래스 이름 일괄 치환** — 위 표대로. `sed`로 하되 **치환 후 `pnpm build`로 확인**한다
- [x] **Step 6: 기존 대비 테스트 갱신** — `AC-READ-01`·`02`·`03`·`05`·`06`의 **ID는 남기고** 기대값을 새 토큰 기준으로
- [x] **Step 7: `pnpm test` 전체 초록 + 로컬에서 화면 눈으로 확인 후 커밋**

> **이 태스크는 화면 색이 실제로 바뀌는 유일한 지점이다.** 라이트·다크 양쪽을 폰 크기로 열어본다.

**계획에 없던 것들이 딸려 나왔다(2026-09-17).** 토큰 이름과 형식이 동시에 바뀌면서 색을
리터럴로 들고 있던 곳이 전부 걸렸다.

| 걸린 곳 | 무엇이 문제였나 | 어떻게 했나 |
|---|---|---|
| `e2e/visual.spec.ts` 외 2개 | `rgb(84, 84, 84)` 같은 리터럴. 브라우저가 oklch를 **`lab(32.34 15.48 17.65)`** 로 돌려준다 | `e2e/tokenColor.ts`를 만들어 **같은 페이지에서 기준값을 계산**한다. 이제 「이 요소가 그 토큰을 쓰는가」를 검사한다 |
| `designTokens.test.ts` | `AC-VISUAL-05`의 정규식에 옛 색 이름이 박혀 있어 `text-ink-3`를 **크기로 오인** | 제외 목록을 `TOKEN_NAMES`에서 생성 |
| `manifest.json/route.ts` | `theme_color`가 옛 `--brand` hex | 새 `--accent`·`--paper`의 sRGB 값으로. JSON이라 변수를 못 써 주석으로 연결 |
| `scripts/make-icons.mjs` | `--brand`의 **hex**를 정규식으로 찾아 없으면 throw | `--accent`의 oklch를 읽는다. Chromium이 렌더하므로 oklch를 그대로 `fill`에 넣는다 |

**`AC-READ-02`의 하한이 1.98에서 1.35로 내려갔다.** 핸드오프의 `border`가 라이트 1.3956 ·
다크 1.3531인데, readability 스펙이 「보이지 않는다」고 진단한 값이 1.48이었다.
**그때 문제로 지목한 것보다 흐리다** — 수동 확인 항목으로 올렸다.

---

## Task 3: 웹폰트

**Files:**
- Create: `src/test/fonts.test.ts`, `public/fonts/*.woff2`
- Modify: `src/app/globals.css`, `package.json`

**Covers:** AC-DS2-06, 07, 08, 09, 10, 11

**조달 방법**

`@fontsource/ibm-plex-sans-kr@5.3.0` · `@fontsource/ibm-plex-mono@5.3.0`을 devDependency로 받아
**필요한 파일만 `public/fonts/`로 복사하고 `@font-face`는 `globals.css`에 직접 쓴다.**
패키지 CSS를 `@import`하지 않는 이유는 두 가지다 — `AC-DS2-07`·`08`·`11`이 `globals.css`의
선언을 검사하고, `korean` 통짜 서브셋(505KB)이 실수로 딸려오는 것을 막아야 한다.

| 폰트 | 웨이트 | 서브셋 |
|---|---|---|
| IBM Plex Sans KR | 400 · 500 · 600 | `latin` + 한글 **조각** (`korean` 통짜 금지) |
| IBM Plex Mono | 400 · 500 | `latin`만 |

- [x] **Step 1: 실패하는 테스트 작성**

```ts
// src/test/fonts.test.ts
const CSS = readFileSync(join("src", "app", "globals.css"), "utf8");
const FACES = [...CSS.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => m[1]);

it("AC-DS2-07 · 모든 @font-face에 font-display: swap이 있다", () => {
  expect(FACES.filter((f) => !/font-display:\s*swap/.test(f))).toEqual([]);
});

it("AC-DS2-08 · Mono에 한글 unicode-range가 없다", () => {
  const mono = FACES.filter((f) => /IBM Plex Mono/.test(f));
  expect(mono.length).toBeGreaterThan(0);
  expect(mono.filter((f) => /U\+AC00/i.test(f))).toEqual([]);
});

it("AC-DS2-10 · 단일 폰트 파일이 100KB를 넘지 않는다", () => {
  const files = readdirSync(join("public", "fonts")).filter((f) => f.endsWith(".woff2"));
  expect(files.length).toBeGreaterThan(0);
  const tooBig = files.filter((f) => statSync(join("public", "fonts", f)).size >= 102_400);
  expect(tooBig).toEqual([]); // korean 통짜(505KB)를 막는다
});

it("AC-DS2-11 · 웨이트가 정해진 것 밖에 없다", () => {
  const weights = (family: RegExp) =>
    new Set(FACES.filter((f) => family.test(f))
      .map((f) => f.match(/font-weight:\s*(\d+)/)?.[1]).filter(Boolean));
  expect([...weights(/Sans KR/)].sort()).toEqual(["400", "500", "600"]);
  expect([...weights(/Plex Mono/)].sort()).toEqual(["400", "500"]);
});
```

- [x] **Step 2: 실패 확인**
- [x] **Step 3: 폰트 파일 복사 + `@font-face` 작성.** 한글 조각의 `unicode-range`는
      fontsource CSS에서 그대로 옮긴다 — **손으로 짐작해 쓰지 않는다**
- [x] **Step 4: `--font-sans`·`--font-mono` 갱신** (`AC-DS2-09`)
- [x] **Step 5: 통과 확인**
- [x] **Step 6: 실측 — 전송량을 쟀다.** 첫 페인트는 수동 확인 항목으로 남긴다

  **`/recipes`에서 받은 woff2는 12개 · 166KB다**(2026-09-17 실측). 저장소에는 192개 2.6MB가
  있지만 브라우저는 페이지에 실제로 쓰인 글자가 있는 조각만 받는다 — 조각 방식을 택한 이유가
  여기서 확인됐다. 통짜였다면 505KB짜리 하나를 받았을 것이다. 본다
- [x] **Step 7: 커밋**

> **`AC-POLISH-03`(`--font-geist-sans` 참조 없음)은 그대로 통과해야 한다.** 이 태스크가 그것을 깨지 않는지 확인한다.

**계획과 달라진 점(2026-09-17).**

- **Sans 500을 뺐다.** 확정한 타입 스케일 10단계에 Sans 500을 쓰는 단계가 없다 —
  핸드오프의 `subtitle 17/500`이 `card-title`(18/600)로 흡수됐기 때문이다.
  웨이트 하나가 **1,356KB**라 실측 후 스펙(`AC-DS2-11`)을 고쳤다.
- **`@font-face`를 `globals.css`가 아니라 `src/app/fonts.css`에 둔다.** face가 192개다.
  테스트는 두 파일을 합쳐 읽는다 — 검사 대상은 파일이 아니라 **앱이 선언하는 face 전부**다.
- **`scripts/sync-fonts.mjs`를 만들었다.** 192개를 손으로 옮기지 않는다. 통짜 서브셋 제외와
  woff fallback 제거가 이 스크립트에 있다. `pnpm sync-fonts`로 재생성한다.
- **`e2e/polish.spec.ts`의 `FONT_STACK`이 옛 목록을 리터럴로 들고 있었다.** `globals.css`에서
  읽도록 고쳤다 — 검사하려던 것은 「어떤 폰트인가」가 아니라 「정한 스택이 실제로 적용되는가」다.

---

## Task 4: 타입 스케일 10단계

**Files:**
- Create: `src/test/typography.test.ts`
- Modify: `src/app/globals.css`, `src/test/designTokens.test.ts`, `src/**/*.tsx`

**Covers:** AC-DS2-12, 13, 14, 15

**스케일 정의** — 스펙 「타입 스케일 10단계」 표 그대로.
Tailwind 4 `@theme`에 `--text-display: 36px` 형태로 선언하고 `text-display` 클래스로 쓴다.
**선언 방식이 실제로 클래스를 만드는지 Step 3에서 먼저 확인한다** (스펙의 「열어둔 결정」).

**치환 매핑**

| 기존 | 새 |
|---|---|
| `text-4xl` (36px) | `text-metric-hero` (수치) 또는 `text-display` (서술) |
| `text-2xl` (24px) | `text-title` |
| `text-lg` (18px) | `text-card-title` |
| `text-base` (16px) | `text-body` (15px) |
| `text-sm` (14px) | `text-body-sm` (13px) 또는 `text-metric` (수치) |

> **16px → 15px, 14px → 13px로 내려간다.** `2026-09-15-readability.md`가 한 칸 올린 것을
> 일부 되돌리는 셈이다. 근거는 그때가 `system-ui` 기준이었고 지금은 **x-height가 다른 폰트**라는 것 —
> Step 6에서 폰으로 읽어보고, 작으면 `body`를 15→16으로 올리는 것을 스펙에 반영한다.

- [x] **Step 1: 실패하는 테스트 작성**

```ts
const SCALE = ["display","page-title","title","card-title","body","body-sm","caption",
               "metric-hero","metric","label"] as const;

it("AC-DS2-12 · 글자 크기가 10단계 밖을 쓰지 않는다", () => {
  const allowed = new Set(SCALE);
  const bad = sources().flatMap(([path, cls]) =>
    cls.filter((c) => c.startsWith("text-") && !allowed.has(c.slice(5) as never)
                   && !/^text-(left|right|center|ink|paper|accent|danger|on-ink|surface)/.test(c))
       .map((c) => `${path}: ${c}`));
  expect(bad).toEqual([]);
});

it("AC-DS2-13 · 10단계가 각각 쓰인다", () => {
  const used = new Set(sources().flatMap(([, cls]) => cls));
  expect(SCALE.filter((s) => !used.has(`text-${s}`))).toEqual([]);
});
```

- [x] **Step 2: 실패 확인**
- [x] **Step 3: `@theme` 선언 후 `text-metric` 같은 클래스가 실제 생성되는지 확인.**
      생성되지 않으면 `@utility`나 플러그인으로 바꾼다 — **여기서 막히면 진행 전에 보고한다**
- [x] **Step 4: 일괄 치환.** 수치인지 서술인지 구분이 필요하므로 **`data-lead`·`dd` 요소를 먼저 훑는다**
- [x] **Step 5: `AC-VISUAL-05`의 테스트 본문 갱신** (ID 유지)
- [x] **Step 6: 폰으로 읽어보고 크기 판단 → 필요하면 스펙 갱신 후 재치환**
- [x] **Step 7: 커밋**

---


**계획과 달라진 점(2026-09-17).**

- **10단계가 아니라 6단계로 들어갔다.** `display`(36 서술)·`title`(24)·`caption`(12)·
  `label`(10 Mono)은 **이 앱의 현재 화면에 자리가 없다** — 넣으면 `AC-DS2-13`에 죽은 단계로
  걸린다. 스펙의 원칙("웹 전용 크기는 각자의 스펙이 추가한다")을 그대로 적용했다.
- **수치 2단계는 `@theme`이 아니라 `@utility`로 정의했다.** `font-family`를 함께 묶기 위해서다.
  `text-metric`과 `font-mono`를 따로 붙이게 두면 한쪽을 빠뜨린 화면이 생긴다.
- **Tailwind 4 확인 결과(계획의 리스크 항목):** `--text-<이름>`과 `--text-<이름>--line-height`·
  `--letter-spacing`이 그대로 클래스를 만든다. `@utility`도 동작하며 `font-family`를 포함할 수 있다.
  **막히지 않았다.**
- **크기 검사가 두 파일에 흩어져 있었다.** `designTokens.test.ts`의 `AC-VISUAL-05`·
  `AC-READ-07~10`·`AC-READ-21`을 `typography.test.ts`로 모았다. 같은 것을 다르게 검사하고 있었다.
- **e2e 6곳의 기대 px를 갱신했다** — 제목 24→27 · 본문 16→15 · 라벨 14→13.
  `AC-TOUCH-10`은 탭 높이가 48→**49.5**로 **커졌다**(행간 1.6 때문). 44px 하한은 그대로다.
- **`AC-DS2-14`(대표 수치 Mono)는 e2e로 갔다.** jsdom은 Tailwind CSS를 로드하지 않아
  계산된 `font-family`를 잴 수 없다.

## Task 5: 모서리와 그림자

**Files:**
- Modify: `src/test/spacing.test.ts`, `src/**/*.tsx`, `src/app/globals.css`

**Covers:** AC-DS2-16, 17

**모서리 4종** — 태그 3px · 컨트롤 7–8px · 면 10–14px · 원형.
기존 2역할(`rounded-md` 6px / `rounded-lg` 8px)에서 늘어난다.
`AC-SPACE-04`·`05`·`06`의 테스트 본문을 새 4종으로 갱신한다(ID 유지).

**간격 7단계** — `AC-SPACE-01`·`02`의 `SCALE`에 `8`(32px)을 추가한다.

- [x] ~~**Step 1: `SCALE`에 `8` 추가**~~ — **하지 않았다.** 아래 참조
- [x] ~~**Step 2: 32px 적용**~~ — **하지 않았다.** 아래 참조
- [x] **Step 3: 모서리 4종 테스트 작성 → 실패 확인**
- [x] **Step 4: 치환** — 카드·히어로를 면(10–14px)으로, 배지를 태그(3px)로
- [x] **Step 5: `AC-SPACE-08` 갱신** — `shadow` 0곳에서 **포커스 링 1곳 예외**로
- [x] **Step 6: 커밋**

---


**계획과 달라진 점(2026-09-17).**

- **간격은 6단계를 유지했다.** 계획은 `8`(32px)을 더하라고 했지만 **32px을 쓸 자리가 없다.**
  넣으면 `AC-SPACE-02`(「죽은 단계가 없다」)에 걸린다 — T4에서 타입 스케일에 적용한 판단과 같다.
  리스킨이 섹션 간 여백으로 실제로 쓸 때 더한다.
- **거터를 16px에서 24px로 올렸다**(`px-4` → `px-6`, 11곳). 핸드오프가 정한 값이다.
  계획에는 이 항목이 없었는데, 스펙의 「거터 모바일 24」를 T5가 가진 유일한 자리였다.
- **모서리를 값이 아니라 이름으로 쓴다.** `rounded-md`/`rounded-lg` 대신
  `rounded-tag`(3px) · `rounded-control`(7px) · `rounded-surface`(12px). 타입 스케일과 같은 방식이고,
  **어느 역할인지가 클래스에 남는다** — 원래 문제가 「어느 것을 언제 쓰는지 규칙이 없다」였다.

**거터를 바꾸자 가려져 있던 버그 둘이 드러났다.**

| 버그 | 무엇이었나 |
|---|---|
| `fieldset` 5곳이 부모를 8px 넘침 | 브라우저 기본 `min-width: min-content` 때문이다. 거터가 16px일 때는 필드 오른쪽 끝이 우연히 페이지와 같은 344px이라 `AC-STRUCT-01`이 통과했다. `min-w-0`를 줬다 |
| 별점 버튼이 44px 미만으로 압축 | `size-11`인데 flex 안에서 줄어 **42.4×44**가 됐다. **터치 타깃은 축소되면 안 된다** — `shrink-0`을 줬다 |

> 둘 다 이 태스크가 만든 문제가 아니라 **원래 있던 것이 드러난 것**이다.
> 8px을 움직였더니 나왔다.## Task 6: UI 프리미티브 6종

**Files:**
- Create: `src/components/ui/{Button,Input,Select,Card,Badge,MetricRow}.tsx`, `index.ts`, `src/test/primitives.test.tsx`
- Modify: 컨트롤을 쓰는 모든 `.tsx`

**Covers:** AC-DS2-18, 19, 20, 21

**이 계획의 핵심 태스크다.** 지금 이 문자열이 복붙돼 있다:

```
8곳  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-line px-3 py-2 text-base"
7곳  "min-w-0 appearance-none select-chevron pr-12 w-full rounded-md border border-line px-2 py-1 min-h-11"
```

**인터페이스**

```ts
type ButtonVariant = "primary" | "secondary" | "ghost";
export function Button(props: { variant?: ButtonVariant } & ButtonHTMLAttributes<HTMLButtonElement>): JSX.Element;
export function Input(props: { label: string; error?: string; unit?: string } & InputHTMLAttributes<HTMLInputElement>): JSX.Element;
export function Select(props: { label: string; error?: string } & SelectHTMLAttributes<HTMLSelectElement>): JSX.Element;
export function Card(props: { children: ReactNode; className?: string }): JSX.Element;
export function Badge(props: { children: ReactNode; tone?: "default" | "accent" }): JSX.Element;
export function MetricRow(props: { label: string; value: ReactNode }): JSX.Element;
```

- [x] **Step 1: 실패하는 테스트 작성**

```tsx
it("AC-DS2-20 · 프리미티브 밖에서 컨트롤 스타일을 직접 쓰지 않는다", () => {
  const outside = walk("src").filter((p) => /\.tsx$/.test(p) && !p.includes("components/ui"));
  const bad = outside.filter((p) => {
    const src = readFileSync(p, "utf8");
    // <button|input|select ...> 안에 rounded + border- + px- 가 함께 있는 className
    return /<(?:button|input|select)[^>]*className="[^"]*(?=[^"]*rounded)(?=[^"]*border-)(?=[^"]*px-)/.test(src);
  });
  expect(bad).toEqual([]);
});

it("AC-DS2-21 · 프리미티브가 터치 타깃 44px을 보장한다", () => {
  for (const el of [<Button>확인</Button>, <Input label="원두량" />, <Select label="드리퍼" />]) {
    const { container } = render(el);
    expect(container.querySelector("[class*='min-h-11']")).not.toBeNull();
  }
});
```

- [x] **Step 2: 실패 확인**
- [x] **Step 3: 프리미티브 6종 구현.** 44px 보장(`min-h-11`)을 컴포넌트가 떠안는다
- [x] **Step 4: 통과 확인**
- [x] **Step 5: 호출부 이관.** **한 번에 하나의 컴포넌트씩** 옮기고 매번 `pnpm test`를 돌린다 —
      15곳 이상이 바뀌므로 한꺼번에 하면 어디서 깨졌는지 모른다
- [x] **Step 6: `AC-TOUCH-*`가 그대로 통과하는지 확인**(`touchTarget.test.ts`)
- [x] **Step 7: 커밋**

---


**계획과 달라진 점(2026-09-17).**

- **복붙은 15곳이 아니라 63곳이었다.** 계획의 첫 검사가 `<button[^>]*className`으로 요소를
  찾았는데, JSX의 `onClick={() => …}`에 들어 있는 `>` 때문에 정규식이 거기서 끊겨 **7곳만
  잡혔다.** 검사를 **클래스 조합**(`min-h-11` + `rounded-control`)으로 바꾸자 63곳이 나왔다 —
  버튼처럼 생긴 `<Link>` 8곳도 그때 드러났다.
- **`ButtonLink`를 더해 7종이 됐다.** 「레시피 보러 가기」·「새 레시피」는 **이동**이다.
  `<Button>`으로 만들면 새 탭 열기와 링크 복사가 막히고 스크린리더가 버튼으로 읽는다.
- **버튼 34곳은 스크립트로, 입력 29곳은 `controlClass()`로.** 입력은 각 화면이 저마다
  `TextField`·`NumberField` 같은 **로컬 헬퍼**를 갖고 있어 한 번에 컴포넌트로 옮길 수 없었다.
  헬퍼가 `controlClass()`를 부르게 해서 **스타일만 먼저 한 곳으로 모았다.**
  리스킨에서 헬퍼를 걷어낼 때 그 함수는 사라진다.
- **`AC-STRUCT-02`의 검사를 옮겼다.** `appearance-none`을 `className` 리터럴에서 찾고 있었는데
  스타일이 `SELECT_EXTRA`로 모이면서 문자열이 소스에서 사라졌다 — **조건이 깨진 것이 아니라
  값이 한 곳으로 모인 것**이라 검사를 그쪽으로 맞췄다.

> **이 태스크가 계획의 핵심이었다.** 이제 버튼 모양을 바꾸려면 `Button.tsx` 한 곳,
> 입력칸은 `Field.tsx` 한 곳을 고친다. `AC-DS2-20`이 되돌아가는 것을 막는다.

## Task 7: 폼 검증 에러

**Files:**
- Modify: `src/components/ui/{Input,Select}.tsx`, `src/features/**/`(FieldError 호출부), `src/test/primitives.test.tsx`

**Covers:** AC-DS2-22, 23, 24

**현재 상태:** `FieldError`가 입력칸 **아래에 문구만** 띄운다. `aria-invalid`도, 보더 변화도 없다.
그래서 무엇이 틀렸는지 눈으로 찾아야 한다.

- [x] **Step 1: 실패하는 테스트 작성**

```tsx
it("AC-DS2-22 · 오류 상태 입력의 보더가 danger다", () => {
  const { getByLabelText } = render(<Input label="원두량" error="숫자를 입력하세요" />);
  expect(getByLabelText("원두량").className).toMatch(/border-danger/);
});

it("AC-DS2-23 · 오류 상태 입력에 aria-invalid가 붙는다", () => {
  const { getByLabelText, getByText } = render(<Input label="원두량" error="숫자를 입력하세요" />);
  const input = getByLabelText("원두량");
  expect(input.getAttribute("aria-invalid")).toBe("true");
  expect(input.getAttribute("aria-describedby")).toBe(getByText("숫자를 입력하세요").id);
});

it("AC-DS2-24 · 오류가 없으면 aria-invalid가 붙지 않는다", () => {
  const { getByLabelText } = render(<Input label="원두량" />);
  expect(getByLabelText("원두량").hasAttribute("aria-invalid")).toBe(false);
});
```

- [x] **Step 2: 실패 확인**
- [x] **Step 3: `Input`·`Select`에 `error` prop 처리 구현.** `id` 생성은 `useId()`로
- [x] **Step 4: 기존 `FieldError` 호출부를 `error` prop으로 이관**
- [x] **Step 5: 실제 폼에서 확인** — 레시피 작성 화면에서 빈 값으로 저장을 눌러본다
- [x] **Step 6: 커밋**

---


**계획과 달라진 점(2026-09-17).**

- **프리미티브만 고쳐서는 사용자가 못 느낀다.** 화면들이 아직 로컬 헬퍼를 쓰므로,
  `controlClass(extra, invalid)`에 오류 인자를 더해 **헬퍼도 같은 테두리를 갖게 했다.**
  `aria-invalid`는 헬퍼마다 붙였다(7곳).
- **`AC-DS2-20`에 구멍이 있었다.** `className="…"`(JSX)만 보고 **`className: "…"`(props 객체)**를
  놓쳐서, `RecipeForm`의 `shared` 객체에 컨트롤 스타일이 리터럴로 남아 있었다.
  검사를 `className[:=]`로 넓혀 잡았다.

> **`aria-invalid`를 함께 넣은 이유:** 보더 색만 바꾸면 스크린리더 사용자와 색각 이상
> 사용자에게는 **아무 변화가 없다.** 그리고 값은 `"false"`가 아니라 **부재**여야 한다 —
> 보조기술이 「검증된 적 없음」과 「통과」를 구분한다.

## Task 8: 마감

**Files:**
- Modify: `src/test/designTokens.test.ts`, 기존 시각 스펙 4개

**Covers:** AC-DS2-25

- [x] **Step 1: `data-*` 훅 보존 테스트 작성**

```ts
it("AC-DS2-25 · 기존 data-* 훅이 남아 있다", () => {
  const all = SOURCES.map((p) => readFileSync(p, "utf8")).join("");
  for (const hook of ["data-lead", "data-compare", "data-diff", "data-empty"]) {
    expect(all.includes(hook)).toBe(true);
  }
});
```

- [x] **Step 2: 기존 시각 스펙 4개의 값을 갱신한다** — 스펙의 「기존 AC 갱신」 표대로.
      `2026-09-07-visual-hierarchy.md` · `2026-09-09-spacing-system.md` ·
      `2026-09-15-readability.md` · `2026-09-05-polish.md`.
      **각 스펙에 「2026-09-17 갱신」 노트를 달고 옛 값을 남겨둔다** — 왜 바뀌었는지가 사라지면 안 된다
- [x] **Step 3: `./scripts/check-spec-coverage.sh` 통과 확인**
- [x] **Step 4: 스펙 `status`를 `구현완료`로**
- [x] **Step 5: `pnpm test` · `pnpm build` · e2e 전체 초록 확인**
- [x] **Step 6: 커밋** — PR은 `/handover`에서

---


**계획과 달라진 점(2026-09-17).**

- **`AC-DS2-26`은 새 테스트를 만들지 않고 기존 것에 ID를 얹었다.** 팔레트 색·임의값 금지는
  `AC-VISUAL-01`·`02`·`04`가 이미 정확히 그것을 검사하고 있었다 — 같은 검사를 두 번 쓰지 않는다.
- **기존 스펙 4개는 본문을 다시 쓰지 않고 상단에 「2026-09-17 갱신」 블록을 달았다.**
  옛 값과 새 값을 나란히 남겨야 **왜 바뀌었는지**가 보존된다.
  특히 `readability`에는 `AC-READ-02`의 하한이 **내려간** 경위를 굵게 적었다.

## 검증

**자동:** `pnpm test` (단위·렌더) · `pnpm build` · `pnpm e2e` · `./scripts/check-spec-coverage.sh`

**수동 (차단형)**

- [ ] 폰에서 라이트·다크 양쪽으로 전 화면을 연다. **색이 뒤집힌 곳이 없는지**
- [ ] 느린 회선(개발자도구 Slow 3G)에서 첫 페인트에 **글자가 보이는지**(`swap` 동작)
      — 실전송량은 **166KB**로 실측했다(2026-09-17)
- [ ] 레시피 작성 화면에서 빈 값 저장 → **무엇이 틀렸는지 한눈에 보이는지**
- [x] **★ 카드 경계가 보이는지.** `border`가 1.40:1이다 — readability 스펙이 「사실상 보이지
      않는다」고 진단한 1.48:1보다 흐리다.
      **2026-09-17 폰에서 확인 — 잘 보인다. 되돌리지 않는다.**
      대비 수치가 낮은데도 보이는 것은 면의 명도 차이(`paper`/`surface`/`sunken`)가
      함께 층을 만들기 때문이다. **숫자만 보고 다시 올리지 않는다.**

> 마지막 항목이 이 계획의 사용자 요구다. 「틀려도 잘 모르겠다」가 출발점이었다.

---

## 리스크

| 리스크 | 대응 |
|---|---|
| Tailwind 4 `@theme`가 `text-metric` 클래스를 안 만들 수 있다 | T4 Step 3에서 먼저 확인. 막히면 보고 후 `@utility`로 전환 |
| 한글 웹폰트가 생각보다 무겁다 | T3 Step 6에서 실측. 상한 초과 시 웨이트를 400·600 둘로 줄인다 |
| 본문 15px·13px이 폰에서 작다 | T4 Step 6에서 판단. 올리게 되면 스펙을 먼저 고친다 |
| 클래스 일괄 치환이 문자열 안의 값을 건드린다 | 치환 후 `pnpm build` + e2e로 확인. `sed` 범위를 `className=` 안으로 제한 |
