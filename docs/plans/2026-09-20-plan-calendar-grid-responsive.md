# 웹 달력 그리드 반응형 재설계 구현 계획

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.

**Spec:** `docs/specs/2026-09-20-calendar-grid-responsive.md`

**Goal:** `≥1100px` 홈 화면에서 달력 그리드가 뷰포트 높이에 맞춰 늘어나거나(부족하면 페이지가
스크롤되거나) 줄어들고, 그리드선·셀 여백·선택/오늘 날짜 숫자 표시가 목업
(`Kaldi Note Home - Calendar Web.dc.html`)과 일치한다.

**Architecture:** `WEB_GRID_HEIGHT_PX = 420` 고정값을 없애고, `body`(이미 `flex flex-col
min-h-full`)부터 `Calendar`의 주(週) 그리드까지 **flex 체인**을 잇는다 — `Shell`에 `grow` prop을
추가해 `<main>`을 `flex-1`로 만들고, 홈의 2컬럼 행과 좌측 컬럼 wrapper를 각각 `flex-1 flex-col`로
바꾼 뒤, `Calendar`에 새 `fillHeight` prop을 추가해 주 그리드를 `flex:1` + `grid-template-rows:
repeat(N, minmax(64px, 1fr))`로 그린다. **어떤 컨테이너에도 `min-height:0`을 주지 않는다** — 그래야
flexbox의 "자동 최소 크기"(content-based auto minimum)가 `64px×주 수`를 자연스러운 바닥으로 만들어
AC-86(스크롤로 폴백)이 별도 JS 계산 없이 CSS만으로 성립한다. `fillHeight`는 `isTwoColumn`
(`≥1100px`)일 때만 `true`이므로 `760~1099px`(1컬럼)는 기존 고정 420px 동작을 그대로 유지한다
(AC-91, Non-goal). 그리드선·패딩·선택/오늘 숫자 표시는 높이 로직과 무관한 순수 스타일이므로
기존 관례대로 `isWeb`(`≥760px`) 전체에 적용한다 — 기존 코드의 `bg-surface`·`primaryRecipeName`
같은 다른 웹 전용 스타일도 `isTwoColumn`이 아니라 `isWeb`로 갈리기 때문이다.

**작업 위치:** `frontend/`

**반드시 먼저 읽을 것:** `CLAUDE.md`(루트) → `frontend/CLAUDE.md` → `docs/conventions/frontend.md` → `docs/conventions/git.md`

---

## AC 커버리지 매핑

| AC ID | 요약 | 담당 태스크 | 검증 방식 |
|---|---|---|---|
| AC-HOMECAL-85 | `≥1100px`에서 그리드가 남는 세로 공간을 채운다 | Task 1 | e2e |
| AC-HOMECAL-86 | 행 높이가 `64px` 밑으로 못 내려가면 페이지가 스크롤된다 | Task 1 | e2e |
| AC-HOMECAL-91 | `1099px`(1컬럼)는 이 반응형 채움을 쓰지 않는다 | Task 1 | e2e |
| AC-HOMECAL-87 | 그리드선 — 상단 `divider-strong`, 내부 `sunken`, `1px` | Task 2 | e2e |
| AC-HOMECAL-88 | 셀 안쪽 여백 상하 `8px`·좌우 `12px` | Task 3 | e2e |
| AC-HOMECAL-89 | 선택된 날짜 숫자가 `24px` 원(`ink`/`on-ink`) | Task 4 | e2e |
| AC-HOMECAL-90 | 오늘·미선택 날짜 숫자에 `1px` `border` 링 | Task 5 | e2e |

---

## Global Constraints

- 백엔드 변경 0건. 새 API 호출 없음.
- 새 디자인 토�큰을 만들지 않는다 — `--ink`·`--on-ink`·`--border`·`--sunken`·`--divider-strong`
  모두 이미 `globals.css`에 있다(`--color-*` Tailwind 매핑도 이미 있음).
- `760~1099px`(1컬럼)의 기존 렌더링(고정 `420px` 높이)은 건드리지 않는다 — Non-goal.
- 우측 컬럼(`DayList`)의 카드 틀·태그 줄은 건드리지 않는다 — 별도 스펙(Non-goal).
- 어떤 요소에도 `min-height: 0`을 주지 않는다(Architecture 참조) — 대신 flexbox 자동 최소
  크기가 바닥 역할을 하게 둔다.
- 기존 e2e `AC-HOMECAL-68`(6주 달도 그리드 총높이가 같다, `1440×900`)이 계속 통과해야 한다 —
  `900px`에서 두 달 모두 같은 `flex:1` 공간을 나눠 가지므로 총높이는 그대로 같고, 週당 행
  높이만 달라진다. Task 1에서 회귀로 확인한다.

## File Structure

```
frontend/src/
├── components/ui/Shell.tsx                        (수정) `grow` prop 추가
├── features/calendar/components/Calendar.tsx      (수정) fillHeight·today prop, 그리드선·패딩·원·링
├── app/page.tsx                                    (수정) Shell/Calendar에 grow·fillHeight·today 연결
└── e2e/home-calendar-web.spec.ts                  (수정) AC-HOMECAL-85~91
```

---

## Task 1: 그리드가 남는 세로 공간을 채운다 (flex 체인 + 64px 바닥)

**Files:**
- Modify: `frontend/src/components/ui/Shell.tsx`
- Modify: `frontend/src/app/page.tsx`
- Modify: `frontend/src/features/calendar/components/Calendar.tsx`
- Test: `frontend/e2e/home-calendar-web.spec.ts`

**Covers:** AC-HOMECAL-85, AC-HOMECAL-86, AC-HOMECAL-91

**Interfaces:**
- Produces: `Shell({ grow?: boolean })`, `Calendar({ fillHeight?: boolean })`, `data-testid="calendar-week-grid"`(주 그리드 컨테이너)

- [ ] **Step 1: 실패하는 테스트 작성**

`e2e/home-calendar-web.spec.ts`에 추가(파일 하단, `AC-HOMECAL-71` 테스트 뒤):

```ts
test("AC-HOMECAL-85 · ≥1100px에서 그리드가 남는 세로 공간을 채운다", async ({
  page,
}) => {
  await installStubs(page);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const shortGrid = await page.getByTestId("calendar-week-grid").boundingBox();

  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/");
  const tallGrid = await page.getByTestId("calendar-week-grid").boundingBox();

  expect(shortGrid?.height).not.toBe(420);
  expect(tallGrid?.height).not.toBe(shortGrid?.height);
});

test("AC-HOMECAL-86 · 행 높이가 64px 밑으로 내려가야 하면 페이지가 스크롤된다", async ({
  page,
}) => {
  await installStubs(page);
  await page.setViewportSize({ width: 1440, height: 500 });
  await page.goto("/");

  await page.getByRole("button", { name: "이전 달" }).click();
  await expect(page.getByText("2026.08")).toBeVisible();

  const rows = page.getByTestId("calendar-row");
  await expect(rows).toHaveCount(6);
  // 500px는 그리드 밖 크롬이 약 249px라 6행이 64px 바닥에 정확히 눌리는 높이다(사전 실측).
  // `toBeGreaterThanOrEqual(64)`만 쓰면 옛 고정 420px 구현도 70px(420÷6)로 우연히 통과해
  // 이 테스트가 아무것도 증명하지 못한다 — 정확히 64px이어야 새 바닥 로직을 증명한다.
  const firstRowHeight = await rows
    .first()
    .evaluate((el) => el.getBoundingClientRect().height);
  expect(firstRowHeight).toBe(64);

  const scrollHeight = await page.evaluate(
    () => document.documentElement.scrollHeight,
  );
  const innerHeight = await page.evaluate(() => window.innerHeight);
  expect(scrollHeight).toBeGreaterThan(innerHeight);
});

test("AC-HOMECAL-91 · 1099px(1컬럼)에서는 이 반응형 채움을 쓰지 않는다", async ({
  page,
}) => {
  await installStubs(page);

  await page.setViewportSize({ width: 1099, height: 700 });
  await page.goto("/");
  const short = await page.getByTestId("calendar-week-grid").boundingBox();

  await page.setViewportSize({ width: 1099, height: 1200 });
  await page.goto("/");
  const tall = await page.getByTestId("calendar-week-grid").boundingBox();

  expect(short?.height).toBe(tall?.height);
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm e2e -- home-calendar-web`
Expected: FAIL — `calendar-week-grid` testid가 없고, 높이가 항상 `420px` 고정이라
AC-85·86이 실패한다(AC-91은 이미 우연히 통과할 수 있음 — 상관없다, 회귀 방지 목적).

- [ ] **Step 3: 최소 구현**

`Shell.tsx`:

```tsx
export function Shell({
  children,
  stack = false,
  wide = false,
  grow = false,
  className = "",
}: {
  children: ReactNode;
  stack?: boolean;
  wide?: boolean;
  /** 남는 뷰포트 세로 공간을 채운다 — 홈의 웹 2컬럼 달력만 쓴다(AC-HOMECAL-85). */
  grow?: boolean;
  className?: string;
}) {
  return (
    <main
      className={`mx-auto w-full ${wide ? "" : "max-w-2xl"} px-6 py-6 ${stack ? "flex flex-col gap-6" : ""} ${grow ? "flex-1" : ""} ${className}`
        .replace(/\s+/g, " ")
        .trim()}
    >
      {children}
    </main>
  );
}
```

`page.tsx` — `Shell` 호출과 2컬럼 블록, `Calendar` 호출을 수정:

```tsx
<Shell stack wide={isWeb} grow={isTwoColumn}>
  {/* ... FollowRail ... */}
  {isTwoColumn ? (
    <div className="flex flex-1 gap-6">
      <div className="flex flex-1 flex-col">{calendarBlock}</div>
      <div
        data-testid="day-column"
        className="flex w-[420px] shrink-0 flex-col gap-3 overflow-y-auto bg-surface p-4"
        style={{ maxHeight: 600 }}
      >
        {daySection}
        <ContextCta ... />
      </div>
    </div>
  ) : (
    <>
      {calendarBlock}
      {daySection}
    </>
  )}
  ...
</Shell>
```

`Calendar` 호출에 `fillHeight={isTwoColumn}` 추가:

```tsx
<Calendar
  month={selectedMonth}
  days={days}
  selectedDate={selectedDate}
  onSelect={setSelectedDate}
  onSwipeLeft={handleNextMonth}
  onSwipeRight={handlePrevMonth}
  variant={variant}
  fillHeight={isTwoColumn}
/>
```

`Calendar.tsx` — prop 추가, 루트 div와 주 그리드 컨테이너 수정:

```tsx
export function Calendar({
  month,
  days,
  selectedDate,
  onSelect,
  onSwipeLeft,
  onSwipeRight,
  variant,
  fillHeight = false,
}: {
  // ...기존 필드
  /** `≥1100px` 2컬럼에서만 true. 남는 세로 공간을 채우는 flex 체인을 켠다(AC-HOMECAL-85). */
  fillHeight?: boolean;
}) {
  // ...
  const isWeb = variant === "web";

  return (
    <div
      role="grid"
      data-variant={variant}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      className={fillHeight ? "flex flex-1 flex-col" : undefined}
    >
      <div role="row" className="grid grid-cols-7">
        {/* 요일 헤더 — 그대로 */}
      </div>
      <div
        data-testid="calendar-week-grid"
        style={
          isWeb
            ? fillHeight
              ? {
                  flex: "1 1 auto",
                  display: "grid",
                  gridTemplateRows: `repeat(${weeks.length}, minmax(64px, 1fr))`,
                }
              : {
                  height: WEB_GRID_HEIGHT_PX,
                  display: "grid",
                  gridTemplateRows: `repeat(${weeks.length}, 1fr)`,
                }
            : undefined
        }
      >
        {/* 주 행 렌더 — 그대로 */}
      </div>
    </div>
  );
}
```

`min-height:0`을 어디에도 주지 않았으므로, `500px` 뷰포트처럼 공간이 부족하면 `calendar-week-grid`의
자동 최소 크기(`64px×weeks.length`)가 그대로 유지되고 넘친 만큼 `main`→`body`가 커져 페이지가
스크롤된다. `900px`·`1100px`처럼 공간이 남으면 `flex: 1 1 auto`가 그 공간을 그대로 채운다.

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `pnpm e2e -- home-calendar-web`
Expected: PASS, `AC-HOMECAL-68`(6주 총높이 동일) 포함 전체 통과 — 회귀 없음.

- [ ] **Step 5: 커밋**

```bash
pnpm lint && pnpm typecheck
git add src/components/ui/Shell.tsx src/app/page.tsx src/features/calendar/components/Calendar.tsx e2e/home-calendar-web.spec.ts
git commit -m "feat(web): 웹 달력 그리드가 flex로 남는 세로 공간을 채운다 (AC-HOMECAL-85·86·91)"
```

---

## Task 2: 그리드선 — 상단 `divider-strong`, 내부 `sunken`

**Files:**
- Modify: `frontend/src/features/calendar/components/Calendar.tsx`
- Test: `frontend/e2e/home-calendar-web.spec.ts`

**Covers:** AC-HOMECAL-87

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
import { tokenColor } from "./tokenColor";
// (파일 상단 import에 추가)

test("AC-HOMECAL-87 · 그리드선 — 상단은 divider-strong, 내부는 sunken, 폭 1px", async ({
  page,
}) => {
  await installStubs(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const grid = page.getByTestId("calendar-week-grid");
  const topWidth = await grid.evaluate((el) => getComputedStyle(el).borderTopWidth);
  const topColor = await grid.evaluate((el) => getComputedStyle(el).borderTopColor);
  expect(topWidth).toBe("1px");
  expect(topColor).toBe(await tokenColor(page, "divider-strong"));

  const secondRow = page.getByTestId("calendar-row").nth(1);
  const innerWidth = await secondRow.evaluate(
    (el) => getComputedStyle(el).borderTopWidth,
  );
  const innerColor = await secondRow.evaluate(
    (el) => getComputedStyle(el).borderTopColor,
  );
  expect(innerWidth).toBe("1px");
  expect(innerColor).toBe(await tokenColor(page, "sunken"));
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm e2e -- home-calendar-web`
Expected: FAIL — 지금은 그리드선이 전혀 없다(모든 border 값이 `0px none`).

- [ ] **Step 3: 최소 구현**

`Calendar.tsx`의 주 그리드 컨테이너와 각 행·셀에 클래스를 추가한다:

```tsx
<div
  data-testid="calendar-week-grid"
  className={isWeb ? "border-t border-divider-strong" : undefined}
  style={ /* Task 1과 동일 */ }
>
  {weeks.map((week, weekIndex) => (
    <div
      key={weekIndex}
      data-testid="calendar-row"
      role="row"
      className={`grid grid-cols-7 ${
        isWeb && weekIndex > 0 ? "border-t border-sunken" : ""
      }`}
    >
      {week.map((cell, columnIndex) => {
        const lineClass =
          isWeb && columnIndex > 0 ? "border-l border-sunken" : "";
        if (!cell.inMonth) {
          return (
            <div
              key={cell.date}
              data-testid="calendar-out-of-month"
              aria-hidden
              className={`${isWeb ? "bg-surface" : ""} ${lineClass}`}
            />
          );
        }
        // ... 기존 info/count/label 계산
        return (
          <button
            key={cell.date}
            // ... 기존 속성
            className={`flex h-full w-full min-h-11 min-w-11 flex-col items-center justify-center overflow-hidden ${
              isWeb && selected ? "bg-surface" : ""
            } ${lineClass}`}
          >
            {/* ... */}
          </button>
        );
      })}
    </div>
  ))}
</div>
```

첫 행(`weekIndex === 0`)은 위쪽 테두리를 생략한다 — 컨테이너의 `border-t-divider-strong`과
겹치면 두 줄로 보인다. 첫 열(`columnIndex === 0`)도 왼쪽 선을 생략한다 — 바깥 세로 테두리는
목업에 없다.

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `pnpm e2e -- home-calendar-web`
Expected: PASS 전체.

- [ ] **Step 5: 커밋**

```bash
pnpm lint && pnpm typecheck
git add src/features/calendar/components/Calendar.tsx e2e/home-calendar-web.spec.ts
git commit -m "feat(web): 웹 달력에 그리드선을 그린다 (AC-HOMECAL-87)"
```

---

## Task 3: 셀 안쪽 여백 (상하 8px · 좌우 12px)

**Files:**
- Modify: `frontend/src/features/calendar/components/Calendar.tsx`
- Test: `frontend/e2e/home-calendar-web.spec.ts`

**Covers:** AC-HOMECAL-88

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
test("AC-HOMECAL-88 · 셀 안쪽 여백이 상하 8px·좌우 12px다", async ({ page }) => {
  await installStubs(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const cell = page.getByRole("button", { name: "9월 5일, 기록 2건" });
  const padding = await cell.evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      top: s.paddingTop,
      bottom: s.paddingBottom,
      left: s.paddingLeft,
      right: s.paddingRight,
    };
  });
  expect(padding).toEqual({
    top: "8px",
    bottom: "8px",
    left: "12px",
    right: "12px",
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm e2e -- home-calendar-web`
Expected: FAIL — 셀에는 지금 padding 클래스가 전혀 없다(`0px`).

- [ ] **Step 3: 최소 구현**

셀 버튼(그리고 결 맞춤을 위해 `calendar-out-of-month` div도) 클래스에 `isWeb`일 때
`py-2 px-3`(Tailwind: `8px`/`12px`)을 추가:

```tsx
className={`flex h-full w-full min-h-11 min-w-11 flex-col items-center justify-center overflow-hidden ${
  isWeb ? "px-3 py-2" : ""
} ${isWeb && selected ? "bg-surface" : ""} ${lineClass}`}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `pnpm e2e -- home-calendar-web`
Expected: PASS 전체 — 특히 `AC-HOMECAL-63`(레시피명 truncate)·`AC-HOMECAL-64`(외 N건)가
padding이 생겨도 안 깨지는지 회귀로 확인한다.

- [ ] **Step 5: 커밋**

```bash
pnpm lint && pnpm typecheck
git add src/features/calendar/components/Calendar.tsx e2e/home-calendar-web.spec.ts
git commit -m "feat(web): 웹 달력 셀 안쪽 여백을 8px/12px로 맞춘다 (AC-HOMECAL-88)"
```

---

## Task 4: 선택된 날짜 숫자를 24px 원으로 감싼다

**Files:**
- Modify: `frontend/src/features/calendar/components/Calendar.tsx`
- Test: `frontend/e2e/home-calendar-web.spec.ts`

**Covers:** AC-HOMECAL-89

**Interfaces:**
- Produces: `data-testid="day-number"`(날짜 숫자를 감싸는 span)

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
test("AC-HOMECAL-89 · 선택된 날짜 숫자가 24px 원으로 감싸진다", async ({
  page,
}) => {
  await installStubs(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const cell = page.getByRole("button", { name: "9월 5일, 기록 2건" });
  await cell.click();
  const numberEl = cell.getByTestId("day-number");

  const box = await numberEl.boundingBox();
  expect(Math.round(box?.width ?? 0)).toBe(24);
  expect(Math.round(box?.height ?? 0)).toBe(24);

  // Tailwind의 `rounded-full`은 큰 px 값(예: `3.35544e+07px`)으로 계산된다 — 정확한 숫자가
  // 아니라 박스 절반(12px)보다 훨씬 커서 완전한 원이 되는지만 확인한다.
  const borderRadius = await numberEl.evaluate(
    (el) => getComputedStyle(el).borderRadius,
  );
  const bg = await numberEl.evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  );
  const color = await numberEl.evaluate((el) => getComputedStyle(el).color);
  expect(parseFloat(borderRadius)).toBeGreaterThan(12);
  expect(bg).toBe(await tokenColor(page, "ink"));
  expect(color).toBe(await tokenColor(page, "on-ink"));
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm e2e -- home-calendar-web`
Expected: FAIL — `day-number` testid가 없고, 숫자는 그냥 텍스트 노드다.

- [ ] **Step 3: 최소 구현**

날짜 숫자 `<span>{day}</span>`을 조건부 원 스타일로 감싼다:

```tsx
<span
  data-testid="day-number"
  className={
    isWeb && selected
      ? "flex h-6 w-6 items-center justify-center rounded-full bg-ink text-on-ink"
      : undefined
  }
>
  {day}
</span>
```

기존 `boxShadow`(셀 전체 inset 링)와 `bg-surface`(셀 배경)는 그대로 둔다 — 목업은 셀 전체
강조 **더하기** 숫자 원을 함께 쓴다(`AC-HOMECAL-70` 회귀 확인).

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `pnpm e2e -- home-calendar-web`
Expected: PASS 전체, `AC-HOMECAL-70` 포함.

- [ ] **Step 5: 커밋**

```bash
pnpm lint && pnpm typecheck
git add src/features/calendar/components/Calendar.tsx e2e/home-calendar-web.spec.ts
git commit -m "feat(web): 선택된 날짜 숫자를 24px ink 원으로 감싼다 (AC-HOMECAL-89)"
```

---

## Task 5: 오늘·미선택 날짜 숫자에 1px 링

**Files:**
- Modify: `frontend/src/app/page.tsx`
- Modify: `frontend/src/features/calendar/components/Calendar.tsx`
- Test: `frontend/e2e/home-calendar-web.spec.ts`

**Covers:** AC-HOMECAL-90

**Interfaces:**
- Consumes: `kstToday()`(이미 `page.tsx`가 import함)
- Produces: `Calendar({ today?: string })`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
test("AC-HOMECAL-90 · 오늘이지만 선택 안 된 날짜 숫자에 1px 링이 있다", async ({
  page,
}) => {
  await installStubs(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  // 진입 시 오늘(9/19)이 자동 선택되므로, 다른 날짜를 선택해 오늘을 비선택 상태로 만든다.
  await page.getByRole("button", { name: "9월 5일, 기록 2건" }).click();

  const todayCell = page.getByRole("button", { name: "9월 19일, 기록 없음" });
  const numberEl = todayCell.getByTestId("day-number");

  const borderWidth = await numberEl.evaluate(
    (el) => getComputedStyle(el).borderTopWidth,
  );
  const borderColor = await numberEl.evaluate(
    (el) => getComputedStyle(el).borderTopColor,
  );
  const bg = await numberEl.evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  );

  expect(borderWidth).toBe("1px");
  expect(borderColor).toBe(await tokenColor(page, "border"));
  expect(bg).toBe("rgba(0, 0, 0, 0)");
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm e2e -- home-calendar-web`
Expected: FAIL — "오늘" 개념 자체가 `Calendar`에 없다.

- [ ] **Step 3: 최소 구현**

`page.tsx` — `Calendar`에 `today` 전달:

```tsx
<Calendar
  // ...기존 props
  fillHeight={isTwoColumn}
  today={kstToday()}
/>
```

`Calendar.tsx` — prop 추가 후 셀 렌더 안에서 판정:

```tsx
export function Calendar({
  // ...
  fillHeight = false,
  today,
}: {
  // ...
  today?: string;
}) {
  // ...
  {week.map((cell, columnIndex) => {
    // ...
    const isToday = cell.date === today;
    return (
      <button /* ... */>
        <span
          data-testid="day-number"
          className={
            isWeb && selected
              ? "flex h-6 w-6 items-center justify-center rounded-full bg-ink text-on-ink"
              : isWeb && isToday
                ? "flex h-6 w-6 items-center justify-center rounded-full border border-border"
                : undefined
          }
        >
          {day}
        </span>
        {/* ... */}
      </button>
    );
  })}
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `pnpm e2e -- home-calendar-web`
Expected: PASS 전체.

- [ ] **Step 5: 커밋**

```bash
pnpm lint && pnpm typecheck
git add src/app/page.tsx src/features/calendar/components/Calendar.tsx e2e/home-calendar-web.spec.ts
git commit -m "feat(web): 오늘 날짜 숫자에 미선택 상태 링을 그린다 (AC-HOMECAL-90)"
```

---

## 완료 기준

- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` 전부 통과
- [ ] `pnpm test:worker` 통과
- [ ] `pnpm e2e` 전체 통과 (신규 7개 + 기존 회귀, 특히 `AC-HOMECAL-63·64·68·70·71`)
- [ ] `(cd .. && ./scripts/check-spec-coverage.sh)` 통과
- [ ] 스펙(`docs/specs/2026-09-20-calendar-grid-responsive.md`)의 `status`를 `구현완료`로 변경
- [ ] 수동 확인 없음(스펙에 명시됨 — 전부 자동화 가능)

---

## 자체 검토 결과

**AC 커버리지:** 스펙의 AC 7개(`85`~`91`) 중 7개가 태스크에 매핑됨.

**자리표시자 검사:** `TODO`, `TBD`, "나중에", "비슷하게" 없음.

**타입 일관성:** `Calendar`의 새 prop `fillHeight`·`today`는 둘 다 optional(`= false`/`undefined`
기본값)이라 `Calendar.test.tsx`의 기존 호출부(둘 다 안 넘김)가 그대로 통과한다 — 확인 완료
(현재 유닛 테스트는 `WEB_GRID_HEIGHT_PX`나 인라인 스타일을 검사하지 않는다).

**검증되지 않은 가정:**
- **"어디에도 `min-height:0`을 주지 않으면 flexbox 자동 최소 크기가 64px×주 수를 지킨다"는
  것이 이 계획 전체의 핵심 가정이다.** 표준 CSS 동작(각 flex 아이템의 `min-height: auto`는
  콘텐츠의 min-content 크기를 바닥으로 삼는다)에 근거했지만 Chromium 실제 렌더링으로
  Task 1 Step 4에서 처음 확인된다. 만약 브라우저가 예상과 다르게 행을 64px 밑으로 찌그러뜨리면,
  `calendar-week-grid`에 `min-height: ${weeks.length * 64}px`를 명시적으로 얹는 방식으로
  바꾼다(그래도 `min-height:0`은 여전히 안 쓴다).
- `AC-HOMECAL-68`(6주 달 총높이 동일, `900px`)이 `900px`에서 계속 성립하려면 그 뷰포트의
  `flex:1` 여유 공간이 `64px×6=384px`보다 커야 한다 — 기존 크롬(상단바·팔로우 레일·월 헤더)이
  `900-384`보다 작다는 뜻인데, 기존 테스트가 이미 `900px`에서 통과해왔으므로 가능성이 높지만
  Task 1 Step 4에서 실측으로 확정한다.
- Task 2의 첫 행/첫 열 테두리 생략 규칙(중복 방지)은 스펙 문서에 명시되지 않은 구현 판단이다 —
  시각적으로 목업과 다르게 보이면 Task 2 안에서 조정한다.
