# 구조와 폼 구현 계획

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.

**Spec:** `docs/specs/2026-09-15-structure.md`

**Goal:** 폼의 오른쪽 끝을 하나로 맞추고, 푸어 스텝을 시간 축으로 그리고, 기록 화면이 「어떤
레시피로 어떻게 내렸는지」를 스스로 말하게 만든다. 영어 상태값을 없애고 대표 수치를 통일한다.

**Architecture:** 태스크 7개가 **서로 독립적**이다. 상태값·대표 수치처럼 작고 닫힌 것부터
초록을 쌓고, 폼·타임라인·비교표 순으로 간다. **백엔드는 한 줄도 건드리지 않는다** — 한글화는
표시 계층에서만 하고, 비교표는 `useRecipeLabel`이 이미 받아오는 응답에서 필드를 더 꺼내 쓴다.

**작업 위치:** `frontend/`

**반드시 먼저 읽을 것:** `CLAUDE.md`(루트) → `frontend/CLAUDE.md` → `docs/conventions/frontend.md` → `docs/conventions/git.md`

---

## AC 커버리지 매핑

| AC ID | 요약 | 담당 태스크 | 검증 방식 |
|---|---|---|---|
| AC-STRUCT-14 | 화면에 영어 상태값 0곳 | Task 1 | e2e |
| AC-STRUCT-15 | enum 9개 한글 변환 | Task 1 | 단위 테스트 |
| AC-STRUCT-16 | CURATED → 기본 제공 | Task 1 | e2e |
| AC-STRUCT-17 | 레시피 대표 수치가 `1:비율` | Task 2 | e2e |
| AC-STRUCT-18 | 기록 대표 수치가 `1:비율` | Task 2 | e2e |
| AC-STRUCT-01 | 일반 필드 right 1종류(344) | Task 3 | e2e |
| AC-STRUCT-06 | 단위가 입력칸 안 | Task 3 | e2e |
| AC-STRUCT-02 | select 13곳 appearance-none | Task 4 | 단위 테스트 |
| AC-STRUCT-03 | select 높이 44px 유지 | Task 4 | e2e |
| AC-STRUCT-04 | 체크박스 20×20 + 탭 44×44 | Task 4 | e2e |
| AC-STRUCT-05 | 스텝 행 열 위치 고정 | Task 5 | e2e |
| AC-STRUCT-07 | 읽기 2곳에 시간 축 | Task 6 | e2e |
| AC-STRUCT-08 | 시간 열 폭이 두 화면에서 같다 | Task 6 | e2e |
| AC-STRUCT-09 | 편집 화면엔 타임라인 없음 | Task 6 | e2e |
| AC-STRUCT-10 | 비교표 4행 | Task 7 | e2e |
| AC-STRUCT-11 | 다를 때만 드러남 | Task 7 | e2e |
| AC-STRUCT-12 | 「현재 레시피와 비교」 문구 | Task 7 | e2e |
| AC-STRUCT-13 | 레시피 못 읽으면 실측값만 | Task 7 | e2e |
| AC-STRUCT-19 | 빈 기록 → /recipes | Task 8 | e2e |
| AC-STRUCT-20 | 빈 레시피 → /recipes/new | Task 8 | e2e |

**스펙의 AC 20개 중 20개가 매핑됨.**

---

## Global Constraints

- **백엔드 변경 0건.** enum도 API도 그대로다
- **`AC-READ` 21개를 깨지 않는다.** 색도 글자 5단계도 건드리지 않는다
- **터치 타깃 44×44px을 잃지 않는다.** 컨트롤 모양을 바꾸는 Task 4가 특히 위험하다
- **새 API 요청을 늘리지 않는다.** 비교표는 `useRecipeLabel`이 이미 받는 응답을 쓴다

---

## File Structure

```
frontend/src/
  lib/statusLabel.ts                        신규 — enum → 한글 (features 교차 import를 피해 lib에 둔다)
  lib/statusLabel.test.ts                   신규 — AC-STRUCT-15·16
  features/brewlog/components/
    ExtractionSummary.tsx                   수정 — 한글 적용
    BrewDetail.tsx                          수정 — 대표 수치·비교표
    BrewLogCard.tsx                         수정 — 대표 수치
    RecipeComparison.tsx                    신규 — 비교표
  features/recipe/components/
    RecipeCard.tsx · RecipeDetail.tsx       수정 — 대표 수치·배지·타임라인
    RecipeStepList.tsx                      수정 — 시간 축
    RecipeStepEditor.tsx                    수정 — 스텝 행 열 고정
    RecipeForm.tsx · GrindSettingField.tsx  수정 — 전폭·단위
  features/brewlog/components/BrewLogFields.tsx  수정 — 전폭·단위
  features/gear/components/GrindConverter.tsx   수정 — 전폭
  components/                                수정 — 빈 상태 버튼
  app/page.tsx · app/brews/page.tsx · app/recipes/page.tsx  수정 — 빈 상태
frontend/e2e/
  structure.spec.ts                          신규 — AC 17개
  stubs.ts                                   수정 — 레시피 404·빈 목록 시나리오
```

---

## Task 1: 영어 상태값을 없앤다

**Files:**
- Create: `src/lib/statusLabel.ts` · `statusLabel.test.ts`
- Modify: `src/features/brewlog/components/ExtractionSummary.tsx`
- Modify: `src/features/recipe/components/RecipeCard.tsx` · `RecipeDetail.tsx`
- Test: `e2e/structure.spec.ts` (신규)

**Covers:** AC-STRUCT-14, 15, 16

**Interfaces:**
- Consumes: 없음
- Produces: `statusLabel(kind, value): string` — Task 7의 비교표가 쓰지 않지만 화면 전반이 쓴다

> **왜 먼저 하나.** 가장 닫힌 변경이다. 순수 함수 하나와 그것을 부르는 곳 넷이 전부다.

- [x] **Step 1: 실패하는 테스트 작성**

`src/features/brewlog/statusLabel.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { statusLabel } from "./statusLabel";

describe("상태값 한글", () => {
  it("AC-STRUCT-15 · enum 9개 값이 정해진 한글로 변환된다", () => {
    expect(statusLabel("strength", "WEAK")).toBe("옅음");
    expect(statusLabel("strength", "IDEAL")).toBe("적정");
    expect(statusLabel("strength", "STRONG")).toBe("진함");

    expect(statusLabel("extraction", "UNDER")).toBe("부족");
    expect(statusLabel("extraction", "IDEAL")).toBe("적정");
    expect(statusLabel("extraction", "OVER")).toBe("과다");

    expect(statusLabel("degassing", "TOO_FRESH")).toBe("너무 신선함");
    expect(statusLabel("degassing", "IDEAL")).toBe("적정");
    expect(statusLabel("degassing", "PAST_PEAK")).toBe("정점 지남");
  });

  it("모르는 값은 그대로 돌려준다", () => {
    // 백엔드가 enum을 늘렸을 때 화면이 빈칸이 되지 않게 한다.
    expect(statusLabel("strength", "FUTURE_VALUE")).toBe("FUTURE_VALUE");
  });
});
```

- [x] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd frontend && pnpm test -- statusLabel`
Expected: FAIL — `statusLabel` 모듈이 없어 import 오류.

- [x] **Step 3: 최소 구현**

```ts
/** 백엔드 enum을 화면 문구로 바꾼다. enum 자체는 바꾸지 않는다. */
const LABELS: Record<string, Record<string, string>> = {
  strength: { WEAK: "옅음", IDEAL: "적정", STRONG: "진함" },
  extraction: { UNDER: "부족", IDEAL: "적정", OVER: "과다" },
  degassing: {
    TOO_FRESH: "너무 신선함",
    IDEAL: "적정",
    PAST_PEAK: "정점 지남",
  },
  source: { CURATED: "기본 제공" },
};

export type StatusKind = keyof typeof LABELS;

/** 모르는 값은 그대로 돌려준다 — 백엔드가 enum을 늘려도 화면이 비지 않는다. */
export function statusLabel(kind: StatusKind, value: string): string {
  return LABELS[kind]?.[value] ?? value;
}
```

`ExtractionSummary.tsx`의 `{log.strengthZone}` → `{statusLabel("strength", log.strengthZone)}`,
`{log.extractionZone}` → `{statusLabel("extraction", log.extractionZone)}`.
`RecipeCard.tsx`·`RecipeDetail.tsx`의 `CURATED` 배지 텍스트 → `{statusLabel("source", "CURATED")}`.

- [x] **Step 4: 테스트 실행 — 통과 확인**

Run: `pnpm test -- statusLabel`
Expected: PASS, 2 tests.

`e2e/structure.spec.ts`를 만들어 `AC-STRUCT-14`·`16`을 추가하고 `pnpm e2e structure`로 확인한다.

```ts
test("AC-STRUCT-14 · 화면에 영어 상태값이 하나도 없다", async ({ page }) => {
  await installStubs(page);
  for (const path of ["/brews/2", "/recipes"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const text = await page.locator("body").innerText();
    for (const word of ["IDEAL", "UNDER", "OVER", "WEAK", "STRONG", "TOO_FRESH", "PAST_PEAK", "CURATED"]) {
      expect(text, `${path}에 ${word}`).not.toContain(word);
    }
  }
});
```

- [x] **Step 5: 커밋**

```bash
git add . && git commit -m "feat(web): 영어 상태값을 한글로 바꾼다 (AC-STRUCT 3개)"
```

---


> **★ `features/`가 아니라 `lib/`에 둔다(2026-09-15 수정).** 처음에 `features/brewlog/`에 만들었더니
> `recipe`의 컴포넌트가 그것을 import하게 됐다. `frontend/CLAUDE.md`가 **「`features/` 끼리는 서로
> import 하지 않는다」**고 못박고 있다.
>
> **★ 예고하지 못한 AC가 하나 깨졌다 — `AC-WEB-20`.** 「`CURATED`가 화면에 있다」로 문자열을
> 직접 검사하고 있었다. 배지가 붙는다는 조건 자체는 그대로이므로 검사 문자열만 「기본 제공」으로
> 갱신하고 이유를 그 AC 자리에 남겼다.

## Task 2: 대표 수치를 `1:비율`로 통일한다

**Files:**
- Modify: `src/features/recipe/components/RecipeCard.tsx` · `RecipeDetail.tsx`
- Modify: `e2e/structure.spec.ts`
- Modify: `docs/specs/2026-09-07-visual-hierarchy.md`(`AC-VISUAL-08`) ·
  `docs/specs/2026-09-08-screen-consistency.md`(`AC-CONSIST-08`)

**Covers:** AC-STRUCT-17, 18

**Interfaces:**
- Consumes: `RecipeSummary.ratio`(필수 필드)
- Produces: 없음

> **`AC-STRUCT-18`은 이미 통과할 가능성이 높다.** 기록 쪽은 이미 `1:15.0`이다. **그대로 두면
> 「검사가 비어 있는 것」과 구분되지 않으므로 돌연변이로 확인한다** — 기록 대표 수치를
> `30.0g → 500.0g` 형태로 잠시 바꿔 빨개지는지 본다.

- [x] **Step 1: 실패하는 테스트 작성**

```ts
test("AC-STRUCT-17 · 레시피 대표 수치가 1:비율이다", async ({ page }) => {
  await installStubs(page);
  for (const path of ["/recipes", "/recipes/12"]) {
    await page.goto(path);
    const lead = page.locator("[data-lead]").first();
    const text = await lead.innerText();
    expect(text, path).toMatch(/^1:\d+\.\d$/);
    expect(text, path).not.toContain("→");
  }
});
```

`RecipeCard`·`RecipeDetail`·`BrewLogCard`·`BrewDetail`의 대표 수치 요소에 `data-lead` 속성을
붙인다 — 36px 클래스로 찾으면 스타일이 바뀔 때마다 셀렉터가 깨진다.

- [x] **Step 2: 테스트 실행 — 실패 확인**

Expected: FAIL — `30.0g → 500.0g`이 나온다.

- [x] **Step 3: 최소 구현**

대표 수치를 `1:{ratio}` 형태로 바꾸고, 기존 `도즈 → 물`은 바로 아래 메타줄로 옮긴다.
**메타줄에 이미 있으면 중복을 만들지 않는다**(`AC-CONSIST-11`의 정신).

- [x] **Step 4: 테스트 실행 — 통과 확인**

Run: `pnpm e2e structure && pnpm test && pnpm e2e`
Expected: `AC-VISUAL-08`·`AC-CONSIST-08`이 빨개진다. **예정된 갱신이다** — 다음 스텝에서 고친다.

- [x] **Step 5: 기존 AC 2건을 갱신하고 커밋**

| AC | 고칠 값 | 남길 이유 |
|---|---|---|
| `AC-VISUAL-08` | 레시피 카드 대표 수치를 **비율**로 | 2026-09-15 `structure`가 두 화면의 표현을 통일했다 |
| `AC-CONSIST-08` | `30.0g → 500.0g` → `1:16.7` | 〃 |

```bash
git add . && git commit -m "feat(web): 대표 수치를 1:비율로 통일한다 (AC-STRUCT 2개)"
```

---


> **★ 파급이 계획보다 컸다(2026-09-15).** 대표 수치 하나를 바꿨을 뿐인데 **기존 AC 7건**이
> 깨졌다. 계획이 예고한 것은 `AC-VISUAL-08`·`AC-CONSIST-08` 둘뿐이었다.
>
> | AC | 왜 깨졌나 |
> |---|---|
> | `AC-CONSIST-05` | 메타줄 라벨 목록이 `[비율·물 온도·총 시간]` → `[원두량·물량·물 온도·총 시간]` |
> | `AC-CONSIST-06` | 라벨 순서가 바뀜(어휘는 동일) |
> | `AC-CONSIST-04` · `14` | e2e가 `1:16.7`을 앵커로 메타줄을 찾고 있었다 |
> | `AC-READ-08` | `text-sm` 20 → 21 (메타줄에 `dt`가 하나 늘었다) |
> | `AC-VISUAL-16` · `17` | e2e가 `30.0g`·`1:16.7`을 텍스트로 찾고 있었다 |
>
> **교훈: 대표 수치를 텍스트로 찾는 셀렉터가 e2e 곳곳에 있었다.** 전부 `[data-lead]`로 바꿨다 —
> 앞으로 표현이 바뀌어도 깨지지 않는다.

## Task 3: 폼의 오른쪽 끝을 하나로 맞춘다

**Files:**
- Modify: `src/features/recipe/components/RecipeForm.tsx` · `GrindSettingField.tsx`
- Modify: `src/features/brewlog/components/BrewLogFields.tsx` · `BrewLogForm.tsx`
- Modify: `src/features/gear/components/GrindConverter.tsx`
- Modify: `e2e/structure.spec.ts`

**Covers:** AC-STRUCT-01, 06

**Interfaces:**
- Consumes: 없음
- Produces: 전폭 입력 패턴. Task 4가 그 위에 컨트롤 모양을 얹는다

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
const FORMS = ["/recipes/new", "/recipes/12/edit", "/brews/new?recipeId=12", "/gear/grind-converter"];

for (const path of FORMS) {
  test(`AC-STRUCT-01 · ${path}의 일반 필드가 right 1종류다`, async ({ page }) => {
    await installStubs(page);
    await page.goto(path);
    await page.waitForLoadState("networkidle");

    const rights = await page.evaluate(() => {
      const out = new Set<number>();
      for (const el of document.querySelectorAll("input, select, textarea")) {
        // 스텝 행은 예외다 — 한 줄에 여러 컨트롤이 들어간다.
        if (el.closest("[data-step-row]")) continue;
        if (el.getAttribute("type") === "checkbox") continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0) continue;
        out.add(Math.round(r.right));
      }
      return [...out];
    });

    expect(rights).toEqual([344]);
  });
}
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Expected: FAIL — 종류 수가 `10 · 13 · 4 · 2`다(2026-09-15 실측).

- [ ] **Step 3: 최소 구현**

모든 일반 필드에 `w-full`을 준다. 고정 폭(`w-20`·`w-24`·`w-28`·`w-32`·`w-12`) **12곳**을 없앤다.
단위는 입력을 `relative` 컨테이너로 감싸고 `absolute right-3`로 칸 안에 넣는다. 입력에는
`pr-10`을 주어 글자가 단위와 겹치지 않게 한다.

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `pnpm e2e structure && pnpm e2e`
Expected: PASS. `AC-TOUCH-12`(가로 스크롤)와 `AC-READ-17`이 계속 초록인지 함께 본다.

- [ ] **Step 5: 커밋**

```bash
git add . && git commit -m "feat(web): 폼의 오른쪽 끝을 하나로 맞춘다 (AC-STRUCT 2개)"
```

---

## Task 4: 컨트롤에서 OS 기본 모양을 벗긴다

**Files:**
- Modify: `select`를 쓰는 컴포넌트 전부 · 「내 레시피만」 체크박스
- Modify: `src/test/designTokens.test.ts` · `e2e/structure.spec.ts`

**Covers:** AC-STRUCT-02, 03, 04

**Interfaces:**
- Consumes: Task 3의 전폭 패턴
- Produces: 없음

> **터치 타깃을 잃기 쉬운 태스크다.** `AC-TOUCH-01`·`06`·`09`가 이 변경을 감시한다.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// designTokens.test.ts
it("AC-STRUCT-02 · select 13곳이 appearance-none이다", () => {
  const bare: string[] = [];
  for (const path of APP_SOURCES) {
    for (const m of readFileSync(path, "utf8").matchAll(/<select\s+[^>]*className="([^"]*)"/g)) {
      if (!/\bappearance-none\b/.test(m[1])) bare.push(`${path}: ${m[1]}`);
    }
  }
  expect(bare).toEqual([]);
});
```

```ts
// structure.spec.ts
test("AC-STRUCT-04 · 체크박스가 20×20에 탭 44×44다", async ({ page }) => {
  await installStubs(page);
  await page.goto("/recipes");

  const box = await page.locator('input[type="checkbox"]').boundingBox();
  const tap = await page.locator('label:has(input[type="checkbox"])').boundingBox();

  expect(box).toMatchObject({ width: 20, height: 20 });
  expect(tap!.width).toBeGreaterThanOrEqual(44);
  expect(tap!.height).toBeGreaterThanOrEqual(44);
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Expected: FAIL — `appearance-none`이 0곳이고, 체크박스가 44×44(네이티브가 규약 때문에 커진 상태)다.

- [ ] **Step 3: 최소 구현**

`select`: `appearance-none min-h-11 w-full rounded-md border border-line bg-background pr-9` +
배경 이미지나 `absolute` 아이콘으로 화살표를 그린다.
체크박스: `appearance-none h-5 w-5 rounded-md border border-line checked:bg-brand` +
감싸는 `label`에 `min-h-11 min-w-11 flex items-center gap-2`.

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `pnpm test && pnpm e2e`
Expected: PASS. **`AC-TOUCH-06`이 44×44를 기대하는데 입력 자체는 20×20이 된다** — 그 AC의
대상을 감싼 `label`로 옮기고 갱신 이유를 남긴다. **승인된 AC 변경이므로 사람에게 먼저 보고한다.**

- [ ] **Step 5: 커밋**

```bash
git add . && git commit -m "feat(web): 컨트롤에서 OS 기본 모양을 벗긴다 (AC-STRUCT 3개)"
```

---

## Task 5: 스텝 행의 열을 고정한다

**Files:**
- Modify: `src/features/recipe/components/RecipeStepEditor.tsx`
- Modify: `e2e/structure.spec.ts`

**Covers:** AC-STRUCT-05

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
test("AC-STRUCT-05 · 스텝 행의 열 위치가 행마다 같다", async ({ page }) => {
  await installStubs(page);
  await page.goto("/recipes/12/edit");
  await page.waitForLoadState("networkidle");

  const cols = await page.evaluate(() => {
    const types: number[] = [];
    const firstNums: number[] = [];
    for (const row of document.querySelectorAll("[data-step-row]")) {
      const sel = row.querySelector("select");
      const num = row.querySelector("input");
      if (sel) types.push(Math.round(sel.getBoundingClientRect().left));
      if (num) firstNums.push(Math.round(num.getBoundingClientRect().left));
    }
    return { types: [...new Set(types)], firstNums: [...new Set(firstNums)] };
  });

  expect(cols.types).toHaveLength(1);
  expect(cols.firstNums).toHaveLength(1);
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Expected: 스텝 행에 `data-step-row`가 없어 배열이 비고 `toHaveLength(1)`이 깨진다.

- [ ] **Step 3: 최소 구현**

스텝 행 컨테이너에 `data-step-row`를 붙이고, 열 폭을 `grid-cols-[4rem_5rem_5rem_1fr]`처럼
고정한다.

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `pnpm e2e structure`
Expected: PASS. **Task 3의 `AC-STRUCT-01`이 `data-step-row`로 스텝 행을 제외하므로 함께 초록인지
확인한다.**

- [ ] **Step 5: 커밋**

```bash
git add . && git commit -m "feat(web): 스텝 행의 열을 고정한다 (AC-STRUCT 1개)"
```

---

## Task 6: 푸어 스텝을 시간 축으로 그린다

**Files:**
- Modify: `src/features/recipe/components/RecipeStepList.tsx`
- Modify: `e2e/structure.spec.ts`

**Covers:** AC-STRUCT-07, 08, 09

**Interfaces:**
- Consumes: `RecipeStep[]`
- Produces: `[data-timeline-axis]` 마커

> **이 스펙의 기억될 화면이다.** 대담함을 여기 한 곳에만 쓴다 — 나머지는 조용히 둔다.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
test("AC-STRUCT-07 · 읽기 2곳의 스텝에 시간 축이 있다", async ({ page }) => {
  await installStubs(page);
  for (const path of ["/recipes/12", "/brews/2"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("[data-timeline-axis]"), path).toHaveCount(1);
  }
});

test("AC-STRUCT-09 · 편집 화면에는 타임라인이 없다", async ({ page }) => {
  await installStubs(page);
  await page.goto("/recipes/12/edit");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("[data-timeline-axis]")).toHaveCount(0);
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Expected: FAIL — `AC-STRUCT-07`이 0개를 찾는다. **`AC-STRUCT-09`는 처음부터 통과한다**(타임라인이
아직 없으니 당연하다). Step 4에서 돌연변이로 확인한다.

- [ ] **Step 3: 최소 구현**

`RecipeStepList`에 시간 열(고정 폭)과 세로선을 넣는다. 세로선은 `border-l border-line`을 쓴
컨테이너 하나이고 거기에 `data-timeline-axis`를 붙인다. **`RecipeStepEditor`는 이 컴포넌트를
쓰지 않으므로 편집 화면은 자동으로 제외된다.**

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `pnpm e2e structure`
Expected: PASS 3개.

**`AC-STRUCT-09`를 돌연변이로 확인한다** — `RecipeStepEditor`에 `data-timeline-axis`를 잠시
붙여 빨개지는지 보고 되돌린다.

- [ ] **Step 5: 커밋**

```bash
git add . && git commit -m "feat(web): 푸어 스텝을 시간 축으로 그린다 (AC-STRUCT 3개)"
```

---

## Task 7: 기록이 「레시피대로 내렸나」를 말하게 한다

**Files:**
- Create: `src/features/brewlog/components/RecipeComparison.tsx`
- Modify: `src/features/brewlog/components/BrewDetail.tsx`
- Modify: `src/features/brewlog/useEntityLabels.ts` — 레시피 수치를 함께 내보낸다
- Modify: `e2e/stubs.ts` — 레시피 404 시나리오
- Modify: `e2e/structure.spec.ts`

**Covers:** AC-STRUCT-10, 11, 12, 13

**Interfaces:**
- Consumes: `useRecipeLabel`이 이미 받아오는 `recipe.data`
- Produces: `[data-compare]` · 행마다 `data-diff="true|false"`

> **새 API 요청을 만들지 않는다.** `useRecipeLabel`이 `fetchRecipe`로 레시피 전체를 받아오면서
> `title`과 `steps`만 꺼내 쓰고 있다. `steps`를 더한 것과 같은 방식으로 수치를 더 내보낸다
> (`docs/JOURNAL.md` 2026-09-03의 선례).

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
test("AC-STRUCT-10 · 기록 상세에 비교표 4행이 있다", async ({ page }) => {
  await installStubs(page);
  await page.goto("/brews/2");
  await page.waitForLoadState("networkidle");

  const labels = await page.locator("[data-compare] [data-compare-label]").allInnerTexts();
  expect(labels).toEqual(["원두량", "물량", "물 온도", "추출 시간"]);
});

test("AC-STRUCT-11 · 값이 다를 때만 드러난다", async ({ page }) => {
  // 픽스처를 실제로 읽고 정한 기대값이다(2026-09-15 대조).
  //   레시피 hoffmann : dose 30.0 / water 500.0 / temp 100.0 / time 210
  //   기록   brewLog  : dose 20.0 / water 300.0 / temp  92.0 / time 210
  // 앞의 셋이 다르고 시간만 같다.
  await installStubs(page);
  await page.goto("/brews/2");

  const diffs = await page.locator("[data-compare] [data-diff]").evaluateAll(
    (els) => els.map((el) => el.getAttribute("data-diff")),
  );

  expect(diffs).toEqual(["true", "true", "true", "false"]);
});

test("AC-STRUCT-13 · 레시피를 못 읽으면 실측값만 보여준다", async ({ page }) => {
  await installStubs(page, { recipeStatus: 404 });
  await page.goto("/brews/2");
  await page.waitForLoadState("networkidle");

  await expect(page.locator("[data-compare]")).toHaveCount(0);
  await expect(page.getByText("20.0g")).toBeVisible();
});
```

> **★ 기대값을 픽스처에서 떴다.** 계획을 쓰며 처음 적은 `["false","false","true","false"]`는
> 틀렸다 — 실제로 대조하니 **원두량·물량·물 온도 셋이 다르고 추출 시간만 같다.**
> 픽스처의 기록은 레시피(30g/500g/100°C)와 아예 다른 배치(20g/300g/92°C)라,
> **비교표가 「셋이 달랐다」를 보여주게 되어 데모로도 알맞다.**

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Expected: FAIL — `[data-compare]`가 0개.

- [ ] **Step 3: 최소 구현**

`useRecipeLabel`의 반환에 `doseG`·`waterG`·`waterTempC`·`totalTimeSeconds`를 더한다.
`RecipeComparison`이 네 행을 그리고, 각 행의 실제 값 요소에 `data-diff`를 붙인다.
**`isReady`가 아니면 아무것도 그리지 않는다** — `AC-STRUCT-13`이 그것을 검사한다.

`stubs.ts`에 `recipeStatus` 옵션을 추가해 레시피 요청에 404를 돌려줄 수 있게 한다.

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `pnpm e2e structure && pnpm test && pnpm e2e`
Expected: PASS 4개.

- [ ] **Step 5: 커밋**

```bash
git add . && git commit -m "feat(web): 기록이 레시피대로 내렸는지 말한다 (AC-STRUCT 4개)"
```

---

## Task 8: 빈 화면이 다음 행동을 제안한다

**Files:**
- Modify: `src/app/page.tsx` · `src/app/brews/page.tsx` · `src/app/recipes/page.tsx`
- Modify: `e2e/stubs.ts` — 빈 목록 시나리오
- Modify: `e2e/structure.spec.ts`
- Modify: `docs/specs/2026-09-09-spacing-system.md`(`AC-SPACE-11`)

**Covers:** AC-STRUCT-19, 20

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
test("AC-STRUCT-19 · 빈 기록 화면이 레시피로 보낸다", async ({ page }) => {
  await installStubs(page, { emptyBrewLogs: true });
  for (const path of ["/", "/brews"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");

    const link = page.locator('[data-empty] a[href="/recipes"]');
    await expect(link, path).toHaveCount(1);

    const box = await link.boundingBox();
    expect(box!.height, path).toBeGreaterThanOrEqual(44);
  }
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Expected: FAIL — 링크가 0개. 지금은 「아직 기록이 없습니다」 문구뿐이다.

- [ ] **Step 3: 최소 구현**

빈 상태 영역에 `data-empty`를 붙이고 `Link`를 넣는다. 문구는 **행동으로** 쓴다 —
「레시피 고르기」·「새 레시피」(브랜드 문서 「버튼은 행동으로」).

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `pnpm e2e && pnpm test`
Expected: `AC-SPACE-11`(빈 상태 여백 48px)이 빨개질 수 있다. 버튼이 들어가며 높이가 달라지는
것이므로 **예정된 갱신이다.**

- [ ] **Step 5: `AC-SPACE-11`을 갱신하고 커밋**

```bash
git add . && git commit -m "feat(web): 빈 화면이 다음 행동을 제안한다 (AC-STRUCT 2개)"
```

---

## 완료 기준

- [ ] `cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build` 통과
- [ ] `cd frontend && pnpm e2e` 통과
- [ ] `cd frontend && pnpm test:worker` 통과
- [ ] `./scripts/check-spec-coverage.sh` 통과 — 합계가 **780**(760 + 20)
- [ ] 스펙의 `status`를 `구현완료`로 변경
- [ ] 스펙 「수동 확인」 3개 — 폰 실물이 필요해 **비차단형**

---

## 자체 검토 결과

**AC 커버리지:** 스펙의 AC 20개 중 20개가 태스크에 매핑됨

**자리표시자 검사:** `TODO`, `TBD`, "나중에", "비슷하게" 없음

**타입 일관성:** Task 1의 `statusLabel(kind, value)`를 Task 7이 쓰지 않는다(비교표는 수치만
다룬다). Task 3이 붙이는 `data-step-row`를 Task 5가 같은 이름으로 쓴다. Task 2가 붙이는
`data-lead`를 `AC-STRUCT-17`·`18`이 함께 쓴다.

**계획 단계에서 확인한 것**

- **폼 4개의 현재 `right` 종류는 `10 · 13 · 4 · 2`다**(2026-09-15 실측). 환산기는 3개 컨트롤에
  2종류로, 처음 스크린샷을 보고 「세 줄의 끝이 전부 다르다」고 한 것은 과장이었다.
- **`useRecipeLabel`이 `fetchRecipe`로 레시피 전체를 받아온다.** `title`과 `steps`만 꺼내 쓰고
  있어 **비교표에 새 요청이 필요 없다.**
- **`brew_logs`에 레시피 스냅샷 컬럼은 없다.** `actual_*`가 그 역할을 한다. 따라서 비교 대상은
  「지금의 레시피」이고, 그 한계를 `AC-STRUCT-12`가 문구로 드러낸다.
- **enum 값은 9개다** — `WEAK·IDEAL·STRONG` / `UNDER·IDEAL·OVER` / `TOO_FRESH·IDEAL·PAST_PEAK`.
- **★ `AC-STRUCT-11`의 기대 배열을 픽스처에서 떴고, 처음 적은 값이 틀렸다.** 레시피는
  30g/500g/100°C인데 기록은 20g/300g/92°C다. **셋이 다르고 시간만 같다.**

**검증되지 않은 가정:**

- **`select` 화살표를 어떻게 그릴지 정하지 않았다.** 배경 SVG(data URI)와 `absolute` 아이콘 중
  어느 쪽이든 `AC-STRUCT-02`·`03`을 만족하면 된다. **임의값 색이 들어가면 `AC-VISUAL-04`가
  빨개지므로 `currentColor`를 쓴다.**
- **`AC-TOUCH-06`(체크박스 44×44)이 Task 4에서 깨진다.** 입력 자체가 20×20이 되기 때문이다.
  **승인된 AC라 임의로 고치지 않고 사람에게 먼저 보고한다.**
- **`AC-STRUCT-01`이 Task 3에서 통과해도 Task 4가 깨뜨릴 수 있다.** `select`에 테두리와
  패딩이 붙으면 폭이 달라진다. Task 4 Step 4에서 `AC-STRUCT-01`을 다시 돌린다.
