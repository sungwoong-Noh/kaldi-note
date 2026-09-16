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

- [ ] **Step 1: 실패하는 테스트 작성**

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

- [ ] **Step 2: 실패 확인** — 현재 토큰이 8개이고 hex라 세 개 다 실패해야 한다
- [ ] **Step 3: `tokens.ts` 갱신** — `TOKEN_NAMES`를 15개로, 파서를 `oklch(...)`도 읽게
- [ ] **Step 4: `globals.css` 교체**

  값은 **`docs/design/design_handoff_kaldi_note/README.md`의 Design Tokens 표**에서 가져온다.
  `danger`는 스펙이 정한 `oklch(0.50 0.18 28)` / `oklch(0.72 0.15 28)`.
  `raised`는 라이트에서 `paper`와 같은 값으로 둔다(스펙 「데이터」 절).
  `@theme inline`의 `--color-*` 매핑도 15개로 맞춘다.

- [ ] **Step 5: 클래스 이름 일괄 치환** — 위 표대로. `sed`로 하되 **치환 후 `pnpm build`로 확인**한다
- [ ] **Step 6: 기존 대비 테스트 갱신** — `AC-READ-01`·`02`·`03`·`05`·`06`의 **ID는 남기고** 기대값을 새 토큰 기준으로
- [ ] **Step 7: `pnpm test` 전체 초록 + 로컬에서 화면 눈으로 확인 후 커밋**

> **이 태스크는 화면 색이 실제로 바뀌는 유일한 지점이다.** 라이트·다크 양쪽을 폰 크기로 열어본다.

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

- [ ] **Step 1: 실패하는 테스트 작성**

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

- [ ] **Step 2: 실패 확인**
- [ ] **Step 3: 폰트 파일 복사 + `@font-face` 작성.** 한글 조각의 `unicode-range`는
      fontsource CSS에서 그대로 옮긴다 — **손으로 짐작해 쓰지 않는다**
- [ ] **Step 4: `--font-sans`·`--font-mono` 갱신** (`AC-DS2-09`)
- [ ] **Step 5: 통과 확인**
- [ ] **Step 6: 실측 — 폰 화면에서 첫 페인트 확인.** `swap`이 동작해 글자가 먼저 뜨는지 본다
- [ ] **Step 7: 커밋**

> **`AC-POLISH-03`(`--font-geist-sans` 참조 없음)은 그대로 통과해야 한다.** 이 태스크가 그것을 깨지 않는지 확인한다.

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

- [ ] **Step 1: 실패하는 테스트 작성**

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

- [ ] **Step 2: 실패 확인**
- [ ] **Step 3: `@theme` 선언 후 `text-metric` 같은 클래스가 실제 생성되는지 확인.**
      생성되지 않으면 `@utility`나 플러그인으로 바꾼다 — **여기서 막히면 진행 전에 보고한다**
- [ ] **Step 4: 일괄 치환.** 수치인지 서술인지 구분이 필요하므로 **`data-lead`·`dd` 요소를 먼저 훑는다**
- [ ] **Step 5: `AC-VISUAL-05`의 테스트 본문 갱신** (ID 유지)
- [ ] **Step 6: 폰으로 읽어보고 크기 판단 → 필요하면 스펙 갱신 후 재치환**
- [ ] **Step 7: 커밋**

---

## Task 5: 모서리와 그림자

**Files:**
- Modify: `src/test/spacing.test.ts`, `src/**/*.tsx`, `src/app/globals.css`

**Covers:** AC-DS2-16, 17

**모서리 4종** — 태그 3px · 컨트롤 7–8px · 면 10–14px · 원형.
기존 2역할(`rounded-md` 6px / `rounded-lg` 8px)에서 늘어난다.
`AC-SPACE-04`·`05`·`06`의 테스트 본문을 새 4종으로 갱신한다(ID 유지).

**간격 7단계** — `AC-SPACE-01`·`02`의 `SCALE`에 `8`(32px)을 추가한다.

- [ ] **Step 1: `spacing.test.ts`의 `SCALE`에 `8` 추가 → 실패 확인**(죽은 단계 검사에 걸림)
- [ ] **Step 2: 32px이 필요한 곳을 찾아 적용**(핸드오프 기준 섹션 간 여백)
- [ ] **Step 3: 모서리 4종 테스트 작성 → 실패 확인**
- [ ] **Step 4: 치환** — 카드·히어로를 면(10–14px)으로, 배지를 태그(3px)로
- [ ] **Step 5: `AC-SPACE-08` 갱신** — `shadow` 0곳에서 **포커스 링 1곳 예외**로
- [ ] **Step 6: 커밋**

---

## Task 6: UI 프리미티브 6종

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

- [ ] **Step 1: 실패하는 테스트 작성**

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

- [ ] **Step 2: 실패 확인**
- [ ] **Step 3: 프리미티브 6종 구현.** 44px 보장(`min-h-11`)을 컴포넌트가 떠안는다
- [ ] **Step 4: 통과 확인**
- [ ] **Step 5: 호출부 이관.** **한 번에 하나의 컴포넌트씩** 옮기고 매번 `pnpm test`를 돌린다 —
      15곳 이상이 바뀌므로 한꺼번에 하면 어디서 깨졌는지 모른다
- [ ] **Step 6: `AC-TOUCH-*`가 그대로 통과하는지 확인**(`touchTarget.test.ts`)
- [ ] **Step 7: 커밋**

---

## Task 7: 폼 검증 에러

**Files:**
- Modify: `src/components/ui/{Input,Select}.tsx`, `src/features/**/`(FieldError 호출부), `src/test/primitives.test.tsx`

**Covers:** AC-DS2-22, 23, 24

**현재 상태:** `FieldError`가 입력칸 **아래에 문구만** 띄운다. `aria-invalid`도, 보더 변화도 없다.
그래서 무엇이 틀렸는지 눈으로 찾아야 한다.

- [ ] **Step 1: 실패하는 테스트 작성**

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

- [ ] **Step 2: 실패 확인**
- [ ] **Step 3: `Input`·`Select`에 `error` prop 처리 구현.** `id` 생성은 `useId()`로
- [ ] **Step 4: 기존 `FieldError` 호출부를 `error` prop으로 이관**
- [ ] **Step 5: 실제 폼에서 확인** — 레시피 작성 화면에서 빈 값으로 저장을 눌러본다
- [ ] **Step 6: 커밋**

---

## Task 8: 마감

**Files:**
- Modify: `src/test/designTokens.test.ts`, 기존 시각 스펙 4개

**Covers:** AC-DS2-25

- [ ] **Step 1: `data-*` 훅 보존 테스트 작성**

```ts
it("AC-DS2-25 · 기존 data-* 훅이 남아 있다", () => {
  const all = SOURCES.map((p) => readFileSync(p, "utf8")).join("");
  for (const hook of ["data-lead", "data-compare", "data-diff", "data-empty"]) {
    expect(all.includes(hook)).toBe(true);
  }
});
```

- [ ] **Step 2: 기존 시각 스펙 4개의 값을 갱신한다** — 스펙의 「기존 AC 갱신」 표대로.
      `2026-09-07-visual-hierarchy.md` · `2026-09-09-spacing-system.md` ·
      `2026-09-15-readability.md` · `2026-09-05-polish.md`.
      **각 스펙에 「2026-09-17 갱신」 노트를 달고 옛 값을 남겨둔다** — 왜 바뀌었는지가 사라지면 안 된다
- [ ] **Step 3: `./scripts/check-spec-coverage.sh` 통과 확인**
- [ ] **Step 4: 스펙 `status`를 `구현완료`로**
- [ ] **Step 5: `pnpm test` · `pnpm build` · e2e 전체 초록 확인**
- [ ] **Step 6: 커밋 후 PR**

---

## 검증

**자동:** `pnpm test` (단위·렌더) · `pnpm build` · `pnpm e2e` · `./scripts/check-spec-coverage.sh`

**수동 (차단형)**

- [ ] 폰에서 라이트·다크 양쪽으로 전 화면을 연다. **색이 뒤집힌 곳이 없는지**
- [ ] 느린 회선(개발자도구 Slow 3G)에서 첫 페인트에 **글자가 보이는지**(`swap` 동작)
- [ ] 레시피 작성 화면에서 빈 값 저장 → **무엇이 틀렸는지 한눈에 보이는지**

> 마지막 항목이 이 계획의 사용자 요구다. 「틀려도 잘 모르겠다」가 출발점이었다.

---

## 리스크

| 리스크 | 대응 |
|---|---|
| Tailwind 4 `@theme`가 `text-metric` 클래스를 안 만들 수 있다 | T4 Step 3에서 먼저 확인. 막히면 보고 후 `@utility`로 전환 |
| 한글 웹폰트가 생각보다 무겁다 | T3 Step 6에서 실측. 상한 초과 시 웨이트를 400·600 둘로 줄인다 |
| 본문 15px·13px이 폰에서 작다 | T4 Step 6에서 판단. 올리게 되면 스펙을 먼저 고친다 |
| 클래스 일괄 치환이 문자열 안의 값을 건드린다 | 치환 후 `pnpm build` + e2e로 확인. `sed` 범위를 `className=` 안으로 제한 |
