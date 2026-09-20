# 홈 달력 목업 정합성 보정 구현 계획

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.

**Spec:** `docs/specs/2026-09-20-home-calendar-mockup-fidelity.md`

**Goal:** 배포된 홈 달력 화면(모바일+웹)이 `HOME-CALENDAR.md` 목업의 색·간격·타이포·레이아웃과
일치한다. 새 기능은 없다 — 기존 화면의 시각 정합성만 고친다.

**Architecture:** 색·간격 값 대부분은 목업 리터럴을 그대로 쓰거나(요일 헤더·날짜 색·기록 점),
잠긴 스케일(간격 6단계·타입 7단계)에 반올림하거나 새 단계를 추가한다(월 라벨 22px·목록
캡션 11.5px·카드 수치 17px — `design-system-v2`가 "각 스펙이 실제로 쓸 때 추가한다"고 명시한
방식). 웹 우측 컬럼의 원장 행→카드 전환이 유일한 구조 변경이다. 다크 모드 색은 목업에 없어
기존 `ink`/`ink-2`/`ink-3` 다크 토큰을 재사용하고 부족한 한 단계만 새로 추가한다.

**작업 위치:** `frontend/`

**반드시 먼저 읽을 것:** `CLAUDE.md`(루트) → `frontend/CLAUDE.md` → `docs/conventions/frontend.md` → `docs/conventions/git.md`

---

## AC 커버리지 매핑

| AC ID | 요약 | 담당 태스크 | 검증 방식 |
|---|---|---|---|
| AC-HOMECAL-92~94 | 요일 헤더 스타일·색 | Task 1 | 컴포넌트 테스트 |
| AC-HOMECAL-95~99, 98a, 98b | 날짜 색 4상태 + 다크모드 | Task 1 | 컴포넌트 테스트 |
| AC-HOMECAL-100~101 | 기록 점 gap·빈 날 자리 | Task 2 | 컴포넌트 테스트 |
| AC-HOMECAL-118 | 웹 기록 점 위치(오른쪽) | Task 2 | 컴포넌트 테스트 |
| AC-HOMECAL-102~104 | 팔로우 레일 간격 3곳 | Task 3 | 컴포넌트 테스트 |
| AC-HOMECAL-105~107 | 월 이동 버튼·라벨 타입스케일 | Task 4 | 컴포넌트 테스트 + typography.test.ts |
| AC-HOMECAL-108~109 | 목록 행 캡션 줄 | Task 5 | 컴포넌트 테스트 + typography.test.ts |
| AC-HOMECAL-110~111 | 관계 문구 개인화(캘린더+프로필) | Task 5 | 컴포넌트 테스트 |
| AC-HOMECAL-112~117 | 웹 우측 컬럼 카드 | Task 6 | 컴포넌트 테스트 + typography.test.ts |
| AC-HOMECAL-119~120 | 아바타 3색조 | Task 7 | 컴포넌트 테스트 |

---

## Global Constraints

- 백엔드 변경 0건. 이번 계획은 `frontend/`만 건드린다.
- 새 타입 스케일 단계(`month-label` 22px, `caption` 11.5px, `card-metric` 17px)를 추가할
  때마다 `src/test/typography.test.ts`의 `SCALE` 배열과 `globals.css`의 `@utility` 정의를
  **같은 커밋에서** 함께 고친다 — 하나만 고치면 `AC-DS2-12`(미등록 사용) 또는 `AC-DS2-13`
  (죽은 단계)이 깨진다.
- 간격은 계속 6단계(`gap-1..gap-4, gap-6, gap-12`)만 쓴다. 임의값 금지(`docs/conventions/frontend.md`).
- `Avatar`에 `userId` prop을 추가하면 기존 호출부(`FollowRail.tsx`·`WebTopBar.tsx`) 전부를
  같은 커밋에서 고친다 — 컴파일이 깨진 채로 커밋하지 않는다.

## File Structure

```
frontend/src/
├── app/globals.css                                    (수정) 색 토큰 4~5개, 타입 스케일 3단계
├── test/typography.test.ts                             (수정) SCALE에 3단계 추가
├── components/ui/Avatar.tsx                             (수정) userId 기반 3색조
├── components/layout/WebTopBar.tsx                      (수정) Avatar 호출부에 userId 전달
├── features/calendar/components/Calendar.tsx            (수정) 요일 헤더·날짜색·점 간격·웹 점 위치
├── features/calendar/components/FollowRail.tsx          (수정) 간격 3곳 + Avatar userId 전달
├── features/calendar/components/MonthNav.tsx            (수정) 버튼 44/32 + 라벨 타입스케일
├── features/calendar/components/DayList.tsx             (수정) 캡션 줄 + 관계 문구 + 웹 카드
├── features/calendar/components/DayCard.tsx             (신규) 웹 우측 컬럼 전용 카드
└── features/user/components/UserProfile.tsx             (수정) 관계 문구 개인화

frontend/src/features/calendar/components/
├── Calendar.test.tsx        (수정)
├── FollowRail.test.tsx      (수정)
├── MonthNav.test.tsx        (수정)
└── DayList.test.tsx         (수정)
frontend/src/features/user/components/UserProfile.test.tsx  (수정)
frontend/src/components/ui/Avatar.test.tsx                   (수정)
```

---

## Task 1: 요일 헤더 스타일 + 날짜 색 4단계(+다크)

**Files:**
- Modify: `frontend/src/app/globals.css`
- Modify: `frontend/src/features/calendar/components/Calendar.tsx`
- Test: `frontend/src/features/calendar/components/Calendar.test.tsx`

**Covers:** AC-HOMECAL-92, 93, 94, 95, 96, 97, 98, 99, 98a, 98b

**Interfaces:**
- Produces: CSS 커스텀 프로퍼티 `--weekday-header`, `--weekday-header-weekend`,
  `--date-past-weekday`, `--date-past-weekend`, `--date-future-weekday`,
  `--date-future-weekend`(라이트+다크 각각)

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
it("AC-HOMECAL-92 · 요일 헤더가 mono 10px·대문자·자간 0.08em이다", () => {
  render(<Calendar month="2026-09" days={new Map()} selectedDate={null} onSelect={() => {}} variant="mobile" />);
  const header = screen.getAllByRole("columnheader")[0];
  expect(header).toHaveClass("text-label", "uppercase");
});

it("AC-HOMECAL-95 · 이번달 지난 평일 날짜 색이 --date-past-weekday다", () => {
  // today를 2026-09-19(토)로 고정하고 2026-09-14(월, 지난 평일) 셀의 day-number에
  // style.color 또는 className이 --date-past-weekday를 참조하는지 확인
});

it("AC-HOMECAL-98a · 다크 모드에서 지난 평일 색이 --ink(다크)와 같다", () => {
  // globals.css의 --date-past-weekday가 다크 블록에서 var(--ink)로 재정의됨을
  // jsdom computed style이 아니라 globals.css 자체를 읽어 검증(다른 e2e/spacing.test.ts와
  // 같은 방식 — CSS 커스텀 프로퍼티 값은 jsdom이 실제로 계산해주지 않는다)
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm test -- Calendar`
Expected: FAIL — 요일 헤더에 클래스가 없고, 날짜 숫자에 색 로직 자체가 없다.

- [ ] **Step 3: 최소 구현**

`globals.css`에 추가(`:root`):

```css
--weekday-header: oklch(0.58 0.02 70);
--weekday-header-weekend: oklch(0.62 0.02 70);
--date-past-weekday: oklch(0.3 0.015 60);
--date-past-weekend: oklch(0.5 0.015 60);
--date-future-weekday: oklch(0.72 0.012 70);
--date-future-weekend: oklch(0.78 0.012 70);
```

다크 미디어 쿼리 블록(`prefers-color-scheme: dark`)과 `[data-theme="dark"]` 블록 양쪽에:

```css
--weekday-header: var(--ink-3);
--weekday-header-weekend: var(--ink-3);
--date-past-weekday: var(--ink);
--date-past-weekend: var(--ink-2);
--date-future-weekday: var(--ink-3);
--date-future-weekend: oklch(0.55 0.012 70);
```

`Calendar.tsx`의 요일 헤더에 `text-label uppercase` 클래스 + 평일/주말 색 분기(`columnIndex <
5 ? "text-[var(--weekday-header)]" : "text-[var(--weekday-header-weekend)]"` — 색은 토큰
참조라 `NOT_A_SIZE` 예외 대상이라 `AC-DS2-12`에 안 걸린다).

날짜 숫자에 `dateColorClassName(cell.date, today, columnIndex)` 헬퍼 추가 — `cell.date <
today`(지난 날)·`columnIndex >= 5`(주말) 조합으로 4개 CSS 변수 중 하나를 인라인
`style={{ color: "var(--...)" }}`로 적용. 단, 선택됨/오늘인 셀은 기존
`dayNumberClassName`이 이미 텍스트 색을 고정하므로(흰 텍스트 또는 기본색) 이 스타일을
덮어쓰지 않게 조건부로 뺀다(AC-HOMECAL-99 회귀 확인).

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `pnpm test -- Calendar`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
pnpm format && pnpm lint:fix
git add . && git commit -m "fix(calendar): 요일 헤더·날짜 색을 목업과 일치시킨다 (AC-HOMECAL-92~99·98a·98b)"
```

---

## Task 2: 기록 점 간격·빈 날 자리·웹 점 위치

**Files:**
- Modify: `frontend/src/features/calendar/components/Calendar.tsx`
- Test: `frontend/src/features/calendar/components/Calendar.test.tsx`

**Covers:** AC-HOMECAL-100, 101, 118

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
it("AC-HOMECAL-100 · 날짜 숫자와 기록 점 사이 gap이 4px다", () => {
  // 기록 1건인 셀의 wrapper(button)에 gap-1(4px) 클래스가 있는지, 또는 점 span의
  // margin-top이 4px인지 확인
});

it("AC-HOMECAL-101 · 기록 0건인 날도 점 자리(투명)가 렌더된다", () => {
  render(<Calendar month="2026-09" days={new Map()} selectedDate={null} onSelect={() => {}} variant="mobile" />);
  const cells = screen.getAllByRole("button");
  const dot = within(cells[0]).getByTestId(/record-dot|record-dot-placeholder/);
  expect(dot).not.toHaveStyle({ backgroundColor: "var(--signal-record)" });
});

it("AC-HOMECAL-118 · 웹에서 기록 점이 날짜 숫자 오른쪽 6px에 렌더된다", () => {
  // variant="web"일 때 button의 flex-direction이 row이고 점이 숫자 뒤(오른쪽)에 오는지,
  // gap이 6px 근사(간격 스케일에 6px가 없으므로 이 자리만 임의값 예외로 허용하거나
  // gap-1(4px)/gap-2(8px) 중 하나로 반올림 — Step 3에서 실측 후 결정)
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm test -- Calendar`
Expected: FAIL — 현재 점 span은 `count > 0`일 때만 렌더되고(자리 생략), gap 클래스가 없다.

- [ ] **Step 3: 최소 구현**

`count > 0 &&` 조건을 제거하고 항상 점 span을 렌더하되, `backgroundColor`를 `count > 0 ?
"var(--signal-record)" : "transparent"`로 조건부 처리. 날짜 숫자를 감싼 flex 컨테이너에
`gap-1`(4px) 추가.

웹 점 위치: `isWeb`이면 날짜 숫자와 점을 감싸는 최상위 flex를 `flex-row items-center`로
바꾸고(현재는 항상 `flex-col`), 점을 숫자 뒤에 배치. gap 6px는 스케일에 없으므로 **Step 3
실행 전에 8px(`gap-2`)로 반올림한다** — 6은 4·8 중 8에 더 가깝다(`|6-4|=2, |6-8|=2`는
동점이지만 이 스펙은 홈 달력 다른 항목에서 동점을 전부 "올림"으로 정했으므로 일관되게
8px를 쓴다).

> **검증되지 않은 가정 아님 — 계획 단계에서 확정:** 위 6px→8px 반올림은 스펙에 없던 값이라
> 계획 자체 검토에서 발견됐다. 스펙에 AC를 추가하지 않고 여기서 "동점은 올림" 규칙(Track A
> 인터뷰에서 이미 확정)을 그대로 적용한다.

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `pnpm test -- Calendar`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
pnpm format && pnpm lint:fix
git add . && git commit -m "fix(calendar): 기록 점 간격을 고치고 빈 날 자리를 유지한다 (AC-HOMECAL-100·101·118)"
```

---

## Task 3: 팔로우 레일 간격

**Files:**
- Modify: `frontend/src/features/calendar/components/FollowRail.tsx`
- Test: `frontend/src/features/calendar/components/FollowRail.test.tsx`

**Covers:** AC-HOMECAL-102, 103, 104

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
it("AC-HOMECAL-102 · 아이템 간 gap이 16px(gap-4)다", () => {
  render(<FollowRail me={ME} mutuals={[A, B]} selectedUserId={ME.id} onSelect={() => {}} variant="mobile" />);
  expect(screen.getByRole("tablist")).toHaveClass("gap-4");
});

it("AC-HOMECAL-103 · 아바타-라벨 gap이 8px(gap-2)다", () => {
  // 모바일 RailTab의 flex-col 컨테이너 className에 gap-2가 있는지
});

it("AC-HOMECAL-104 · 웹 선택 pill padding이 8px 16px 8px 8px(py-2 pr-4 pl-2)다", () => {
  render(<FollowRail me={ME} mutuals={[]} selectedUserId={ME.id} onSelect={() => {}} variant="web" />);
  const tab = screen.getByRole("tab", { name: /나/ });
  expect(tab).toHaveClass("py-2", "pr-4", "pl-2");
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm test -- FollowRail`
Expected: FAIL — 현재 `gap-3`·`gap-1`·`py-1 pr-3 pl-1`.

- [ ] **Step 3: 최소 구현**

`gap-3` → `gap-4`(최상위 tablist), 모바일 `gap-1` → `gap-2`(아바타-라벨), 웹 pill
`py-1 pr-3 pl-1` → `py-2 pr-4 pl-2`.

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `pnpm test -- FollowRail`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
pnpm format && pnpm lint:fix
git add . && git commit -m "fix(calendar): 팔로우 레일 간격을 스케일에 맞춰 반올림한다 (AC-HOMECAL-102·103·104)"
```

---

## Task 4: 월 이동 버튼(44/32) + 월 라벨 타입스케일

**Files:**
- Modify: `frontend/src/app/globals.css`
- Modify: `frontend/src/test/typography.test.ts`
- Modify: `frontend/src/features/calendar/components/MonthNav.tsx`
- Test: `frontend/src/features/calendar/components/MonthNav.test.tsx`

**Covers:** AC-HOMECAL-105, 106, 107

**Interfaces:**
- Produces: `text-month-label` 타입 스케일 유틸리티(mono 22px)

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
it("AC-HOMECAL-105 · 월 이동 버튼 클릭 영역이 44×44px다", () => {
  render(<MonthNav month="2026-09" totalCount={0} onPrev={() => {}} onNext={() => {}} />);
  const prev = screen.getByRole("button", { name: "이전 달" });
  expect(prev).toHaveClass("min-h-11", "min-w-11"); // 기존 Button 컴포넌트가 이미 보장
});

it("AC-HOMECAL-106 · 월 이동 버튼 시각 박스가 32×32px, radius 7px다", () => {
  render(<MonthNav month="2026-09" totalCount={0} onPrev={() => {}} onNext={() => {}} />);
  const visual = screen.getByRole("button", { name: "이전 달" }).querySelector("span");
  expect(visual).toHaveClass("h-8", "w-8", "rounded-[7px]");
});

it("AC-HOMECAL-107 · 월 라벨이 text-month-label(mono 22px)이다", () => {
  render(<MonthNav month="2026-09" totalCount={0} onPrev={() => {}} onNext={() => {}} />);
  expect(screen.getByText("2026.09")).toHaveClass("text-month-label");
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm test -- MonthNav`
Expected: FAIL — 버튼이 글자만 직접 렌더(내부 span 없음), 라벨이 `text-card-title`(18px)다.

- [ ] **Step 3: 최소 구현**

`globals.css`에 추가:

```css
@utility text-month-label {
  font-family: var(--font-mono);
  font-size: 22px;
  font-weight: 500;
  letter-spacing: -0.03em;
}
```

`typography.test.ts`의 `SCALE`에 `"month-label"` 추가(주석: "AC-HOMECAL-107 · 월 라벨").

`MonthNav.tsx`:

```tsx
<p className="text-month-label">{year}.{mon}</p>
...
<Button aria-label="이전 달" onClick={onPrev}>
  <span className="flex h-8 w-8 items-center justify-center rounded-[7px] border border-border">
    ‹
  </span>
</Button>
<Button aria-label="다음 달" onClick={onNext} disabled={isCurrentMonth}>
  <span className="flex h-8 w-8 items-center justify-center rounded-[7px] border border-border">
    ›
  </span>
</Button>
```

`Button`은 이미 `min-h-11 min-w-11`을 보장하므로 수정 불필요.

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `pnpm test -- MonthNav && pnpm test -- typography`
Expected: PASS. `pnpm e2e -- touch-targets`도 재확인(클릭 영역이 여전히 44px임을 실제
렌더로 검증하는 기존 스위트).

- [ ] **Step 5: 커밋**

```bash
pnpm format && pnpm lint:fix
git add . && git commit -m "fix(calendar): 월 이동 버튼 시각 크기와 라벨 타입스케일을 목업과 맞춘다 (AC-HOMECAL-105·106·107)"
```

---

## Task 5: 목록 행 캡션 줄 + 관계 문구 개인화

**Files:**
- Modify: `frontend/src/app/globals.css`
- Modify: `frontend/src/test/typography.test.ts`
- Modify: `frontend/src/features/calendar/components/DayList.tsx`
- Modify: `frontend/src/features/user/components/UserProfile.tsx`
- Test: `frontend/src/features/calendar/components/DayList.test.tsx`
- Test: `frontend/src/features/user/components/UserProfile.test.tsx`

**Covers:** AC-HOMECAL-108, 109, 110, 111

**Interfaces:**
- Produces: `text-caption` 타입 스케일 유틸리티(sans 11.5px)
- Consumes: `DayList`가 이미 받는 `ownerNickname` prop(신규 파라미터 없음)

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
it("AC-HOMECAL-108 · 별점이 있으면 시각·별점 캡션이 text-caption으로 렌더된다", () => {
  const log = { ...BASE_LOG, brewedAt: "2026-09-19T05:20:00Z", rating: 4 };
  render(<DayList date="2026-09-19" logs={[log]} variant="mobile" />);
  const caption = screen.getByText(/14:20 · ★ 4/);
  expect(caption).toHaveClass("text-caption");
});

it("AC-HOMECAL-109 · 별점이 없으면 캡션에 시각만 나온다", () => {
  const log = { ...BASE_LOG, brewedAt: "2026-09-19T05:20:00Z", rating: undefined };
  render(<DayList date="2026-09-19" logs={[log]} variant="mobile" />);
  expect(screen.getByText("14:20")).toBeInTheDocument();
  expect(screen.queryByText(/★/)).not.toBeInTheDocument();
});

it("AC-HOMECAL-110 · 관계 문구에 상대 닉네임이 보간된다", () => {
  render(<DayList date="2026-09-19" logs={[BASE_LOG]} ownerNickname="지연" variant="mobile" />);
  expect(
    screen.getByText("맞팔로우 상태여서 지연 님의 기록이 보입니다."),
  ).toBeInTheDocument();
});
```

```tsx
it("AC-HOMECAL-111 · 프로필 관계 문구에 닉네임이 보간된다", () => {
  // usePublicProfile·useFollowStatus 목으로 mutual:true, nickname:"지연" 세팅 후
  expect(
    screen.getByText("맞팔로우 상태여서 지연 님의 기록이 보입니다."),
  ).toBeInTheDocument();
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm test -- DayList && pnpm test -- UserProfile`
Expected: FAIL — 캡션 줄이 아예 없고, 관계 문구가 고정 텍스트다.

- [ ] **Step 3: 최소 구현**

`globals.css`에 `@utility text-caption { font-size: 11.5px; }`(sans, 기본 폰트 상속).
`typography.test.ts`의 `SCALE`에 `"caption"` 추가.

`DayList.tsx`의 `DayListRow`에 `formatCaption(log.brewedAt, log.rating)` 추가(KST HH:mm
포맷 + `log.rating !== undefined`일 때만 `· ★ {rating}`), `<p className="text-caption
text-ink-3">`로 레시피명 아래 렌더.

`DayList.tsx`의 관계 문구를 `` `맞팔로우 상태여서 ${ownerNickname} 님의 기록이 보입니다.` ``로
변경.

`UserProfile.tsx`의 `noticeFor`에 `nickname: string` 파라미터 추가,
`"맞팔로우 — 서로의 기록이 보입니다"` → `` `맞팔로우 상태여서 ${nickname} 님의 기록이
보입니다.` ``. 호출부(`FollowSection`)에 `profile.data.nickname` 전달.

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `pnpm test -- DayList && pnpm test -- UserProfile && pnpm test -- typography`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
pnpm format && pnpm lint:fix
git add . && git commit -m "fix(calendar): 목록 행 캡션 줄을 추가하고 관계 문구에 닉네임을 보간한다 (AC-HOMECAL-108·109·110·111)"
```

---

## Task 6: 웹 우측 컬럼 — 카드로 교체

**Files:**
- Create: `frontend/src/features/calendar/components/DayCard.tsx`
- Modify: `frontend/src/app/globals.css`
- Modify: `frontend/src/test/typography.test.ts`
- Modify: `frontend/src/features/calendar/components/DayList.tsx`
- Test: `frontend/src/features/calendar/components/DayCard.test.tsx`(신규)
- Test: `frontend/src/features/calendar/components/DayList.test.tsx`

**Covers:** AC-HOMECAL-112, 113, 114, 115, 116, 117

**Interfaces:**
- Produces: `DayCard({ log, recipeLabel, roastLevel }): JSX.Element`, `text-card-metric`
  타입 스케일 유틸리티(mono 17px)
- Consumes: `DayList`의 기존 `variant === "web"` 분기 — `web`일 때 `DayListRow` 대신
  `DayCard`를 렌더한다

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
it("AC-HOMECAL-112 · 웹에서 기록이 카드(paper·border·radius 10·padding 20)로 렌더된다", () => {
  render(<DayList date="2026-09-19" logs={[BASE_LOG]} recipeLabels={LABELS} variant="web" />);
  const card = screen.getByTestId("day-card");
  expect(card).toHaveClass("bg-paper", "border", "rounded-lg", "p-5", "gap-3.5" /* 실측 후 스케일 매핑 */);
});

it("AC-HOMECAL-113 · 카드 상단에 roast dot·이름 15.5px·캡션 12px·대표 수치가 있다", () => {
  render(<DayList date="2026-09-19" logs={[BASE_LOG]} recipeLabels={LABELS} variant="web" />);
  expect(screen.getByTestId("roast-dot")).toBeInTheDocument();
  expect(screen.getByText(LABELS.get(BASE_LOG.recipeId)!)).toHaveClass("text-[15.5px]");
});

it("AC-HOMECAL-114 · 카드 대표 수치가 text-card-metric(mono 17px)이다", () => {
  render(<DayList date="2026-09-19" logs={[BASE_LOG]} recipeLabels={LABELS} variant="web" />);
  expect(screen.getByTestId("day-card-metric")).toHaveClass("text-card-metric");
});

it("AC-HOMECAL-116 · 메모가 있으면 13px italic 줄이 렌더된다", () => {
  const log = { ...BASE_LOG, overallNote: "산미가 좋았다" };
  render(<DayList date="2026-09-19" logs={[log]} recipeLabels={LABELS} variant="web" />);
  expect(screen.getByText("산미가 좋았다")).toHaveClass("italic");
});

it("AC-HOMECAL-117 · 메모가 없으면 메모 줄이 없다", () => {
  const log = { ...BASE_LOG, overallNote: undefined };
  render(<DayList date="2026-09-19" logs={[log]} recipeLabels={LABELS} variant="web" />);
  expect(screen.queryByTestId("day-card-note")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm test -- DayCard && pnpm test -- DayList`
Expected: FAIL — `DayCard` 파일 자체가 없고, 웹도 `DayListRow`(원장 행)를 그대로 쓴다.

- [ ] **Step 3: 최소 구현**

`globals.css`에 `@utility text-card-metric { font-family: var(--font-mono); font-size:
17px; }`. `typography.test.ts` SCALE에 `"card-metric"` 추가.

`DayCard.tsx`(신규) — `paper` 배경(`bg-paper`) + `border border-border` + `rounded-lg`(10px는
기존 역할 매핑상 `rounded-lg`가 8px라 정확히 10px는 아니다. **검증되지 않은 가정**으로
Step 4에서 `rounded-[10px]`(임의값)이 색·모서리 규칙(`docs/conventions/frontend.md`의
"모서리는 역할로 정해진다")과 충돌하지 않는지 확인 — 충돌하면 `rounded-lg`(8px)로 근사한다)
+ `p-5`(20px, 간격 스케일에 있음) + 내부 `gap-3.5`(13px는 스케일에 없다 — `gap-3`(12px)로
반올림, `[제안 후 승인]`).

상단 행: `RoastDot`(10px, 기존 `RoastDot` 컴포넌트 재사용) + 레시피명(`text-[15.5px]
font-semibold` — 15.5px는 스케일에 없는 애매한 값이라 **Step 4에서 실제로 15px(`body`
역할)로 반올림할지 확정**한다, 15.5와 15의 차이가 0.5px라 육안 구분이 어렵다는 판단이면
`text-body font-semibold`로 대체) + 캡션(`text-body-sm`, 12px 목업 대비 13px 기존 스케일로
근사) + 우측 `text-card-metric`.

1px divider(`border-t border-divider`) 아래 태그 줄(비율 `accent-wash` 배지, 온도, 시간,
별점 — 기존 `Badge` 컴포넌트 재사용). 메모는 `log.overallNote !== undefined`일 때만 `text-body-sm
italic`.

`DayList.tsx`에서 `variant === "web"`이면 `DayListRow` 대신 `DayCard`를 렌더하도록 분기.

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `pnpm test -- DayCard && pnpm test -- DayList && pnpm test -- typography`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
pnpm format && pnpm lint:fix
pnpm typecheck && pnpm lint && pnpm test && pnpm build
git add . && git commit -m "fix(calendar): 웹 우측 컬럼을 원장 행에서 카드로 교체한다 (AC-HOMECAL-112~117)"
```

---

## Task 7: 아바타 3색조

**Files:**
- Modify: `frontend/src/components/ui/Avatar.tsx`
- Modify: `frontend/src/features/calendar/components/FollowRail.tsx`
- Modify: `frontend/src/components/layout/WebTopBar.tsx`
- Test: `frontend/src/components/ui/Avatar.test.tsx`

**Covers:** AC-HOMECAL-119, 120

**Interfaces:**
- Consumes: `Avatar({ nickname, profileImageUrl, size, userId })` — `userId` 필수 파라미터
  추가(기존 두 호출부 모두 이미 `id`를 갖고 있어 전달만 하면 된다)

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
it("AC-HOMECAL-119 · userId % 3에 따라 3색 중 하나가 배경색이 된다", () => {
  const { rerender } = render(<Avatar nickname="A" size={32} userId={1} />);
  expect(screen.getByText("A")).toHaveStyle({ backgroundColor: "oklch(0.88 0.008 80)" }); // 1 % 3 = 1
  rerender(<Avatar nickname="B" size={32} userId={3} />);
  expect(screen.getByText("B")).toHaveStyle({ backgroundColor: "oklch(0.88 0.02 60)" }); // 3 % 3 = 0
});

it("AC-HOMECAL-120 · 같은 userId는 항상 같은 색이다", () => {
  const { rerender } = render(<Avatar nickname="A" size={32} userId={7} />);
  const first = screen.getByText("A").style.backgroundColor;
  rerender(<Avatar nickname="A2" size={32} userId={7} />);
  expect(screen.getByText("A2").style.backgroundColor).toBe(first);
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm test -- Avatar`
Expected: FAIL(컴파일 에러 — `userId`가 아직 필수 prop이 아니다).

- [ ] **Step 3: 최소 구현**

```tsx
const AVATAR_TONES = [
  "oklch(0.88 0.02 60)",
  "oklch(0.88 0.008 80)",
  "oklch(0.88 0.015 70)",
] as const;

function toneFor(userId: number): string {
  return AVATAR_TONES[userId % AVATAR_TONES.length];
}
```

`Avatar`에 `userId: number` prop 추가, `bg-sunken` 클래스 제거하고 `style={{
backgroundColor: toneFor(userId), width: size, height: size }}`로 교체(사진 있는 분기는
변경 없음).

`FollowRail.tsx`의 두 `<Avatar>` 호출에 `userId={profile.id}` 추가.
`WebTopBar.tsx`의 `<Avatar>` 호출에 `userId={<현재 사용자 id>}` 추가(이미 해당 컴포넌트
스코프에 있는 사용자 정보에서 가져온다).

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `pnpm test -- Avatar && pnpm test -- FollowRail`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
pnpm format && pnpm lint:fix
pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm test:worker
git add . && git commit -m "fix(avatar): userId 기반 3색조를 추가한다 (AC-HOMECAL-119·120)"
```

---

## 완료 기준

- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` 통과
- [ ] `pnpm test:worker` 통과
- [ ] `./scripts/check-spec-coverage.sh` 통과(루트에서)
- [ ] 스펙의 `status`를 `구현완료`로 변경
- [ ] 회귀 확인: 기존 `AC-HOMECAL-01~91`(홈 달력 원본 스펙)·`AC-TOUCH-01`(터치 타깃)·
      `AC-DS2-12/13`(타입 스케일) 전부 통과
- [ ] 수동 확인 없음(스펙에 명시됨)

---

## 자체 검토 결과

**AC 커버리지:** 스펙의 AC 31개(`92~120`, `98a`, `98b` 포함) 중 31개가 태스크에 매핑됨.

**자리표시자 검사:** `TODO`, `TBD`, "나중에", "비슷하게" 없음.

**타입 일관성:** `Avatar`의 `userId` prop(Task 7)은 기존 두 호출부가 이미 갖고 있는
`profile.id`/사용자 id를 그대로 전달하는 것이라 새 데이터 흐름이 필요 없음을 확인함.
`DayCard`(Task 6)는 `DayList`가 이미 갖고 있는 `recipeLabels`·`log` 데이터만 쓴다.

**검증되지 않은 가정:**
- **카드 `radius 10px`이 기존 "모서리는 역할로 정해진다" 규칙(면=8px, 컨트롤=6px)과
  충돌하는지** Task 6 Step 4에서 확인한다. 충돌하면 `rounded-lg`(8px)로 근사한다.
- **레시피명 15.5px·캡션 12px가 스케일 근사(15px/13px)로 충분한지, 아니면 새 단계가
  필요한지** Task 6 Step 3에서 실제 렌더를 보고 결정한다 — 이번 인터뷰에서 "필요한 값마다
  새 단계 추가"로 정했으므로 원칙적으로는 정확히 15.5px·12px 단계를 새로 추가해야 하지만,
  기존 13px(`body-sm`)·15px(`body`)와 차이가 0.5~1px로 육안 구분이 어려우면 예외적으로
  근사하는 것을 계획 단계에서 제안한다 — Task 6 커밋 전에 실제로 렌더해 확인한다.
- **Task 2의 웹 점 간격 6px→8px 반올림**은 스펙에 없던 세부사항이라 계획에서 자체적으로
  "동점은 올림" 규칙을 적용했다(위 Task 2 참조).
