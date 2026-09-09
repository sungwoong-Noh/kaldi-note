# 간격·모서리 체계 구현 계획

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.

**Spec:** `docs/specs/2026-09-09-spacing-system.md`

**Goal:** 간격이 6단계, 모서리가 역할 2종으로 잠기고, 그림자 0곳이 규칙이 된다. 색·글자 크기·터치
타깃에 이어 **마지막 축**이 닫힌다.

**Architecture:** `visual-hierarchy`가 색에 쓴 **두 겹 그물**을 그대로 쓴다 — 소스 정규식 허용목록이
「금지된 것이 없다」를 잠그고, e2e의 `getComputedStyle`이 「의도한 값이 실제로 그려진다」를 잰다.
소스만 보면 부모가 덮는 경우를 놓치고, e2e만 보면 안 밟는 화면을 놓친다.

**작업 위치:** `frontend/`

**반드시 먼저 읽을 것:** `CLAUDE.md`(루트) → `frontend/CLAUDE.md` → `docs/conventions/frontend.md` → `docs/conventions/git.md`

---

## AC 커버리지 매핑

| AC ID | 요약 | 담당 태스크 | 검증 방식 |
|---|---|---|---|
| AC-SPACE-01 | 간격이 6단계 밖을 안 쓴다 | Task 2 | 소스 검사 |
| AC-SPACE-02 | 6단계가 각각 쓰인다 | Task 2 | 소스 검사 |
| AC-SPACE-03 | 임의값·음수 마진 0곳 | Task 1 | 소스 검사 |
| AC-SPACE-04 | `rounded`(4px) 0곳 | Task 3 | 소스 검사 |
| AC-SPACE-05 | 면 7곳이 `rounded-lg` | Task 3 | 소스 검사 |
| AC-SPACE-06 | `rounded-lg`가 면에만 | Task 3 | 소스 검사 |
| AC-SPACE-07 | `rounded-full` 정확히 2곳 | Task 3 | 소스 검사 |
| AC-SPACE-08 | `shadow-*` 0곳 | Task 1 | 소스 검사 |
| AC-SPACE-09 | 카드 padding 16px · radius 8px | Task 4 | e2e |
| AC-SPACE-10 | 버튼 radius 6px | Task 4 | e2e |
| AC-SPACE-11 | 빈 상태 세로 여백 48px | Task 4 | e2e |

**11개 전부 매핑됐다.** 스펙과 대조해 확인했다.

---

## Global Constraints

- **백엔드를 건드리지 않는다.** `backend/` 아래 수정 0건.
- **앞선 세 스펙을 깨지 않는다.** 아래 검사가 전부 그대로 초록이어야 한다.
  - `visual-hierarchy` — `designTokens.test.ts` · `contrast.test.ts` · `headings.test.ts` · `e2e/visual.spec.ts`
  - `screen-consistency` — `consistency.test.ts` · `e2e/consistency.spec.ts` (**`gap-x-3`은 새 스케일 안이라 안 바뀐다**)
  - `touch-targets` — `touchTarget.test.ts` · `e2e/touch-targets.spec.ts`
- **★ `py-1.5` → `py-2`가 버튼 높이를 바꾸지 않는다.** 버튼에는 `min-h-11`이 붙어 있어 44px가
  하한이다. 그래도 **`e2e/touch-targets.spec.ts`를 매 태스크마다 돌려 확인한다.**
- **폭·높이를 건드리지 않는다.** `min-h-11`·`min-w-11`·`size-11`(115곳)과 `w-*`·`max-w-*`는 범위 밖이다.
- **테스트 파일 판정은 파일명의 `.test.`로 한다.** **경로에 `test`가 있는지로 거르면
  `src/app/login/test/page.tsx`가 빠진다** — 그것은 실제 앱 코드다. 인터뷰에서 실제로 물렸다.

---

## File Structure

```
frontend/
├── src/
│   ├── test/
│   │   └── spacing.test.ts        ← 새로 만듦 (Task 1~3이 차례로 채운다)
│   ├── app/
│   │   ├── page.tsx               py-8 · py-2.5
│   │   ├── brews/page.tsx         py-2.5
│   │   ├── recipes/page.tsx       py-2.5 · py-1.5
│   │   ├── more/page.tsx          pb-5 · py-2.5 · rounded-lg(컨트롤)
│   │   ├── offline/page.tsx       rounded-lg(컨트롤)
│   │   └── login/page.tsx         gap-8
│   │   └── login/test/page.tsx    gap-5 · rounded-lg ×2(컨트롤)
│   ├── components/ErrorState.tsx  py-1.5
│   └── features/
│       ├── brewlog/components/
│       │   ├── BeanBatchDialog.tsx      p-5 · py-1.5×2 · rounded×5
│       │   ├── BrewDetail.tsx           py-1.5×2
│       │   ├── BrewLogEditor.tsx        gap-5 · rounded×1
│       │   ├── BrewLogFields.tsx        py-1.5×2 · rounded×5
│       │   ├── BrewLogForm.tsx          py-1.5 · gap-5 · rounded×1
│       │   ├── DeleteBrewLogDialog.tsx  p-5 · py-1.5×2
│       │   └── UserGrinderDialog.tsx    p-5 · py-1.5×2 · rounded×2
│       ├── recipe/components/
│       │   ├── DeleteRecipeDialog.tsx   p-5 · py-1.5×2
│       │   ├── GrindSettingField.tsx    rounded×3
│       │   ├── RecipeCard.tsx           px-1.5 · py-0.5 · rounded×1
│       │   ├── RecipeDetail.tsx         px-1.5 · py-0.5 · mt-5 · rounded×1
│       │   ├── RecipeForm.tsx           rounded×4
│       │   ├── RecipeStepEditor.tsx     rounded×6
│       │   └── RecipeStepList.tsx       pt-0.5 · mt-0.5
│       ├── gear/components/GrindConverter.tsx  py-0.5 · rounded×3
│       └── user/components/UserProfile.tsx     gap-5 · rounded-lg(컨트롤)
└── e2e/
    └── spacing.spec.ts            ← 새로 만듦 (Task 4)
```

**간격 38곳 · 20파일 / 모서리 `rounded` 32곳 · 11파일 + `rounded-lg` 컨트롤 5곳.**

---

## Task 1: 그물을 먼저 세운다 — 임의값·음수·그림자

**Files:**
- Create: `frontend/src/test/spacing.test.ts`

**Covers:** AC-SPACE-03, AC-SPACE-08

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces: `SOURCES` 목록과 `offenders(pattern)` 헬퍼 — Task 2·3이 이어서 쓴다

> **★ 이 태스크는 첫 실행에 통과한다.** 임의값·음수 마진·그림자가 지금 **0곳**이기 때문이다.
> **고칠 것을 찾는 그물이 아니라 「0곳인 상태」를 결정으로 바꾸는 그물이다.**
> 통과했다고 건너뛰면 다음 사람이 `shadow-sm`을 흘려넣는다.

- [x] **Step 1: 실패하는 테스트 작성**

`designTokens.test.ts`의 `walk`·`offenders` 패턴을 그대로 따른다.

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

// 이 파일 자신은 검사 대상이 아니다 — 금지 패턴을 리터럴로 담고 있어
// 넣어두면 무엇을 고치든 자기 자신이 offender로 잡힌다(designTokens.test.ts의 선례).
const SELF = join("src", "test", "spacing.test.ts");

/**
 * **파일명의 `.test.`로만 거른다.** 경로에 `test`가 있는지로 거르면
 * `src/app/login/test/page.tsx`가 빠지는데 그것은 실제 앱 코드다.
 */
export const SOURCES = walk("src").filter(
  (path) =>
    /\.(ts|tsx)$/.test(path) && !/\.test\.[jt]sx?$/.test(path) && path !== SELF,
);

export function offenders(pattern: RegExp): string[] {
  return SOURCES.filter((path) => pattern.test(readFileSync(path, "utf8")));
}

describe("간격·모서리 허용목록", () => {
  it("AC-SPACE-03 · 임의값 간격과 음수 마진이 없다", () => {
    const arbitrary = /\b(?:gap|gap-x|gap-y|[pm][xytblr]?)-\[/;
    const negative = /(?:^|[\s"'`])-m[xytblr]?-\d/;

    expect(offenders(arbitrary)).toEqual([]);
    expect(offenders(negative)).toEqual([]);
  });

  it("AC-SPACE-08 · shadow 클래스가 없다", () => {
    expect(offenders(/\bshadow(?:-[a-z0-9]+)?\b/)).toEqual([]);
  });
});
```

- [x] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm test src/test/spacing.test.ts`

Expected: **PASS 2개다.** 세 패턴 다 지금 0곳이라 통과하는 것이 정상이다.
**빨간 것이 나오면 실측이 틀린 것이므로 거기서 멈추고 스펙을 다시 본다.**

- [x] **Step 3: 최소 구현**

**없다.** 지금 상태가 이미 조건을 만족한다.

- [x] **Step 4: 테스트 실행 — 통과 확인**

Run: `pnpm test`
Expected: PASS, 371 + 2 = **373**

- [x] **Step 5: 커밋**

```bash
pnpm format && pnpm typecheck && pnpm lint && pnpm test
cd .. && git add . && git commit -m "test(web): 임의값·음수 마진·그림자 0곳을 규칙으로 잠근다 (AC-SPACE-03·08)"
```

> **`pnpm format`이 `pnpm-lock.yaml`까지 포맷한다.** `git add` 전에 `git status`로 확인한다.

---

## Task 2: 간격을 6단계로 흡수한다

**Files:**
- Modify: 위 File Structure의 **간격 20개 파일**
- Test: `frontend/src/test/spacing.test.ts`

**Covers:** AC-SPACE-01, AC-SPACE-02

**Interfaces:**
- Consumes: Task 1의 `SOURCES`·`offenders`
- Produces: 잠긴 스케일 `{1, 2, 3, 4, 6, 12}` — Task 3·4가 이것을 전제한다

**흡수 표 — 38곳**

| 없앨 값 | → | 횟수 | 주된 자리 |
|---|---|---|---|
| `py-0.5`·`pt-0.5`·`mt-0.5` | `1` | 5 | CURATED 배지 · 스텝 목록 |
| `py-1.5`·`px-1.5` | `2` | 17 | 버튼 패딩 · 배지 |
| `py-2.5` | `3` | 4 | 「더 보기」 버튼 |
| `p-5`·`pb-5`·`gap-5`·`mt-5` | `4` | 10 | 다이얼로그 안쪽 · 폼 세로 간격 |
| `py-8`·`gap-8` | `6` | 2 | 홈 여백 · 로그인 화면 |

- [x] **Step 1: 실패하는 테스트 작성**

```ts
const SCALE = [1, 2, 3, 4, 6, 12] as const;

/** 소스에서 간격 유틸리티의 숫자만 뽑는다. */
function spacingValues(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const path of SOURCES) {
    const source = readFileSync(path, "utf8");
    const values = [
      ...source.matchAll(
        /\b(?:gap|gap-x|gap-y|space-x|space-y|[pm][xytblr]?)-(\d+(?:\.\d+)?)\b/g,
      ),
    ].map((m) => m[1]);
    if (values.length > 0) {
      found.set(path, values);
    }
  }
  return found;
}

describe("AC-SPACE-01 · 간격이 6단계 밖의 값을 쓰지 않는다", () => {
  it("스케일 밖의 값이 없다", () => {
    const allowed = new Set(SCALE.map(String));
    const bad = [...spacingValues()].flatMap(([path, values]) =>
      values.filter((v) => !allowed.has(v)).map((v) => `${path}: ${v}`),
    );

    expect(bad).toEqual([]);
  });
});

describe("AC-SPACE-02 · 6단계가 각각 쓰인다", () => {
  it("죽은 단계가 없다", () => {
    const used = new Set([...spacingValues().values()].flat());
    const dead = SCALE.filter((step) => !used.has(String(step)));

    expect(dead).toEqual([]);
  });
});
```

- [x] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm test src/test/spacing.test.ts`

Expected: FAIL 1개(`AC-SPACE-01`) — **38개 항목**이 목록에 뜬다.
`AC-SPACE-02`는 여섯 단계가 이미 다 쓰이고 있어 통과한다.

- [x] **Step 3: 최소 구현**

흡수 표대로 20개 파일을 고친다. **클래스 문자열 치환이라 값이 곧 규칙이다.**

> **★ 배지의 `px-1.5 py-0.5`가 `px-2 py-1`이 되면 배지가 커진다.** CURATED 배지 2곳이다.
> 눈에 띄는 유일한 변화이므로 **폰 실물 확인 항목에 이미 들어 있다.**
> **`p-5`(다이얼로그 안쪽) → `p-4`도 다이얼로그가 살짝 좁아진다.**

- [x] **Step 4: 테스트 실행 — 통과 확인**

Run: `pnpm test`
Expected: PASS, **373** (테스트 개수는 늘지 않는다 — `it` 2개를 더했으므로 **375**)

```bash
pnpm typecheck && pnpm lint
pkill -f "next start" || true
pnpm e2e e2e/touch-targets.spec.ts e2e/consistency.spec.ts e2e/visual.spec.ts
```
Expected: PASS — **`py-1.5`→`py-2`가 버튼 높이를 바꾸지 않았음을 여기서 확인한다.**

- [x] **Step 5: 커밋**

```bash
pnpm format && pnpm typecheck && pnpm lint && pnpm test
cd .. && git add . && git commit -m "feat(web): 간격을 6단계로 흡수한다 (AC-SPACE-01·02)"
```

---

## Task 3: 모서리를 역할 2종으로 옮긴다

**Files:**
- Modify: `rounded`(4px)가 있는 **11개 파일**
- Modify: `rounded-lg`를 쓰는 **컨트롤 5곳** — `more/page.tsx` · `offline/page.tsx` · `UserProfile.tsx` · `login/test/page.tsx`(2곳)
- Test: `frontend/src/test/spacing.test.ts`

**Covers:** AC-SPACE-04, AC-SPACE-05, AC-SPACE-06, AC-SPACE-07

**Interfaces:**
- Consumes: Task 1의 `offenders`
- Produces: 없음

**면 7곳 — 여기만 `rounded-lg`가 남는다**

```
RecipeCard.tsx · BrewLogCard.tsx                         목록 카드 2
BeanBatchDialog.tsx · UserGrinderDialog.tsx
DeleteRecipeDialog.tsx · DeleteBrewLogDialog.tsx         다이얼로그 4
RecipeStepEditor.tsx                                     스텝 카드 1
```

- [x] **Step 1: 실패하는 테스트 작성**

```ts
const SURFACES = [
  "src/features/recipe/components/RecipeCard.tsx",
  "src/features/brewlog/components/BrewLogCard.tsx",
  "src/features/brewlog/components/BeanBatchDialog.tsx",
  "src/features/brewlog/components/UserGrinderDialog.tsx",
  "src/features/recipe/components/DeleteRecipeDialog.tsx",
  "src/features/brewlog/components/DeleteBrewLogDialog.tsx",
  "src/features/recipe/components/RecipeStepEditor.tsx",
].map((p) => p.split("/").join(sep));

function count(path: string, pattern: RegExp): number {
  return readFileSync(path, "utf8").match(pattern)?.length ?? 0;
}

describe("모서리", () => {
  it("AC-SPACE-04 · rounded(4px)가 없다", () => {
    // 뒤에 값이 붙지 않은 `rounded`만 잡는다. rounded-md·-lg·-full은 제외다.
    expect(offenders(/\brounded(?![-\w])/)).toEqual([]);
  });

  it("AC-SPACE-05 · 면 7곳이 rounded-lg를 쓴다", () => {
    const missing = SURFACES.filter((p) => count(p, /\brounded-lg\b/g) < 1);

    expect(missing).toEqual([]);
  });

  it("AC-SPACE-06 · rounded-lg가 면 밖에 없다", () => {
    const outside = SOURCES.filter(
      (p) => !SURFACES.includes(p) && count(p, /\brounded-lg\b/g) > 0,
    );

    expect(outside).toEqual([]);
  });

  it("AC-SPACE-07 · rounded-full이 아바타와 스피너 2곳뿐이다", () => {
    const found = SOURCES.flatMap((p) =>
      Array(count(p, /\brounded-full\b/g)).fill(p),
    );

    expect(found).toHaveLength(2);
    expect(found.map((p) => p.split(sep).pop()).sort()).toEqual([
      "LoadingState.tsx",
      "UserProfile.tsx",
    ]);
  });
});
```

> **경로 구분자에 주의한다.** `walk`가 `join`으로 만든 경로는 플랫폼 구분자를 쓴다.
> 리터럴을 `/`로 쓰면 비교가 어긋난다 — `node:path`의 `sep`으로 맞춘다.

- [x] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm test src/test/spacing.test.ts`

Expected: FAIL 2개.
- `AC-SPACE-04` — `rounded`가 **11개 파일 32곳**에 있다
- `AC-SPACE-06` — `rounded-lg`가 면 밖 **4개 파일 5곳**에 있다

`AC-SPACE-05`·`07`은 지금도 성립해 통과한다.

- [x] **Step 3: 최소 구현**

- `rounded` → `rounded-md` (32곳, 11파일)
- 컨트롤 5곳의 `rounded-lg` → `rounded-md`

- [x] **Step 4: 테스트 실행 — 통과 확인**

Run: `pnpm test`
Expected: PASS, **379** (375 + 4)

```bash
pkill -f "next start" || true
pnpm e2e
```
Expected: PASS, 119

- [x] **Step 5: 커밋**

```bash
pnpm format && pnpm typecheck && pnpm lint && pnpm test
cd .. && git add . && git commit -m "feat(web): 모서리를 면·컨트롤 두 역할로 옮긴다 (AC-SPACE-04~07)"
```

---

## Task 4: 렌더값을 브라우저로 잰다

**Files:**
- Create: `frontend/e2e/spacing.spec.ts`

**Covers:** AC-SPACE-09, AC-SPACE-10, AC-SPACE-11

**Interfaces:**
- Consumes: Task 2·3의 모든 수정
- Produces: 없음

> **소스 검사는 「금지된 것이 없다」만 본다.** 클래스가 맞아도 부모가 덮으면 화면이 다르다.
> **★ 이 스위트가 첫 실행에 통과하는 것이 정상이다.**

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
import { expect, test } from "@playwright/test";
import { pageOf } from "../src/test/fixtures";
import { installStubs } from "./stubs";

test.describe("간격·모서리 — 렌더값", () => {
  test("AC-SPACE-09 · 카드가 padding 16px · radius 8px다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/recipes");

    const card = page.getByRole("link", { name: /James Hoffmann/ }).first();
    await expect(card).toBeVisible();

    const box = await card.evaluate((el) => {
      const s = getComputedStyle(el);
      return { pad: s.paddingTop, radius: s.borderTopLeftRadius };
    });

    expect(box).toEqual({ pad: "16px", radius: "8px" });
  });

  test("AC-SPACE-10 · 버튼이 radius 6px다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/recipes");

    const button = page.getByRole("link", { name: "새 레시피" });
    await expect(button).toBeVisible();

    expect(
      await button.evaluate((el) => getComputedStyle(el).borderTopLeftRadius),
    ).toBe("6px");
  });

  test("AC-SPACE-11 · 빈 상태의 세로 여백이 48px다", async ({ page }) => {
    await installStubs(page);
    // 기본 스텁은 레시피 둘을 준다. 목록만 빈 페이지로 덮어쓴다.
    // 나중에 등록한 route가 이긴다. 경로를 술어로 정확히 집는다 —
    // 글로브 `recipes?**`는 `?`가 한 글자 와일드카드라 `/recipes/12`까지 잡는다.
    await page.route(
      (url) => url.pathname === "/api/v1/recipes",
      (route) => route.fulfill({ json: pageOf([]) }),
    );
    await page.goto("/recipes");

    const empty = page.getByText("레시피가 없습니다");
    await expect(empty).toBeVisible();

    expect(
      await empty.evaluate((el) => getComputedStyle(el).paddingTop),
    ).toBe("48px");
  });
});
```

> **★ 빈 페이지 응답의 모양을 지어내지 않고 `pageOf([])`를 그대로 쓴다.** 봉투는
> `{content, page, size, totalElements, totalPages, hasNext}`다 — **`last`가 아니라 `hasNext`**다.
> 계획 초고가 `last: true`로 지어냈다가 픽스처를 열어보고 잡았다. 틀리면 스키마 파싱에서 죽고,
> 그때 「빈 상태가 안 뜬다」로 오해하기 쉽다.

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
pkill -f "next start" || true
pnpm e2e e2e/spacing.spec.ts
```
Expected: **Task 2·3을 먼저 했으므로 전부 PASS가 정상이다.** 빨간 것이 나오면 클래스가 맞는데
화면이 다르다는 뜻이므로 **소스 검사가 못 잡는 것을 잡은 것이다** — 그 자리를 고친다.

- [ ] **Step 3: 최소 구현**

**없다.** Step 2가 빨갛다면 그때 그 자리만 고친다.

- [ ] **Step 4: 테스트 실행 — 통과 확인**

```bash
pkill -f "next start" || true
pnpm e2e
```
Expected: PASS, 119 + 3 = **122**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```
Expected: PASS, 379

- [ ] **Step 5: 커밋**

```bash
cd .. && git add . && git commit -m "test(web): 간격·모서리 렌더값을 브라우저로 잰다 (AC-SPACE-09~11)"
```

---

## 완료 기준

- [ ] `cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build` 통과 (**379개**)
- [ ] `cd frontend && pnpm e2e` 통과 (**122개**) — 첫 실행이 느리면 재실행해 PWA 타임아웃과 구분한다
- [ ] `./scripts/check-spec-coverage.sh` 통과 (AC 736 + 11 = **747**)
- [ ] 스펙의 `status`를 `구현완료`로 변경
- [ ] 스펙 「수동 확인」 2개 — **둘 다 비차단형이라 `status`를 막지 않는다.** 폰 실물이 필요하다

---

## 자체 검토 결과

계획을 다 쓴 뒤 스펙과 대조해 확인한 것.

- **AC 11개가 전부 태스크에 매핑됐다.** 커버리지 표로 대조했다.
- **★ 인터뷰 중 집계를 두 번 틀렸고 둘 다 잡았다.** `grep -h`는 파일명을 지우므로
  `grep -v test`가 테스트 파일을 못 거른다. 그리고 **`src/app/login/test/page.tsx`는 경로에
  `/test/`가 들어 있지만 실제 앱 코드다** — 그래서 `rounded-lg` 컨트롤이 3곳이 아니라 **5곳**이고
  모서리 흡수가 35곳이 아니라 **37곳**이다. 계획의 파일 목록은 **파이썬으로 다시 센 값**이다.
- **★ 「0 값이 5곳」도 오독이었다.** 정규식이 `pt-0.5`의 `0`을 잡은 것이고 **진짜 `0`은 0곳**이다.
  덕분에 결정할 것이 하나 줄었다.
- **★ Task 1은 첫 실행에 통과한다.** 임의값·음수·그림자가 이미 0곳이다. **「고칠 것이 없다」가
  아니라 「0곳을 결정으로 바꾼다」가 목적이므로 건너뛰지 않는다.**
- **★ `py-1.5`→`py-2`가 터치 타깃을 깨뜨릴 수 있다.** 버튼에 `min-h-11`이 있어 이론상 안전하지만,
  Task 2의 Step 4에서 `e2e/touch-targets.spec.ts`를 **명시적으로 다시 돌린다.**
- **★ 눈에 보이는 변화는 셋뿐이다** — CURATED 배지가 커지고(`px-1.5 py-0.5`→`px-2 py-1`),
  다이얼로그 안쪽이 좁아지고(`p-5`→`p-4`), 모서리가 4px→6px가 된다. 나머지 35곳은 사실상 안 보인다.
  **색 이관 때처럼 「거의 안 변했다」가 정상이다.**
- **경로 구분자를 리터럴로 쓰지 않는다.** `walk`가 `join`으로 만든 경로와 비교하려면 `sep`이 필요하다.
- **★ 계획 초고가 빈 페이지 봉투를 지어냈다.** `last: true`로 썼는데 실제는 `hasNext`다.
  픽스처를 열어보고 `pageOf([])`를 그대로 쓰도록 고쳤다.
- **★ 글로브 `**/api/v1/recipes?**`는 `/recipes/12`까지 잡는다.** Playwright에서 `?`는 한 글자
  와일드카드다. 경로 술어(`(url) => url.pathname === "/api/v1/recipes"`)로 바꿨다.
- **테스트 개수를 태스크마다 누적으로 적었다** (371 → 373 → 375 → 379). e2e는 119 → 122.
