# 화면 간 일관성 정비 구현 계획

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.

**Spec:** `docs/specs/2026-09-08-screen-consistency.md`

**Goal:** 목록 카드 둘과 상세 화면 둘이 같은 값을 같은 단어·같은 간격·같은 크기로 보여준다.
상세에도 대표 수치가 서고, 브루로그 상세가 `h1`을 갖는다.

**Architecture:** `visual-hierarchy`가 쓴 **두 겹 그물**을 그대로 쓴다 — 소스 검사(`src/test/`)가
「금지된 것이 없다」를 잠그고, e2e의 `getComputedStyle`이 「의도한 값이 실제로 그려진다」를 잰다.
소스 검사만으로는 클래스 이름을 틀렸거나 토큰이 생성되지 않은 경우를 못 잡는다. 라벨 어휘처럼
**문자열이 값인 것**은 컴포넌트 테스트가 담당한다.

**작업 위치:** `frontend/`

**반드시 먼저 읽을 것:** `CLAUDE.md`(루트) → `frontend/CLAUDE.md` → `docs/conventions/frontend.md` → `docs/conventions/git.md`

---

## AC 커버리지 매핑

| AC ID | 요약 | 담당 태스크 | 검증 방식 |
|---|---|---|---|
| AC-CONSIST-01 | `BrewLogCard`에 `·`가 0개 | Task 1 | 소스 검사 |
| AC-CONSIST-02 | `RecipeDetail`에 `·`가 0개 | Task 1 | 소스 검사 |
| AC-CONSIST-03 | 메타줄 4곳이 `gap-x-3` | Task 1 | 소스 검사 |
| AC-CONSIST-04 | 렌더 `column-gap`이 12px | Task 5 | e2e |
| AC-CONSIST-05 | `RecipeDetail` 라벨이 보인다 | Task 2 | 컴포넌트 테스트 |
| AC-CONSIST-06 | 라벨 어휘표 10줄이 그대로 렌더 | Task 2 | 컴포넌트 테스트 |
| AC-CONSIST-07 | 라벨 렌더가 12px · muted | Task 5 | e2e |
| AC-CONSIST-08 | `RecipeDetail` 대표 수치 1개 = `20.0g → 300.0g` | Task 3 | 컴포넌트 테스트 |
| AC-CONSIST-09 | `BrewDetail` 대표 수치 1개 = `1:15.0` | Task 3 | 컴포넌트 테스트 |
| AC-CONSIST-10 | 비율 없으면 `92°C`로 승격 | Task 3 | 컴포넌트 테스트 |
| AC-CONSIST-11 | 대표로 올린 항목이 아래에 없다 | Task 3 | 컴포넌트 테스트 |
| AC-CONSIST-12 | `/brews/{id}`에 `h1`이 1개 | Task 4 | 컴포넌트 테스트 |
| AC-CONSIST-13 | 못 읽을 때도 `h1`이 1개 | Task 4 | 컴포넌트 테스트 |
| AC-CONSIST-14 | 대표 수치 4곳이 `tabular-nums` | Task 5 | e2e |

**14개 전부 매핑됐다.** 스펙과 대조해 확인했다.

---

## Global Constraints

- **백엔드를 건드리지 않는다.** `backend/` 아래 파일 수정 0건이다.
- **`visual-hierarchy`가 잠근 색 8개·크기 5단계를 깨지 않는다.** `designTokens.test.ts`와
  `contrast.test.ts`가 허용목록 밖의 클래스를 잡는다. 이 계획이 새로 쓰는 클래스는
  `gap-x-3`·`tabular-nums`뿐이며 둘 다 색·크기가 아니다.
- **`tabular-nums`는 크기 허용목록의 대상이 아니다.** `font-variant-numeric` 유틸리티라
  `text-*` 검사와 무관하다.
- **픽스처를 새로 짓지 않는다.** `src/test/fixtures.ts`의 값(`doseG: 20.0` · `waterG: 300.0` ·
  `ratio: 15.0` · `waterTempC: 92.0` · `totalTimeSeconds: 210` · `brewRatio: 15.0` ·
  `extractionYieldPercent: 17.6`)을 그대로 쓴다. **지어낸 픽스처는 내 가정을 검증한다.**
- **e2e 경로는 스텁이 아는 것만 쓴다** — `/recipes/12` · `/brews/2`. `e2e/screens.ts`에 있는 값이다.

---

## File Structure

```
frontend/
├── src/
│   ├── test/
│   │   └── consistency.test.ts            ← 새로 만듦 (소스 검사)
│   ├── features/
│   │   ├── recipe/components/
│   │   │   ├── RecipeCard.tsx             ← 라벨 어휘 · tabular-nums
│   │   │   ├── RecipeCard.test.tsx        ← 라벨 단언 추가
│   │   │   └── RecipeDetail.tsx           ← `·` 제거 · 라벨 노출 · 대표 수치
│   │   └── brewlog/components/
│   │       ├── BrewLogCard.tsx            ← `·` 제거 · gap-x-3 · 라벨 어휘 · tabular-nums
│   │       ├── BrewLogCard.test.tsx       ← 라벨 단언 추가
│   │       └── BrewDetail.tsx             ← h1 · 대표 수치 · 라벨 어휘 · gap-x-3
│   └── app/
│       ├── recipes/[id]/page.test.tsx     ← AC-05·06·08
│       └── brews/[id]/page.test.tsx       ← AC-06·09·10·11·12·13
└── e2e/
    └── consistency.spec.ts                ← 새로 만듦 (AC-04·07·14)
```

**갱신하는 기존 파일 둘:**
- `src/test/headings.test.ts` — `toHaveLength(14)` → `(15)`
- `docs/specs/2026-09-07-visual-hierarchy.md` — 「화면 제목 14곳」 조건을 15곳으로, 이유를 그 자리에

---

## Task 1: 구분자를 없애고 메타줄 간격을 잠근다

**Files:**
- Create: `frontend/src/test/consistency.test.ts`
- Modify: `frontend/src/features/brewlog/components/BrewLogCard.tsx`
- Modify: `frontend/src/features/recipe/components/RecipeDetail.tsx`
- Modify: `frontend/src/features/brewlog/components/BrewDetail.tsx`

**Covers:** AC-CONSIST-01, AC-CONSIST-02, AC-CONSIST-03

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces: `src/test/consistency.test.ts` — Task 2~4가 소스 검사를 더할 자리

- [x] **Step 1: 실패하는 테스트 작성**

`headings.test.ts`의 `walk()` 패턴을 그대로 따른다. 파일을 읽어 문자열을 세는 검사다.

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** 항목 구분자로 쓰이는 가운뎃점. `·`(U+00B7). */
const SEPARATOR = "·";

const CARD_AND_DETAIL = [
  "src/features/recipe/components/RecipeCard.tsx",
  "src/features/brewlog/components/BrewLogCard.tsx",
  "src/features/recipe/components/RecipeDetail.tsx",
  "src/features/brewlog/components/BrewDetail.tsx",
] as const;

describe("AC-CONSIST-01 · BrewLogCard에 구분자가 없다", () => {
  it("`·`가 0개다", () => {
    const source = readFileSync(
      "src/features/brewlog/components/BrewLogCard.tsx",
      "utf8",
    );
    expect(source.split(SEPARATOR)).toHaveLength(1);
  });
});

describe("AC-CONSIST-02 · RecipeDetail에 구분자가 없다", () => {
  it("`·`가 0개다", () => {
    const source = readFileSync(
      "src/features/recipe/components/RecipeDetail.tsx",
      "utf8",
    );
    expect(source.split(SEPARATOR)).toHaveLength(1);
  });
});

describe("AC-CONSIST-03 · 메타줄 4곳의 가로 간격이 gap-x-3이다", () => {
  it("네 파일 다 gap-x-3을 쓴다", () => {
    const offenders = CARD_AND_DETAIL.filter(
      (path) => !readFileSync(path, "utf8").includes("gap-x-3"),
    );
    expect(offenders).toEqual([]);
  });

  it("네 파일 어디에도 다른 gap-x가 없다", () => {
    const offenders = CARD_AND_DETAIL.flatMap((path) =>
      [...readFileSync(path, "utf8").matchAll(/gap-x-([0-9.]+)/g)]
        .filter((match) => match[1] !== "3")
        .map((match) => `${path}: ${match[0]}`),
    );
    expect(offenders).toEqual([]);
  });
});
```

- [x] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm test src/test/consistency.test.ts`

Expected: FAIL 3개.
- AC-01 — `BrewLogCard.tsx`에 `{index > 0 && <span aria-hidden>·</span>}`가 있어 `split`이 2를 준다
- AC-02 — `RecipeDetail.tsx`의 기구 줄 `<span aria-hidden> · </span>` 때문에 같은 이유
- AC-03 두 번째 — `BrewLogCard`가 `gap-x-1`, `BrewDetail`이 `gap-x-4`다

- [x] **Step 3: 최소 구현**

`BrewLogCard.tsx` 보조줄 — 구분자를 지우고 간격을 넓힌다. `index`가 더 이상 쓰이지 않는다.

```tsx
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            {summaryEntries(log, lead.label).map((entry) => (
              <div key={entry.label} className="flex items-center gap-1">
                <dt className="sr-only">{entry.label}</dt>
                <dd>{entry.value}</dd>
              </div>
            ))}
          </div>
```

`RecipeDetail.tsx` 기구 줄 — `·`를 지우고 `flex`로 바꾼다. `<p>` 안의 `<span>` 나열이었으므로
간격을 주려면 컨테이너가 `flex`여야 한다.

```tsx
      {(brewer || filter) && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted">
          {brewer && <span>{`${brewer.brand} ${brewer.name}`}</span>}
          {filter && <span>{filter.name}</span>}
        </div>
      )}
```

`BrewDetail.tsx` 실측값 — `gap-x-4`를 `gap-x-3`으로.

```tsx
        <dl className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
```

- [x] **Step 4: 테스트 실행 — 통과 확인**

Run: `pnpm test src/test/consistency.test.ts`
Expected: PASS, 4 tests

Run: `pnpm test`
Expected: PASS, 350 tests + 4 = **354**. 기존 테스트가 `·`를 단언하지 않는 것은 확인됐다.

- [x] **Step 5: 커밋**

```bash
pnpm format && pnpm typecheck && pnpm lint && pnpm test
cd .. && git add . && git commit -m "feat(web): 카드·상세 메타줄의 구분자를 없애고 간격을 잠근다 (AC-CONSIST-01~03)"
```

> **`pnpm format`이 `pnpm-lock.yaml`까지 포맷한다.** 2026-09-07에 무관한 파일 14개·6526줄이
> 커밋에 딸려 들어갔다. `git add` 전에 `git status`로 확인한다.

---

## Task 2: 라벨 어휘를 폼에 맞추고 상세에서 보이게 한다

**Files:**
- Modify: `frontend/src/features/recipe/components/RecipeCard.tsx`
- Modify: `frontend/src/features/brewlog/components/BrewLogCard.tsx`
- Modify: `frontend/src/features/recipe/components/RecipeDetail.tsx`
- Modify: `frontend/src/features/brewlog/components/BrewDetail.tsx`
- Test: `frontend/src/features/recipe/components/RecipeCard.test.tsx`
- Test: `frontend/src/features/brewlog/components/BrewLogCard.test.tsx`
- Test: `frontend/src/app/recipes/[id]/page.test.tsx`

**Covers:** AC-CONSIST-05, AC-CONSIST-06

**Interfaces:**
- Consumes: Task 1의 `gap-x-3` 메타줄
- Produces: 확정 라벨 문자열 10개. Task 3의 「대표로 올린 항목을 뺀다」가 이 문자열로 항목을 찾는다

**바꾸는 문자열 — 스펙의 라벨 어휘표 그대로**

| 파일 | 현행 | 확정 |
|---|---|---|
| `RecipeCard.tsx` | `원두` · `물` | `원두량` · `물량` |
| `RecipeCard.tsx` | `비율` · `물 온도` · `총 시간` | 그대로 |
| `BrewLogCard.tsx` | `브루 비율` | `비율` |
| `BrewLogCard.tsx` | `내린 날` · `물 온도` · `추출 시간` · `추출 수율` | 그대로 |
| `RecipeDetail.tsx` | `원두` · `물` | `원두량` · `물량` |
| `BrewDetail.tsx` | `물` · `온도` · `시간` | `물량` · `물 온도` · `추출 시간` |
| `BrewDetail.tsx` | `원두량` · `비율` · `분쇄도` · 원두 이름의 `원두` | 그대로 |

- [x] **Step 1: 실패하는 테스트 작성**

`RecipeCard.test.tsx`에 더한다. `dt`는 `sr-only`라 화면에 안 보이므로 `getByText`가 아니라
컨테이너에서 직접 찾는다.

```tsx
it("AC-CONSIST-06 · 라벨이 폼 어휘를 쓴다", () => {
  const { container } = render(<RecipeCard recipe={hoffmannSummary} />);

  const labels = [...container.querySelectorAll("dt")].map((dt) => dt.textContent);

  expect(labels).toEqual(["원두량", "물량", "비율", "물 온도", "총 시간"]);
});
```

`BrewLogCard.test.tsx`에 더한다. 대표 수치로 올라간 `비율`이 보조줄에서 빠지므로 `dt`는 다섯 개다
(대표 1 + 보조 4).

```tsx
it("AC-CONSIST-06 · 라벨이 폼 어휘를 쓴다", () => {
  const { container } = render(
    <BrewLogCard log={brewLogSummary} recipeLabel="에티오피아 예가체프" />,
  );

  const labels = [...container.querySelectorAll("dt")].map((dt) => dt.textContent);

  expect(labels).toEqual([
    "비율",
    "내린 날",
    "물 온도",
    "추출 시간",
    "추출 수율",
  ]);
  expect(labels).not.toContain("브루 비율");
});
```

`src/app/recipes/[id]/page.test.tsx`에 더한다. **이쪽은 라벨이 보여야 하므로 `getByText`다.**

```tsx
it("AC-CONSIST-05 · 상세 메타줄의 라벨이 화면에 보인다", async () => {
  await renderDetail();

  // hoffmann은 waterTempC 100.0 · totalTimeSeconds 210이라 세 라벨이 전부 그려진다.
  for (const label of ["비율", "물 온도", "총 시간"]) {
    const dt = await screen.findByText(label);
    expect(dt).toBeVisible();
    expect(dt.className).not.toContain("sr-only");
  }
});
```

- [x] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm test RecipeCard BrewLogCard "recipes/\[id\]"`

Expected: FAIL 3개.
- `RecipeCard` — `["원두", "물", ...]`이 와서 첫 두 항목이 어긋난다
- `BrewLogCard` — `"브루 비율"`이 첫 항목으로 온다
- `recipes/[id]` — `sr-only`라 `findByText`가 요소는 찾지만 `toBeVisible()`이 실패한다

- [x] **Step 3: 최소 구현**

카드 둘과 `BrewDetail`은 문자열만 바꾼다. `RecipeDetail`은 **`sr-only`를 12px muted로 바꾼다.**

```tsx
      <dl className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <div className="flex items-center gap-1">
          <dt className="text-xs text-muted">비율</dt>
          <dd>{formatRatio(recipe.ratio)}</dd>
        </div>
        …
      </dl>
```

`BrewDetail`의 `Measure`는 이미 라벨이 보이나 **크기가 지정돼 있지 않다.** 12px로 못박는다.

```tsx
function Measure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1">
      <dt className="text-xs text-muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
```

- [x] **Step 4: 테스트 실행 — 통과 확인**

Run: `pnpm test`
Expected: PASS, **357** (354 + 3)

- [x] **Step 5: 커밋**

```bash
pnpm format && pnpm typecheck && pnpm lint && pnpm test
cd .. && git add . && git commit -m "feat(web): 라벨 어휘를 폼에 맞추고 상세에서 보이게 한다 (AC-CONSIST-05·06)"
```

---

## Task 3: 상세에 대표 수치를 세운다

**Files:**
- Modify: `frontend/src/features/recipe/components/RecipeDetail.tsx`
- Modify: `frontend/src/features/brewlog/components/BrewDetail.tsx`
- Modify: `frontend/src/features/recipe/components/RecipeCard.tsx` (`tabular-nums`)
- Modify: `frontend/src/features/brewlog/components/BrewLogCard.tsx` (`tabular-nums`)
- Test: `frontend/src/app/recipes/[id]/page.test.tsx`
- Test: `frontend/src/app/brews/[id]/page.test.tsx`

**Covers:** AC-CONSIST-08, AC-CONSIST-09, AC-CONSIST-10, AC-CONSIST-11

**Interfaces:**
- Consumes: Task 2의 확정 라벨 문자열
- Produces: `headline(log)` — `BrewLogCard`의 것을 `src/features/brewlog/headline.ts`로 올려
  `BrewDetail`과 나눠 쓴다. 시그니처는 그대로:
  `(log: { brewRatio?: number; actualWaterTempC: number }) => { label: string; value: string }`

> **승격 규칙을 두 곳에 손으로 베끼지 않는다.** 한쪽만 고치면 카드와 상세의 대표 수치가 갈린다.
> `BrewLogSummary`와 `BrewLog` 둘 다 만족하도록 인자를 **구조적 타입**으로 좁힌다.

- [x] **Step 1: 실패하는 테스트 작성**

`src/app/recipes/[id]/page.test.tsx`:

```tsx
/**
 * 대표 수치는 세 클래스를 **모두** 가진 요소다. 하나라도 빠지면 잡히지 않는다.
 * `renderDetail()`은 이 파일이 이미 쓰는 헬퍼다(async — `await` 해야 한다).
 */
function leadElements(): Element[] {
  return [
    ...document.querySelectorAll(".text-lg.font-semibold.tabular-nums"),
  ];
}

it("AC-CONSIST-08 · 대표 수치가 하나이고 30.0g → 500.0g이다", async () => {
  await renderDetail();
  await screen.findByRole("heading", { level: 1 });

  const leads = leadElements();

  expect(leads).toHaveLength(1);
  expect(leads[0].textContent).toBe("원두량30.0g→물량500.0g");
});
```

> **★ 이 파일의 픽스처는 `hoffmann`이라 `30.0g → 500.0g`이다.** `20.0g → 300.0g`은
> `kasuyaRecipe`(레시피 12)의 값이고 e2e에서만 쓴다. 지어낸 값을 쓰면 테스트가 코드가 아니라
> 내 가정을 검증한다.

> **`textContent`는 `sr-only` `dt`까지 이어 붙인다.** 화살표는 `aria-hidden`이지만 DOM에는 있다.
> 눈에 보이는 것은 `20.0g → 300.0g`이고, 이 단언은 **그 DOM 구조**를 못박는 것이다.

`src/app/brews/[id]/page.test.tsx`:

```tsx
/** 비율 없는 로그. `JSON.stringify`가 `undefined` 키를 지우므로 응답에서 통째로 빠진다. */
function withoutRatio() {
  return http.get(DETAIL_URL, () =>
    HttpResponse.json({ ...brewLogWithTds, id: 42, brewRatio: undefined }),
  );
}

/** 실측값 절. `stepSection()`과 같은 방식이다 — 이 파일이 이미 쓰는 패턴. */
async function measureSection(): Promise<HTMLElement> {
  const heading = await screen.findByText("실측값");
  const section = heading.closest("section");
  expect(section).not.toBeNull();
  return section as HTMLElement;
}

it("AC-CONSIST-09 · 대표 수치가 하나이고 1:15.0이다", async () => {
  await renderDetail();
  // `h1`은 Task 4에서 생긴다. 지금 확실히 있는 것을 기다린다.
  await screen.findByText("실측값");

  const leads = leadElements();

  expect(leads).toHaveLength(1);
  expect(leads[0].textContent).toBe("비율1:15.0");
});

it("AC-CONSIST-10 · 비율이 없으면 물 온도가 대표로 승격한다", async () => {
  server.use(withoutRatio());

  await renderDetail();
  await screen.findByText("실측값");

  const leads = leadElements();

  expect(leads).toHaveLength(1);
  expect(leads[0].textContent).toBe("물 온도92°C");
});

it("AC-CONSIST-11 · 대표로 올린 비율은 실측값에 없다", async () => {
  await renderDetail();

  const labels = [...(await measureSection()).querySelectorAll("dt")].map(
    (dt) => dt.textContent,
  );

  expect(labels).not.toContain("비율");
  expect(labels).toContain("물 온도");
});

it("AC-CONSIST-11 · 승격된 물 온도도 실측값에서 빠진다", async () => {
  server.use(withoutRatio());

  await renderDetail();

  const labels = [...(await measureSection()).querySelectorAll("dt")].map(
    (dt) => dt.textContent,
  );

  expect(labels).not.toContain("물 온도");
});
```

> **`<dl>`을 `getByRole("list")`로 집지 않는다.** `dl`의 ARIA 역할 매핑은 브라우저·도구마다
> 갈리고 이 저장소에는 `getByRole("list")` 사용례가 **0곳**이다. 이미 쓰이는
> `heading.closest("section")` 패턴을 그대로 따른다 — `aria-label`도 필요 없어진다.

- [x] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm test "recipes/\[id\]" "brews/\[id\]"`

Expected: FAIL 5개.
- AC-08·09 — `.text-lg.font-semibold.tabular-nums` 요소가 **0개**다. 상세에 대표 수치가 없고
  `tabular-nums`도 어디에도 없다
- AC-10 — 같은 이유
- AC-11 둘 — `getByRole("list", { name: "실측값" })`이 없어서 못 찾는다

- [x] **Step 3: 최소 구현**

`src/features/brewlog/headline.ts`를 새로 만들고 `BrewLogCard.tsx`의 `headline`·`summaryEntries`를
옮긴다. 주석(비율 우선 · 승격 이유)도 함께 옮긴다.

`RecipeDetail.tsx` — 도즈→물을 `<dl>`의 첫 줄에서 대표 줄로 올린다.

```tsx
      <dl className="mt-5 flex flex-col gap-1">
        {/* 대표 수치. 상세에서 정확히 하나가 18px로 뜬다. 라벨은 sr-only다. */}
        <div className="flex items-center gap-1 text-lg font-semibold tabular-nums">
          <dt className="sr-only">원두량</dt>
          <dd>{formatGrams(recipe.doseG)}</dd>
          <span aria-hidden>→</span>
          <dt className="sr-only">물량</dt>
          <dd>{formatGrams(recipe.waterG)}</dd>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <div className="flex items-center gap-1">
            <dt className="text-xs text-muted">비율</dt>
            <dd>{formatRatio(recipe.ratio)}</dd>
          </div>
          …
        </div>
      </dl>
```

`BrewDetail.tsx` — 제목 아래에 대표 줄을 넣고, 실측값에서 `taken`을 뺀다.

```tsx
      <dl className="flex items-center gap-1 text-lg font-semibold tabular-nums">
        <dt className="sr-only">{lead.label}</dt>
        <dd>{lead.value}</dd>
      </dl>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">실측값</h2>
        <dl className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
          {measures(log, lead.label).map((entry) => (
            <Measure key={entry.label} label={entry.label} value={entry.value} />
          ))}
        </dl>
      </section>
```

카드 둘 — 기존 대표 수치 줄에 `tabular-nums`를 더한다.

```tsx
          <div className="flex items-center gap-1 text-lg font-semibold tabular-nums">
```

- [x] **Step 4: 테스트 실행 — 통과 확인**

Run: `pnpm test`
Expected: PASS, **362** (357 + 5)

- [x] **Step 5: 커밋**

```bash
pnpm format && pnpm typecheck && pnpm lint && pnpm test
cd .. && git add . && git commit -m "feat(web): 상세에 대표 수치를 세우고 승격 규칙을 공유한다 (AC-CONSIST-08~11)"
```

---

## Task 4: 브루로그 상세에 h1을 준다

**Files:**
- Modify: `frontend/src/features/brewlog/components/BrewDetail.tsx`
- Modify: `frontend/src/test/headings.test.ts`
- Modify: `docs/specs/2026-09-07-visual-hierarchy.md`
- Test: `frontend/src/app/brews/[id]/page.test.tsx`

**Covers:** AC-CONSIST-12, AC-CONSIST-13

> **`logWithRecipe12()`·`recipe12()`는 `describe("BrewDetailPage — 푸어 스텝")` 블록 안에 있다.**
> 새 테스트를 그 블록 밖에 두면 이름을 못 찾는다. 같은 블록에 넣거나 헬퍼를 파일 최상단으로 올린다.

**Interfaces:**
- Consumes: Task 3의 대표 수치 줄 (그 바로 위에 `h1`이 온다)
- Produces: 없음 (마지막 소스 태스크)

> **★ 이 태스크는 승인된 기존 AC를 갱신한다.** `headings.test.ts`가
> `expect(found).toHaveLength(14)`로 못박고 있어 `h1`을 더하면 **그 테스트가 먼저 깨진다.**
> 스펙 본문의 「14곳」도 함께 15곳으로 고치고 **갱신 이유를 그 AC 자리에 남긴다.**
> 스펙을 안 고치고 테스트만 고치면 문서와 코드가 갈린다.

- [x] **Step 1: 실패하는 테스트 작성**

`src/app/brews/[id]/page.test.tsx`:

```tsx
it("AC-CONSIST-12 · h1이 하나이고 레시피 이름이다", async () => {
  server.use(logWithRecipe12(), recipe12());

  await renderDetail();

  const headings = await screen.findAllByRole("heading", { level: 1 });

  expect(headings).toHaveLength(1);
  expect(headings[0]).toHaveTextContent(kasuyaRecipe.title);
  expect(headings[0].className).toContain("text-xl");
  expect(headings[0].className).toContain("font-semibold");
});

it("AC-CONSIST-13 · 레시피를 못 읽어도 h1이 하나다", async () => {
  // `AC-WEBNAME-31`이 쓰는 403 폴백을 그대로 쓴다 (page.test.tsx:231~239).
  server.use(
    logWithRecipe12(),
    http.get(`${BASE}/recipes/12`, () =>
      HttpResponse.json(
        { code: "FORBIDDEN", message: "권한이 없습니다." },
        { status: 403 },
      ),
    ),
  );

  await renderDetail();

  const headings = await screen.findAllByRole("heading", { level: 1 });

  expect(headings).toHaveLength(1);
  expect(headings[0]).toHaveTextContent("비공개 레시피");
  expect(headings[0].className).toContain("text-xl");
  expect(headings[0].className).toContain("font-semibold");
  expect(headings[0].querySelector("a")).toBeNull();
});
```

`src/test/headings.test.ts` — 개수를 15로 올린다. **이것도 Step 1에서 함께 고친다.**
지금 고치지 않으면 Step 2에서 실패 사유가 둘 섞여 어느 쪽이 깨진 건지 읽히지 않는다.

```ts
describe("AC-VISUAL-13 · 화면 제목 15곳이 같은 단계를 쓴다", () => {
  it("h1이 15곳이다", () => {
    expect(found).toHaveLength(15);
  });
```

- [x] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm test "brews/\[id\]" headings`

Expected: FAIL 3개.
- AC-12 — `h1`이 0개라 `findAllByRole`이 타임아웃한다
- AC-13 — 같은 이유
- `headings` — `h1`이 14곳인데 15를 기대한다

- [x] **Step 3: 최소 구현**

`BrewDetail.tsx` — **링크를 `h1` 안에 넣는다.** `h1`을 링크 안에 넣으면 못 읽을 때 `h1`이 사라진다.

```tsx
          <h1 className="text-xl font-semibold">
            {recipeId !== undefined && recipe.isReady ? (
              <Link
                href={`/recipes/${recipeId}`}
                className="underline-offset-2 hover:underline"
              >
                {recipe.label}
              </Link>
            ) : (
              recipe.label
            )}
          </h1>
```

> **`recipeId`가 없을 때도 `h1`은 남는다.** 기존 코드는 `recipeId !== undefined`일 때만 제목을
> 그렸다. `h1`이 조건부로 사라지면 AC-12·13이 「정확히 하나」를 보장하지 못한다.

`docs/specs/2026-09-07-visual-hierarchy.md` — 「14곳」을 「15곳」으로 고치고 그 AC 아래에 남긴다.

```markdown
> **2026-09-08 갱신: 14곳 → 15곳.** `screen-consistency` 스펙이 `BrewDetail`에 `h1`을 더했다.
> 브루로그 상세만 화면 제목이 없어 제목 탐색으로 「지금 무엇을 보고 있는가」를 알 수 없었다.
> 「모든 `h1`이 `text-xl font-semibold`」라는 조건 자체는 그대로다.
```

- [x] **Step 4: 테스트 실행 — 통과 확인**

Run: `pnpm test`
Expected: PASS, **364** (362 + 2). `headings`는 개수만 바뀌어 총계가 늘지 않는다.

- [x] **Step 5: 커밋**

```bash
pnpm format && pnpm typecheck && pnpm lint && pnpm test
cd .. && git add . && git commit -m "feat(web): 브루로그 상세에 화면 제목을 준다 (AC-CONSIST-12·13)"
```

---

## Task 5: 렌더값을 브라우저로 잰다

**Files:**
- Create: `frontend/e2e/consistency.spec.ts`

**Covers:** AC-CONSIST-04, AC-CONSIST-07, AC-CONSIST-14

**Interfaces:**
- Consumes: Task 1~4의 클래스 전부
- Produces: 없음

> **★ 이 스위트가 첫 실행에 전부 통과하는 것이 정상이다.** 고칠 것을 찾는 그물이 아니라,
> **클래스 이름을 틀렸거나 유틸리티가 생성되지 않은 경우**를 잡는 그물이다.
> `visual-hierarchy`에서 다섯 개가 그렇게 통과했다.

> **★ `pnpm e2e`는 떠 있는 dev 서버를 재사용한다.** 설정은 「프로덕션 빌드에 붙는다」인데
> `reuseExistingServer`가 이긴다. **돌리기 전에 dev 서버를 내린다.** 2026-09-07에 PWA 테스트
> 4개가 이것 때문에 빨갛게 나왔다.

- [x] **Step 1: 실패하는 테스트 작성**

```ts
import { expect, test } from "@playwright/test";
import { installStubs } from "./stubs";

/** globals.css의 --color-muted를 브라우저가 정규화한 값. visual.spec.ts와 같다. */
const MUTED_LIGHT = "rgb(115, 115, 115)";

/** 스텁이 아는 경로만 쓴다 — e2e/screens.ts의 값이다. */
const META_ROWS = [
  { path: "/recipes", text: "1:16.7" },
  { path: "/brews", text: "2026-08-31" },
  { path: "/recipes/12", text: "1:15.0" },
  { path: "/brews/2", text: "20.0g" },
] as const;

test.describe("일관성 — 렌더값", () => {
  for (const { path, text } of META_ROWS) {
    test(`AC-CONSIST-04 · ${path}의 메타줄 column-gap이 12px다`, async ({ page }) => {
      await installStubs(page);
      await page.goto(path);

      const row = page.getByText(text).first().locator("xpath=ancestor::div[contains(@class,'gap-x-3')][1]");
      await expect(row).toBeAttached();

      expect(await row.evaluate((el) => getComputedStyle(el).columnGap)).toBe("12px");
    });
  }

  for (const path of ["/recipes/12", "/brews/2"]) {
    test(`AC-CONSIST-07 · ${path}의 메타줄 라벨이 12px muted다`, async ({ page }) => {
      await installStubs(page);
      await page.goto(path);

      const label = page.getByText("물 온도", { exact: true }).first();
      await expect(label).toBeVisible();

      expect(await label.evaluate((el) => getComputedStyle(el).fontSize)).toBe("12px");
      expect(await label.evaluate((el) => getComputedStyle(el).color)).toBe(MUTED_LIGHT);
    });
  }

  for (const { path, text } of [
    { path: "/recipes", text: "30.0g" },
    { path: "/brews", text: "1:15.0" },
    { path: "/recipes/12", text: "20.0g" },
    { path: "/brews/2", text: "1:15.0" },
  ] as const) {
    test(`AC-CONSIST-14 · ${path}의 대표 수치가 tabular-nums다`, async ({ page }) => {
      await installStubs(page);
      await page.goto(path);

      const lead = page.getByText(text).first();
      await expect(lead).toBeVisible();

      expect(
        await lead.evaluate((el) => getComputedStyle(el.closest("div,dl")!).fontVariantNumeric),
      ).toBe("tabular-nums");
    });
  }
});
```

> **셀렉터가 이 계획에서 가장 부서지기 쉬운 부분이다.** `getByText(...).first()`가 잡는 요소가
> 기대한 것인지 **먼저 `page.pause()`나 `--debug`로 확인하고 나서** 단언을 붙인다.
> 잡히는 요소가 다르면 셀렉터를 고치되, **AC의 값(12px · muted · tabular-nums)은 바꾸지 않는다.**

- [x] **Step 2: 테스트 실행 — 실패 확인**

```bash
pkill -f "next dev" || true
pnpm e2e e2e/consistency.spec.ts
```

Expected: **Task 1~4를 먼저 하므로 여기서는 전부 PASS가 정상이다.** 빨간 것이 나오면 그것은
클래스 이름이 틀렸거나 유틸리티가 생성되지 않았다는 뜻이다 — **소스 검사가 못 잡는 것을 잡은
것이므로 그 자리를 고친다.**

- [x] **Step 3: 최소 구현**

**없다.** Task 1~4에서 클래스를 이미 넣었다. Step 2가 빨갛다면 그때 그 자리만 고친다.

- [x] **Step 4: 테스트 실행 — 통과 확인**

```bash
pkill -f "next dev" || true
pnpm e2e
```

Expected: PASS, 70 + 10 = **80 tests**

- [x] **Step 5: 커밋**

```bash
cd .. && git add . && git commit -m "test(web): 렌더값을 브라우저로 재고 스펙을 올린다 (AC-CONSIST-04·07·14)"
```

---

## 완료 기준

- [x] `cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build` 통과 (테스트 364개)
- [x] `cd frontend && pnpm e2e` 통과 (80개) — **dev 서버를 내리고 돌린다**
- [x] `./scripts/check-spec-coverage.sh` 통과 (AC 710 + 14 = **724**)
- [x] 스펙의 `status`를 `구현완료`로 변경
- [x] `visual-hierarchy` 스펙의 「화면 제목 14곳」이 15곳으로 갱신되고 이유가 그 자리에 남았다
- [ ] 스펙 「수동 확인」 2개 — **둘 다 비차단형이라 `status`를 막지 않는다.** 폰 실물과 실제 조명이 필요하다

---

## 자체 검토 결과

계획을 다 쓴 뒤 스펙과 대조해 확인한 것.

- **AC 14개가 전부 태스크에 매핑됐다.** 커버리지 표로 대조했다.
- **★ 스펙의 e2e 경로가 틀려 있었다.** `/recipes/1`·`/brews/1`로 썼는데 스텁이 아는 것은
  `/recipes/12`·`/brews/2`다(`e2e/screens.ts`). **스펙을 고쳤다.**
- **★ `headings.test.ts`가 Task 4를 막는다.** `toHaveLength(14)`가 하드코딩돼 있어 `h1`을 더하는
  순간 깨진다. 승인된 AC를 갱신하는 일이므로 Task 4에 명시적으로 넣고 스펙 본문에도 적었다.
- **★ 승격 규칙이 두 곳에 복제될 뻔했다.** `headline()`을 `BrewLogCard`에서 공용 모듈로 올려
  카드와 상세가 같은 함수를 쓰게 했다. 베끼면 한쪽만 고쳤을 때 대표 수치가 갈린다.
- **★ `실측값` `<dl>`에 접근 가능한 이름이 없다.** AC-CONSIST-11이 「실측값 안에 없다」를
  검사하려면 그 `<dl>`을 역할로 집을 수 있어야 한다. `aria-label="실측값"`을 구현에 넣었다.
- **★ `h1`이 조건부로 사라질 뻔했다.** 기존 코드가 `recipeId !== undefined`일 때만 제목을 그린다.
  그대로 `h1`으로 감싸면 「정확히 하나」가 깨진다. `h1`은 항상 그리고 링크만 조건부로 했다.
- **픽스처를 새로 짓지 않았다.** 모든 리터럴을 `src/test/fixtures.ts`의 실제 값으로 검산했다 —
  `20.0g → 300.0g` · `1:15.0` · `92°C` · `3:30`(210초) · `17.6 %`.
- **테스트 개수를 태스크마다 누적으로 적었다** (350 → 354 → 357 → 362 → 364). 어긋나면 어느
  태스크에서 벌어졌는지 바로 보인다.
- **★ 스펙의 AC-CONSIST-08 리터럴이 틀려 있었다.** `20.0g → 300.0g`으로 썼는데
  `recipes/[id]/page.test.tsx`가 쓰는 픽스처는 `hoffmann`이라 **`30.0g → 500.0g`**이다.
  `20.0g → 300.0g`은 `kasuyaRecipe`(레시피 12)의 값으로 e2e에서만 쓴다. **스펙을 고쳤다.**
- **★ 계획 초고가 없는 헬퍼를 지어냈다.** `renderPage()`·`brewLogHandler()`·
  `recipeForbiddenHandler()`는 **존재하지 않는다.** 403 폴백은 명명된 헬퍼가 아니라 인라인
  `http.get(...)`이다(`AC-WEBNAME-31`, `page.test.tsx:231`). 실제 이름은 `renderDetail()`·`logWithRecipe12()`·
  `recipe12()`·`loggedBy()`이고 픽스처는 `brewLogWithTds`·`hoffmann`·`kasuyaRecipe`다. 고쳤다.
- **★ `getByRole("list")`로 `<dl>`을 집으려다 물렸다.** `dl`의 역할 매핑은 확정적이지 않고 이
  저장소에 사용례가 0곳이다. `heading.closest("section")`으로 바꿨다 — 그래서 `aria-label`도
  필요 없어졌다.
- **열어둔 결정은 스펙과 같다** — 터치 타깃 44×44px, 간격·모서리·그림자 체계. 둘 다 별도 스펙.

---

## 구현하며 드러난 것 (2026-09-08 갱신)

> 계획을 세운 뒤 실제로 밟으면서 어긋난 것들. **다음에 이 계획을 읽는 사람이 속지 않도록 남긴다.**

- **★ `AC-CONSIST-01·02`의 검사 방식이 틀렸다.** 「소스에서 `·`를 센다」로 썼는데, 이 저장소는
  **주석에서 `·`를 한국어 연결 부호로 정상적으로 쓴다**(`dt·dd`,
  `actual_dose_g`·`actual_water_g`). 원본 그대로 세면 구분자가 아니라 설명 문장을 금지한다.
  **주석을 지우고 세도록 고치고 스펙의 그 AC에도 이유를 남겼다.**
- **★ `AC-CONSIST-14`는 클래스가 없어도 통과한다.** `globals.css`의 `body`가 이미
  `font-variant-numeric: tabular-nums`를 걸어 **모든 숫자가 상속으로 tabular가 된다.**
  계획이 「규정해놓고 어디에도 안 붙어 있다」고 쓴 것은 **클래스 기준으로는 맞지만 렌더 기준으로는
  틀렸다.** e2e는 남겼다 — 재는 것은 클래스가 아니라 화면에 그려진 결과이고, `body` 규칙이
  사라지면 빨개진다. 클래스 자체는 `AC-CONSIST-08`·`09`가 본다.
- **★ Task 3의 테스트가 Task 4의 `h1`을 기다렸다.** 계획 스니펫이
  `findByRole("heading", { level: 1 })`을 썼는데 그 `h1`은 Task 4에서야 생긴다.
  **태스크가 서로 물리면 순서대로 초록일 수 없다.** `findByText("실측값")`으로 고쳤다.
- **★ `h1`이 이름보다 먼저 그려진다.** 로그가 오고 레시피 이름이 뒤에 온다.
  `findAllByRole("heading")`은 **비어 있는 `h1`을 잡는다.** `name`으로 기다린 뒤 개수를 센다.
- **★ Task 2가 레이아웃을 깨뜨렸다.** `RecipeDetail`의 메타 항목이 플레인 `<div>`라 라벨을
  드러내는 순간 `dt`·`dd`가 세로로 쌓였다. **테스트는 초록이었다** — 문자열만 봤기 때문이다.
  Task 3의 재구조화에서 `flex items-center gap-1`로 감쌌다.
- **★ e2e 경로 리터럴이 또 틀렸다.** `/recipes/12`는 kasuya가 아니라 **hoffmann**이다
  (`30.0g → 500.0g` · `1:16.7` · `100°C`). kasuya는 **id 3**이다 — `e2e/stubs.ts`의 핸들러
  순서가 그렇게 정한다.
- **테스트 개수가 계획과 하나 어긋났다.** 357이 아니라 358이다. `BrewDetail`의 어휘 검사를
  따로 세워 하나 늘었다. 최종 **365개**(계획 364).
- **돌연변이로 그물이 비어 있지 않음을 확인했다.** `BrewDetail`의 `gap-x-3`을 `gap-x-2`로
  바꾸니 `AC-CONSIST-04`가 「element(s) not found」로 빨개졌다.
- **`pnpm e2e` 첫 실행(빌드 포함, 6.1분)에서 PWA 캐시 테스트 4개가 타임아웃했다.**
  재실행(26.7초)과 `pwa.spec.ts` 단독 실행은 초록이다. **회귀가 아니라 부하 민감이다** —
  `AC-PWA-19`·`20`은 단독으로도 14초씩 걸린다.

