# 터치 타깃 44×44px 구현 계획

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.

**Spec:** `docs/specs/2026-09-09-touch-targets.md`

**Goal:** 누를 수 있는 것이 전부 44×44px 이상이 되고, **화면을 쓸어서 재는 e2e**가 그것을 지킨다.
나중에 추가되는 버튼도 목록에 등록할 필요 없이 자동으로 걸린다.

**Architecture:** 검사는 **스윕 하나**다 — 화면마다 `button, a, input, select, textarea`를 전부 모아
예외를 빼고 `getBoundingClientRect()`로 잰다. 소스 검사는 쓰지 않는다: 클래스가 붙어 있어도 부모가
짓누르면 44px가 안 되고, **그건 렌더 측정만 잡는다.** 고치는 쪽은 기존 클래스 문자열에
`min-h-11`(·`min-w-11`)을 더하는 **외과적 수정**이다 — 공용 컴포넌트 추출은 이 계획에 없다.

**작업 위치:** `frontend/`

**반드시 먼저 읽을 것:** `CLAUDE.md`(루트) → `frontend/CLAUDE.md` → `docs/conventions/frontend.md` → `docs/conventions/git.md`

---

## AC 커버리지 매핑

| AC ID | 요약 | 담당 태스크 | 검증 방식 |
|---|---|---|---|
| AC-TOUCH-01 | 11개 화면 스윕이 전부 통과 | Task 5 | e2e |
| AC-TOUCH-02 | 다이얼로그 4개도 통과 | Task 5 | e2e |
| AC-TOUCH-03 | 예외 `<a>`가 정확히 2개 | Task 3 | e2e |
| AC-TOUCH-04 | ★ 5개가 44×44 | Task 4 | e2e |
| AC-TOUCH-05 | ↑ ↓ 삭제가 44×44 | Task 4 | e2e |
| AC-TOUCH-06 | 체크박스가 44×44 | Task 4 | e2e |
| AC-TOUCH-07 | disabled인 ↑↓도 44×44 | Task 4 | e2e |
| AC-TOUCH-08 | 「원두량」 높이 44px | Task 2 | e2e |
| AC-TOUCH-09 | 「공개 범위」 높이 44px | Task 2 | e2e |
| AC-TOUCH-10 | BottomNav 90×44 유지 | Task 5 | e2e |
| AC-TOUCH-11 | 판정 함수의 경계값 | Task 1 | 단위 테스트 |
| AC-TOUCH-12 | 가로 스크롤 0 | Task 5 | e2e |

**12개 전부 매핑됐다.** 스펙과 대조해 확인했다.

---

## Global Constraints

- **백엔드를 건드리지 않는다.** `backend/` 아래 수정 0건.
- **`visual-hierarchy`가 잠근 색 8개·글자 크기 5단계를 깨지 않는다.** 새로 쓰는 클래스는
  `min-h-11`·`min-w-11`·`size-11`·`inline-flex`·`items-center`·`justify-center`뿐이며
  **색도 글자 크기도 아니다.** `designTokens.test.ts`·`contrast.test.ts`가 그대로 초록이어야 한다.
- **`screen-consistency`가 잠근 `gap-x-3`·라벨 어휘·대표 수치를 깨지 않는다.**
  `consistency.test.ts`와 `e2e/consistency.spec.ts`가 그대로 초록이어야 한다.
- **공용 컴포넌트를 추출하지 않는다.** 같은 클래스 문자열이 16곳에 반복되지만, 추출은 이 계획에
  없는 리팩터링이다. 필요해 보이면 제안하고 확인받는다.
- **e2e 경로는 스텁이 아는 것만 쓴다** — `e2e/screens.ts`의 11개. `/recipes/12`는 **hoffmann**이고
  kasuya는 **id 3**이다.

---

## ★ 구현자가 먼저 알아야 할 함정 넷

1. **`min-h-11`만으로는 글자가 가운데 오지 않는다.** `<a>`와 일부 `<button>`은 내용이 위로 붙는다.
   **`inline-flex items-center justify-center`를 함께 붙인다.** 붙이지 않으면 44px는 맞는데
   글자가 위쪽에 떠 있는 이상한 버튼이 된다.
2. **`<input type="checkbox">`는 `min-h`로 커지지 않는다.** 네이티브 컨트롤이라 `size-11`처럼
   `width`·`height`를 직접 줘야 브라우저가 확대한다. **네모가 눈에 띄게 커진다** — 의도된 것이다.
3. **`<select>`에 `min-h-11`을 주면 화살표 위치가 브라우저 기본대로 세로 가운데로 간다.**
   추가 작업이 필요 없지만, 렌더값을 재기 전에는 확신하지 마라.
4. **`pnpm e2e`는 첫 실행에 `next build`를 돌려 6분 넘게 걸린다.** 그때 PWA 캐시 테스트
   두 개(`AC-PWA-19`·`20`)가 **부하로 타임아웃할 수 있다.** 회귀가 아니다 —
   재실행하거나 `pwa.spec.ts`만 단독으로 돌려 확인한다(`docs/JOURNAL.md` 2026-09-08).

---

## File Structure

```
frontend/
├── src/
│   ├── test/
│   │   ├── touchTarget.ts                  ← 새로 만듦 (판정 함수)
│   │   └── touchTarget.test.ts             ← 새로 만듦 (AC-11)
│   ├── app/
│   │   ├── page.tsx                        Task 3 — 「전체 보기」
│   │   ├── brews/page.tsx                  Task 3 — 「레시피」
│   │   ├── recipes/page.tsx                Task 3·4 — 「새 레시피」 · 체크박스
│   │   ├── more/page.tsx                   Task 3 — 로그아웃 · 복사
│   │   ├── offline/page.tsx                Task 3
│   │   └── login/test/page.tsx             Task 2·3
│   ├── components/
│   │   └── ErrorState.tsx                  Task 3 — 다시 시도
│   └── features/
│       ├── brewlog/components/
│       │   ├── BrewLogFields.tsx           Task 2 — input 2 · select 2 · textarea 1 · button 2
│       │   ├── BrewLogForm.tsx             Task 2·3 — select 1 · button 3
│       │   ├── BrewLogEditor.tsx           Task 2·3 — select 1 · button 2
│       │   ├── BrewDetail.tsx              Task 3 — 편집 · 삭제
│       │   ├── RatingInput.tsx             Task 4 — ★ 5개
│       │   ├── BeanBatchDialog.tsx         Task 5 — input 3 · select 2 · button 2
│       │   ├── UserGrinderDialog.tsx       Task 5 — input 1 · select 1 · button 2
│       │   └── DeleteBrewLogDialog.tsx     Task 5 — button 2
│       ├── recipe/components/
│       │   ├── RecipeForm.tsx              Task 2 — input 2 · select 2 · textarea 1 · button 2
│       │   ├── RecipeStepEditor.tsx        Task 2·4 — input 1 · select 1 · button 5
│       │   ├── GrindSettingField.tsx       Task 2 — input 1 · select 2
│       │   ├── RecipeDetail.tsx            Task 3 — 포크 · 삭제
│       │   └── DeleteRecipeDialog.tsx      Task 5 — button 2
│       ├── gear/components/GrindConverter.tsx   Task 2·3 — input 1 · select 1 · button 1
│       └── user/components/UserProfile.tsx      Task 3 — button 1
└── e2e/
    └── touch-targets.spec.ts               ← 새로 만듦 (Task 2~5가 차례로 채운다)
```

**건드리지 않는 파일:** `BottomNav.tsx`(이미 90×44) · `RecipeCard.tsx`·`BrewLogCard.tsx`(카드 전체가
링크라 328×114 이상).

---

## Task 1: 판정 함수와 경계값

**Files:**
- Create: `frontend/src/test/touchTarget.ts`
- Test: `frontend/src/test/touchTarget.test.ts`

**Covers:** AC-TOUCH-11

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces: `meetsTouchTarget(box: { width: number; height: number }): boolean` —
  Task 2~5의 e2e가 이 함수를 import해서 쓴다. **경계를 한 곳에만 둔다.**

> **왜 함수로 빼는가.** 44라는 숫자가 e2e 여러 곳에 흩어지면 한 곳만 고쳐도 조용히 어긋난다.
> 그리고 「43.99는 미달」 같은 경계는 **e2e가 아니라 단위 테스트로 못박는 편이 싸다.**

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
import { describe, expect, it } from "vitest";
import { meetsTouchTarget, TOUCH_TARGET_PX } from "./touchTarget";

describe("AC-TOUCH-11 · 판정 함수의 경계값", () => {
  it("기준이 44다", () => {
    expect(TOUCH_TARGET_PX).toBe(44);
  });

  it.each([
    [{ width: 44, height: 44 }, true],
    [{ width: 44, height: 43.9 }, false],
    [{ width: 43.9, height: 44 }, false],
    // 반올림하지 않는다. 43.99는 44가 아니다.
    [{ width: 43.99, height: 43.99 }, false],
    [{ width: 100, height: 44 }, true],
  ])("%o → %s", (box, expected) => {
    expect(meetsTouchTarget(box)).toBe(expected);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm test src/test/touchTarget.test.ts`
Expected: FAIL — `Failed to resolve import "./touchTarget"`. 모듈이 아직 없다

- [ ] **Step 3: 최소 구현**

```ts
/**
 * 터치 타깃의 최소 변. `docs/conventions/frontend.md:179` —
 * 「터치 타깃은 최소 44×44px. 부엌에서 젖은 손으로 쓴다」.
 */
export const TOUCH_TARGET_PX = 44;

/**
 * 두 변이 **모두** 기준 이상인가.
 *
 * <p><b>반올림하지 않고 허용 오차도 두지 않는다.</b> `43.99`는 미달이다. 오차를 두는 순간
 * 「44px」이 사실상 43px가 되고, 다음 사람은 진짜 경계가 어디인지 알 수 없게 된다.
 */
export function meetsTouchTarget(box: {
  width: number;
  height: number;
}): boolean {
  return box.width >= TOUCH_TARGET_PX && box.height >= TOUCH_TARGET_PX;
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `pnpm test src/test/touchTarget.test.ts`
Expected: PASS, 6 tests

Run: `pnpm test`
Expected: PASS, 365 + 6 = **371**

- [ ] **Step 5: 커밋**

```bash
pnpm format && pnpm typecheck && pnpm lint && pnpm test
cd .. && git add . && git commit -m "test(web): 터치 타깃 판정 함수와 경계값 (AC-TOUCH-11)"
```

> **`pnpm format`이 `pnpm-lock.yaml`까지 포맷한다.** `git add` 전에 `git status`로 확인한다.

---

## Task 2: 입력 요소를 44px로

**Files:**
- Create: `frontend/e2e/touch-targets.spec.ts`
- Modify: `frontend/src/features/brewlog/components/BrewLogFields.tsx`
- Modify: `frontend/src/features/recipe/components/RecipeForm.tsx`
- Modify: `frontend/src/features/recipe/components/RecipeStepEditor.tsx`
- Modify: `frontend/src/features/recipe/components/GrindSettingField.tsx`
- Modify: `frontend/src/features/gear/components/GrindConverter.tsx`
- Modify: `frontend/src/features/brewlog/components/BrewLogForm.tsx`
- Modify: `frontend/src/features/brewlog/components/BrewLogEditor.tsx`
- Modify: `frontend/src/app/login/test/page.tsx`

**Covers:** AC-TOUCH-08, AC-TOUCH-09

**Interfaces:**
- Consumes: `meetsTouchTarget`
- Produces: `e2e/touch-targets.spec.ts` — Task 3~5가 이어서 채우는 파일

**바꾸는 클래스 문자열 — 실측한 것 그대로**

| 현행 | 확정 | 어디 |
|---|---|---|
| `rounded border border-line px-2 py-1` | `+ min-h-11` | 입력·select 16곳 |
| `rounded border border-line px-2 py-1 text-sm` | `+ min-h-11` | 3곳 |
| `w-32`·`w-24`·`w-20`·`flex-1` 접두 변형 | `+ min-h-11` | 5곳 |

**`textarea`는 이미 70px라 손대지 않는다.**

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
import { expect, test } from "@playwright/test";
import { TOUCH_TARGET_PX } from "../src/test/touchTarget";
import { installStubs } from "./stubs";

test.describe("터치 타깃 — 입력 요소", () => {
  test("AC-TOUCH-08 · 「원두량」 입력칸의 높이가 44px다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/brews/new?recipeId=12");

    const box = await page.getByLabel("원두량").boundingBox();

    expect(box?.height).toBe(TOUCH_TARGET_PX);
  });

  test("AC-TOUCH-09 · 「공개 범위」 select의 높이가 44px다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/brews/new?recipeId=12");

    const box = await page.getByLabel("공개 범위").boundingBox();

    expect(box?.height).toBe(TOUCH_TARGET_PX);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
pnpm e2e e2e/touch-targets.spec.ts
```
Expected: FAIL 2개 — 각각 `30`과 `29`가 와서 `44`와 다르다

- [ ] **Step 3: 최소 구현**

각 파일에서 위 표의 클래스 문자열에 `min-h-11`을 더한다. 예:

```tsx
        className="w-32 rounded border border-line px-2 py-1 min-h-11"
```

> **`select`는 `min-h-11`만으로 충분한지 렌더로 확인한다.** 브라우저가 화살표를 세로 가운데로
> 옮겨주는지는 재보기 전에는 모른다.

- [ ] **Step 4: 테스트 실행 — 통과 확인**

```bash
pnpm e2e e2e/touch-targets.spec.ts
```
Expected: PASS, 2 tests

```bash
pnpm test && pnpm typecheck && pnpm lint
```
Expected: PASS, 371 (단위 테스트는 늘지 않는다)

- [ ] **Step 5: 커밋**

```bash
pnpm format && pnpm typecheck && pnpm lint && pnpm test
cd .. && git add . && git commit -m "feat(web): 입력칸과 select를 44px로 (AC-TOUCH-08·09)"
```

---

## Task 3: 버튼과 버튼처럼 생긴 링크를 44px로

**Files:**
- Modify: `frontend/src/app/page.tsx` · `brews/page.tsx` · `recipes/page.tsx` · `more/page.tsx` · `offline/page.tsx` · `login/test/page.tsx`
- Modify: `frontend/src/components/ErrorState.tsx`
- Modify: `frontend/src/features/recipe/components/RecipeDetail.tsx`
- Modify: `frontend/src/features/brewlog/components/BrewDetail.tsx` · `BrewLogForm.tsx` · `BrewLogEditor.tsx`
- Modify: `frontend/src/features/recipe/components/RecipeForm.tsx`
- Modify: `frontend/src/features/gear/components/GrindConverter.tsx`
- Modify: `frontend/src/features/user/components/UserProfile.tsx`
- Test: `frontend/e2e/touch-targets.spec.ts`

**Covers:** AC-TOUCH-03

**Interfaces:**
- Consumes: Task 2의 `e2e/touch-targets.spec.ts`
- Produces: 예외 규칙의 셀렉터 문자열 —
  `":is(p, h1, h2, h3, h4, h5, h6) a"`. Task 5의 스윕이 이것으로 예외를 뺀다

> **★ 예외 둘을 건드리지 않는 것이 이 태스크의 핵심이다.** `RecipeDetail`의 출처 링크(`<p>` 안)와
> `BrewDetail`의 제목 링크(`<h1>` 안)는 **그대로 둔다.** 나머지 링크 넷
> (`전체 보기`·`레시피`·`새 레시피`·`편집`)은 `<h1>`의 **형제**이지 자손이 아니므로 대상이다.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
test.describe("터치 타깃 — 예외", () => {
  test("AC-TOUCH-03 · 예외로 빠지는 <a>가 정확히 2개다", async ({ page }) => {
    await installStubs(page);

    const counts: Record<string, number> = {};
    for (const path of ["/", "/recipes", "/recipes/12", "/brews", "/brews/2", "/more"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      counts[path] = await page
        .locator(":is(p, h1, h2, h3, h4, h5, h6) a")
        .count();
    }

    expect(counts).toEqual({
      "/": 0,
      "/recipes": 0,
      "/recipes/12": 1, // <p> 안의 출처 링크 James Hoffmann
      "/brews": 0,
      "/brews/2": 1, // <h1> 안의 레시피 제목
      "/more": 0,
    });
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
pnpm e2e e2e/touch-targets.spec.ts
```
Expected: **이 테스트는 첫 실행에 통과할 수 있다.** 예외 규칙은 지금도 성립한다 —
**이 테스트가 지키는 것은 「Task 3이 그 둘을 건드리지 않았다」이다.** 통과하면 그대로 두고
Step 3으로 간다. 실패하면 예외 규칙이 실제와 다르다는 뜻이므로 **거기서 멈추고 스펙을 다시 본다.**

- [ ] **Step 3: 최소 구현**

버튼·링크의 클래스 문자열에 `min-h-11`과 정렬을 더한다.

```tsx
  className="inline-flex min-h-11 items-center justify-center rounded-md bg-brand px-3 py-1.5 text-sm text-on-accent"
```

> **`inline-flex items-center justify-center`를 빼먹지 않는다.** `min-h-11`만 주면 44px는 맞는데
> 글자가 위쪽에 붙는다. `<a>`에서 특히 눈에 띈다.

**손대지 않는 둘:**
- `RecipeDetail`의 `{recipe.authorName}` 링크 (`<p>` 안)
- `BrewDetail`의 `<h1>` 안 `<Link>`

- [ ] **Step 4: 테스트 실행 — 통과 확인**

```bash
pnpm e2e e2e/touch-targets.spec.ts
```
Expected: PASS, 3 tests

```bash
pnpm test
```
Expected: PASS, 371. **`headings.test.ts`(h1 15곳)와 `consistency.test.ts`가 초록이어야 한다** —
`<h1>` 안을 건드리지 않았다는 뜻이다

- [ ] **Step 5: 커밋**

```bash
pnpm format && pnpm typecheck && pnpm lint && pnpm test
cd .. && git add . && git commit -m "feat(web): 버튼과 버튼형 링크를 44px로 (AC-TOUCH-03)"
```

---

## Task 4: 아이콘 버튼과 체크박스를 44×44로

**Files:**
- Modify: `frontend/src/features/brewlog/components/RatingInput.tsx`
- Modify: `frontend/src/features/recipe/components/RecipeStepEditor.tsx`
- Modify: `frontend/src/app/recipes/page.tsx`
- Test: `frontend/e2e/touch-targets.spec.ts`

**Covers:** AC-TOUCH-04, AC-TOUCH-05, AC-TOUCH-06, AC-TOUCH-07

**Interfaces:**
- Consumes: Task 1의 `meetsTouchTarget`
- Produces: 없음

> **여기가 레이아웃이 넘칠 수 있는 유일한 곳이다.** ★ 다섯 개를 44px로 키우면
> `80 + 5×44 + gap 20 = 320px`로 **328px 중 8px만 남는다.** `AC-TOUCH-12`(Task 5)가 이것을 잡지만,
> 이 태스크에서 이미 눈으로 확인해두면 원인을 찾기 쉽다.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
import { meetsTouchTarget } from "../src/test/touchTarget";

test.describe("터치 타깃 — 아이콘 버튼", () => {
  test("AC-TOUCH-04 · ★ 별점 5개가 각각 44×44다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/brews/new?recipeId=12");

    for (const star of [1, 2, 3, 4, 5]) {
      const box = await page.getByRole("button", { name: `별점 ${star}` }).boundingBox();
      expect(box, `별점 ${star}`).not.toBeNull();
      expect(meetsTouchTarget(box!), `별점 ${star} ${box!.width}x${box!.height}`).toBe(true);
    }
  });

  test("AC-TOUCH-05 · 스텝 행의 ↑ ↓ 삭제가 각각 44×44다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/recipes/12/edit");

    for (const name of ["스텝 2 위로", "스텝 2 아래로", "스텝 2 삭제"]) {
      const box = await page.getByRole("button", { name }).boundingBox();
      expect(meetsTouchTarget(box!), `${name} ${box!.width}x${box!.height}`).toBe(true);
    }
  });

  test("AC-TOUCH-06 · 「내 레시피만」 체크박스가 44×44다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/recipes");

    const box = await page.getByRole("checkbox", { name: "내 레시피만" }).boundingBox();

    expect(meetsTouchTarget(box!), `${box!.width}x${box!.height}`).toBe(true);
  });

  test("AC-TOUCH-07 · disabled인 ↑ ↓도 44×44다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/recipes/12/edit");

    // hoffmann은 스텝 7개다. 첫 스텝의 ↑와 마지막 스텝의 ↓가 disabled다.
    const first = page.getByRole("button", { name: "스텝 1 위로" });
    const last = page.getByRole("button", { name: "스텝 7 아래로" });

    await expect(first).toBeDisabled();
    await expect(last).toBeDisabled();
    expect(meetsTouchTarget((await first.boundingBox())!)).toBe(true);
    expect(meetsTouchTarget((await last.boundingBox())!)).toBe(true);
  });
});
```

> **`/recipes/12`는 hoffmann이고 스텝이 7개다**(`hoffmannSteps`). 스텝 수가 다르면
> `스텝 7 아래로`가 없어 이 테스트가 헛돈다. **먼저 화면을 열어 스텝 수를 확인한다.**

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
pnpm e2e e2e/touch-targets.spec.ts
```
Expected: FAIL 4개 — ★ `30x22` · ↑↓ `29x30` · 삭제 `42x30` · 체크박스 `13x13`

- [ ] **Step 3: 최소 구현**

`RatingInput.tsx` — `px-1`을 크기로 바꾸고 가운데 정렬한다.

```tsx
          className="inline-flex size-11 items-center justify-center text-[22px] leading-none"
```

`RecipeStepEditor.tsx` — `↑`·`↓`·`삭제` 셋 다.

```tsx
                    className="inline-flex size-11 items-center justify-center rounded border border-line text-sm disabled:opacity-40"
```

`app/recipes/page.tsx` — **네이티브 체크박스는 `min-h`로 커지지 않는다.** `size-11`로 직접 준다.

```tsx
            className="size-11"
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

```bash
pnpm e2e e2e/touch-targets.spec.ts
```
Expected: PASS, 7 tests

```bash
pnpm test
```
Expected: PASS, 371

- [ ] **Step 5: 커밋**

```bash
pnpm format && pnpm typecheck && pnpm lint && pnpm test
cd .. && git add . && git commit -m "feat(web): 별점·스텝 버튼·체크박스를 44×44로 (AC-TOUCH-04~07)"
```

---

## Task 5: 다이얼로그를 열어 재고 화면 전체를 쓴다

**Files:**
- Modify: `frontend/src/features/brewlog/components/BeanBatchDialog.tsx`
- Modify: `frontend/src/features/brewlog/components/UserGrinderDialog.tsx`
- Modify: `frontend/src/features/brewlog/components/DeleteBrewLogDialog.tsx`
- Modify: `frontend/src/features/recipe/components/DeleteRecipeDialog.tsx`
- Test: `frontend/e2e/touch-targets.spec.ts`

**Covers:** AC-TOUCH-01, AC-TOUCH-02, AC-TOUCH-10, AC-TOUCH-12

**Interfaces:**
- Consumes: Task 1~4의 모든 수정
- Produces: 없음 (마지막 태스크)

> **★ 스윕이 이 계획의 목적이다.** 앞 네 태스크는 **아는 것**을 고쳤고, 여기서 **모르는 것**이
> 드러난다. Step 2에서 빨간 목록이 나오면 그것이 이 태스크가 존재하는 이유다 —
> 목록을 보고 Step 3에서 고친다.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
import { SCREENS } from "./screens";
import { meetsTouchTarget } from "../src/test/touchTarget";

/** 예외 밖의 상호작용 요소 중 44×44에 못 미치는 것. 사람이 읽을 수 있는 문자열로 돌려준다. */
async function undersized(page: import("@playwright/test").Page): Promise<string[]> {
  return page.evaluate(() => {
    const all = [...document.querySelectorAll("button, a, input, select, textarea")];
    const exempt = new Set(
      document.querySelectorAll(":is(p, h1, h2, h3, h4, h5, h6) a"),
    );
    return all
      .filter((el) => !exempt.has(el))
      .map((el) => {
        const r = el.getBoundingClientRect();
        const name =
          (el as HTMLElement).innerText?.trim().slice(0, 20) ||
          el.getAttribute("aria-label") ||
          (el as HTMLInputElement).type ||
          el.tagName.toLowerCase();
        return { name, w: r.width, h: r.height };
      })
      .filter((b) => b.w < 44 || b.h < 44)
      .map((b) => `${b.name} ${Math.round(b.w)}x${Math.round(b.h)}`);
  });
}

test.describe("터치 타깃 — 스윕", () => {
  for (const { path } of SCREENS) {
    test(`AC-TOUCH-01 · ${path}의 모든 타깃이 44×44 이상이다`, async ({ page }) => {
      await installStubs(page);
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      expect(await undersized(page)).toEqual([]);
    });

    test(`AC-TOUCH-12 · ${path}에 가로 스크롤이 없다`, async ({ page }) => {
      await installStubs(page);
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      const width = await page.evaluate(
        () => document.documentElement.scrollWidth,
      );
      expect(width).toBeLessThanOrEqual(360);
    });
  }

  test("AC-TOUCH-10 · BottomNav 탭 4개가 90×44 그대로다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/recipes");

    for (const name of ["홈", "레시피", "기록", "더보기"]) {
      const box = await page.getByRole("link", { name, exact: true }).boundingBox();
      expect(box, name).toMatchObject({ width: 90, height: 44 });
    }
  });
});

test.describe("터치 타깃 — 다이얼로그", () => {
  const CASES = [
    { path: "/brews/new?recipeId=12", open: "+ 원두 등록", what: "BeanBatchDialog" },
    { path: "/brews/new?recipeId=12", open: "+ 그라인더 등록", what: "UserGrinderDialog" },
    // /recipes/12는 hoffmann이고 ownerUserId가 없어 삭제 버튼이 없다. /recipes/3이 내 것이다.
    { path: "/recipes/3", open: "삭제", what: "DeleteRecipeDialog" },
    { path: "/brews/2", open: "삭제", what: "DeleteBrewLogDialog" },
  ] as const;

  for (const { path, open, what } of CASES) {
    test(`AC-TOUCH-02 · ${what}의 타깃이 44×44 이상이다`, async ({ page }) => {
      await installStubs(page);
      await page.goto(path);
      await page.getByRole("button", { name: open }).click();

      expect(await undersized(page)).toEqual([]);
    });
  }
});
```

> **★ 삭제 버튼은 소유자에게만 보인다.** `/recipes/12`는 `hoffmann`인데 **`ownerUserId`가 없어**
> `isMine`이 거짓이고 「내 레시피로 가져오기」만 뜬다. `/recipes/3`은 `kasuyaRecipe`
> (`ownerUserId: 11`)이고 `me.id`가 11이라 소유자로 열린다. **열리지 않으면 스텁을 먼저
> 확인한다** — 테스트를 약하게 고치지 마라.
> `meetsTouchTarget`을 `undersized` 안에서 쓰지 않는 것은 `page.evaluate`가 **브라우저 안에서**
> 돌아 Node 모듈을 볼 수 없기 때문이다. 경계값은 `AC-TOUCH-11`이 이미 못박았다.

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
pkill -f "next start" || true
pnpm e2e e2e/touch-targets.spec.ts
```
Expected: FAIL — **다이얼로그 4개는 확실히 빨갛다**(`py-1`·`py-1.5`+`text-sm`이라 28~32px).
화면 스윕 11개 중 몇이 빨간지는 **모른다** — Task 2~4가 놓친 것이 여기서 드러난다.
**실패 메시지가 `이름 30x22` 형태로 무엇이 몇 px인지 알려준다.**

- [ ] **Step 3: 최소 구현**

다이얼로그 넷의 입력·select·버튼에 Task 2·3과 같은 방식으로 `min-h-11`과 정렬을 더한다.
그리고 **Step 2가 알려준 나머지를 고친다.**

- [ ] **Step 4: 테스트 실행 — 통과 확인**

```bash
pkill -f "next start" || true
pnpm e2e
```
Expected: PASS, 80 + 7(Task 2~4) + 22(11화면×2) + 1(BottomNav) + 4(다이얼로그) = **114 tests**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```
Expected: PASS, 371

- [ ] **Step 5: 커밋**

```bash
cd .. && git add . && git commit -m "test(web): 화면을 쓸어 터치 타깃을 재고 다이얼로그를 고친다 (AC-TOUCH-01·02·10·12)"
```

---

## 완료 기준

- [ ] `cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build` 통과 (**371개**)
- [ ] `cd frontend && pnpm e2e` 통과 (**114개**) — 첫 실행이 느리면 재실행해 PWA 타임아웃과 구분한다
- [ ] `./scripts/check-spec-coverage.sh` 통과 (AC 724 + 12 = **736**)
- [ ] 스펙의 `status`를 `구현완료`로 변경
- [ ] 스펙 「수동 확인」 2개 — **둘 다 비차단형이라 `status`를 막지 않는다.** 폰 실물이 필요하다

---

## 자체 검토 결과

계획을 다 쓴 뒤 스펙과 대조해 확인한 것.

- **AC 12개가 전부 태스크에 매핑됐다.** 커버리지 표로 대조했다.
- **★ 스펙에 구멍이 있었고 인터뷰로 되돌려 메웠다.** 「내 레시피만」은 `<label>`이 감싸고 있어
  **실질 타깃이 이미 라벨 행**인데 스윕은 `<input>`을 잰다. 사람에게 확인받아
  **`AC-TOUCH-06`을 그대로 두기로**(체크박스 자체를 44×44) 결정했다.
- **★ `min-h-11`만으로는 글자가 가운데 오지 않는다.** `inline-flex items-center justify-center`가
  함께 필요하다. 계획의 「함정」 절에 올렸다.
- **★ 네이티브 체크박스는 `min-h`로 커지지 않는다.** `size-11`로 `width`·`height`를 직접 줘야 한다.
- **★ `page.evaluate` 안에서는 `meetsTouchTarget`을 쓸 수 없다.** 브라우저 컨텍스트라 Node
  모듈이 없다. 스윕은 숫자 `44`를 인라인으로 쓰고, **경계값은 `AC-TOUCH-11`이 단위 테스트로
  못박는다.** 두 곳에 44가 생기는 것을 알고 남긴다.
- **★ ★ 별점 행이 328px 중 320px을 쓴다.** 여유 8px. `AC-TOUCH-12`가 이것을 지킨다.
- **태스크가 서로 물리지 않는다.** Task 2~4는 각자 자기 AC만 보고, Task 5의 스윕만 전부에
  의존한다. **Task 5의 Step 2에서 빨간 것이 나오는 것이 정상이다.**
- **e2e 개수를 계산해 적었다** (80 → 114). 어긋나면 어느 태스크에서 벌어졌는지 보인다.
- **★ 계획 초고가 `/recipes/12`에서 삭제 다이얼로그를 열려 했다.** 그 화면은 `hoffmann`이고
  **`ownerUserId`가 없어** 삭제 버튼이 없다 — 실측에도 「내 레시피로 가져오기」 하나뿐이었다.
  `/recipes/3`(`kasuyaRecipe`, `ownerUserId: 11` = `me.id`)으로 고쳤다. **스펙의 AC-TOUCH-02도
  같이 고쳤다.**
- **`/recipes/12/edit`은 hoffmann이라 스텝이 7개다**(`hoffmannSteps`). `AC-TOUCH-07`의
  `스텝 7 아래로`가 존재한다. `/recipes/3`은 kasuya라 6개다 — 헷갈리지 마라.
- **건드리지 않는 파일을 명시했다** — `BottomNav`(이미 90×44)와 카드 둘(전체가 링크).
  `AC-TOUCH-10`이 `BottomNav`의 회귀를 막는다.
