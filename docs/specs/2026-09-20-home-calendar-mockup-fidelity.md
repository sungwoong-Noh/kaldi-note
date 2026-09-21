---
id: HOMECAL
title: 홈 달력 목업 정합성 보정
status: 승인
plan: docs/plans/2026-09-20-plan-home-calendar-mockup-fidelity.md
---

# 홈 달력 목업 정합성 보정 스펙

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.
> **모든 인수 조건은 자동화된 테스트로 옮길 수 있어야 한다.**
>
> 이 스펙은 `docs/specs/2026-09-19-home-calendar.md`·`2026-09-20-calendar-grid-responsive.md`
> (둘 다 `구현완료`)를 대체하지 않고 **보강**한다. AC ID 접두어 `HOMECAL`을 그대로 이어 쓴다
> (마지막 번호 `AC-HOMECAL-91` 다음부터).

## 무엇을

배포된 홈 달력 화면이 `docs/design/design_handoff_kaldi_note/HOME-CALENDAR.md` 목업과
세부 수치(색·간격·타이포·레이아웃)에서 여러 곳 어긋난다는 것이 확인됐다. 이 스펙은 그 격차를
항목별로 못박아 목업과 일치시킨다. 새 기능이 아니라 **기존 화면의 시각·데이터 정합성 보정**이다.

### 범위 밖 (Non-goals)

- 팔로우 레일의 「찾기」(검색) 탭. `2026-09-19-home-calendar.md`의 Non-goals가 이미 명시적으로
  제외했고(`2026-09-05-web-follow.md` 참조), 이 스펙도 그 결정을 유지한다.
- 웹 달력 셀 padding을 목업 값(9px 10px)으로 되돌리는 것. `AC-HOMECAL-88`이 8px/12px를 이미
  잠갔고, 이번 조사에서 그것이 의도된 결정임을 재확인했다 — 건드리지 않는다.
- 아바타 사진 업로드·변경 기능. 이번 스펙은 사진이 없을 때의 이니셜 아바타 색상만 다룬다.
- 팔로우 관계가 아닌 다른 화면(레시피·기록 목록 등)의 색·간격 재검토. 이 스펙은 홈 달력
  화면과, 관계 문구를 공유하는 프로필 화면(`UserProfile.tsx`)에만 미친다.

## 왜

목업(`HOME-CALENDAR.md`)은 hifi로 확정된 색·타입·간격 값을 담고 있는데, 처음 구현 시
일부가 스펙 문서로 옮겨지지 못한 채 누락됐다(요일 헤더 스타일 미적용, 날짜 색 미구현,
기록 점 간격 없음 등). 사용자가 실제 화면을 보고 목업과의 차이를 지적하면서 발견됐다.
고치지 않으면 "hifi 목업"이라는 전제가 무의미해진다.

## 용어

| 용어 | 정의 |
|---|---|
| 시각 박스 | 버튼의 실제 클릭 영역(터치 타깃)과 분리된, 눈에 보이는 배경·테두리 상자 |
| 관계 문구 | 상대와 나의 팔로우 관계를 설명하는 한 문장(예: "맞팔로우 상태여서 ○○ 님의 기록이 보입니다") |

## 데이터

스키마 변경 없음. `avatarTone`은 서버 필드를 추가하지 않고 프론트가 `userId`로 해시해
계산한다(아래 AC-HOMECAL-118).

## API

없음 — 기존 엔드포인트 그대로 쓴다.

---

## 어떻게 동작 — 인수 조건

### 타이포·색 — 요일 헤더 · 날짜 숫자

#### AC-HOMECAL-92 · 요일 헤더가 mono 10px·대문자·자간 0.08em으로 렌더된다

- **Given** 홈 달력 화면(모바일)
- **When** 요일 헤더(`월 화 수 목 금 토 일`) 7칸을 렌더한다
- **Then** 각 칸의 `font-family`가 mono, `font-size`가 10px, `text-transform`이 uppercase,
  `letter-spacing`이 0.08em이다
- **검증** 컴포넌트 테스트 `Calendar.test.tsx`

#### AC-HOMECAL-93 · 요일 헤더 평일 색이 oklch(0.58 0.02 70)이다

- **Given** 요일 헤더의 월~금 칸
- **When** 렌더한다
- **Then** 글자 색이 `oklch(0.58 0.02 70)`(라이트)이다
- **검증** 컴포넌트 테스트 `Calendar.test.tsx`

#### AC-HOMECAL-94 · 요일 헤더 주말 색이 oklch(0.62 0.02 70)이다

- **Given** 요일 헤더의 토·일 칸
- **When** 렌더한다
- **Then** 글자 색이 `oklch(0.62 0.02 70)`(라이트)이다
- **검증** 컴포넌트 테스트 `Calendar.test.tsx`

#### AC-HOMECAL-95 · 이번 달 지난 날짜(평일) 색이 oklch(0.3 0.015 60)이다

- **Given** 이번 달 안의 오늘보다 이전 날짜이고 평일(월~금)인 셀
- **When** 렌더한다
- **Then** 날짜 숫자 색이 `oklch(0.3 0.015 60)`이다
- **검증** 컴포넌트 테스트 `Calendar.test.tsx`

#### AC-HOMECAL-96 · 이번 달 지난 날짜(주말) 색이 oklch(0.5 0.015 60)이다

- **Given** 이번 달 안의 오늘보다 이전 날짜이고 주말(토·일)인 셀
- **When** 렌더한다
- **Then** 날짜 숫자 색이 `oklch(0.5 0.015 60)`이다
- **검증** 컴포넌트 테스트 `Calendar.test.tsx`

#### AC-HOMECAL-97 · 미래 날짜(평일) 색이 oklch(0.72 0.012 70)이다

- **Given** 오늘보다 미래인 날짜이고 평일인 셀(같은 달 안)
- **When** 렌더한다
- **Then** 날짜 숫자 색이 `oklch(0.72 0.012 70)`이다
- **검증** 컴포넌트 테스트 `Calendar.test.tsx`

#### AC-HOMECAL-98 · 미래 날짜(주말) 색이 oklch(0.78 0.012 70)이다

- **Given** 오늘보다 미래인 날짜이고 주말인 셀(같은 달 안)
- **When** 렌더한다
- **Then** 날짜 숫자 색이 `oklch(0.78 0.012 70)`이다
- **검증** 컴포넌트 테스트 `Calendar.test.tsx`

#### AC-HOMECAL-98a · 다크 모드 날짜 색은 기존 ink 스케일을 재사용한다

- **Given** 다크 모드
- **When** AC-HOMECAL-95~98의 4가지 상태를 각각 렌더한다
- **Then** 지난날-평일은 `--ink`(다크, `oklch(0.95 0.005 85)`), 지난날-주말은 `--ink-2`(다크,
  `oklch(0.82 0.008 78)`), 미래-평일은 `--ink-3`(다크, `oklch(0.68 0.01 70)`), 미래-주말은
  새 토큰 `--date-future-weekend`(다크, `oklch(0.55 0.012 70)`)를 쓴다 — 목업이 다크 변형을
  주지 않아 프로젝트의 기존 ink 스케일로 대응시킨 값이다(`[제안 후 승인]`)
- **검증** 컴포넌트 테스트 `Calendar.test.tsx`(다크 모드 렌더)

#### AC-HOMECAL-98b · 다크 모드 요일 헤더 색은 평일·주말 모두 ink-3를 쓴다

- **Given** 다크 모드
- **When** 요일 헤더를 렌더한다
- **Then** 평일·주말 모두 `--ink-3`(다크, `oklch(0.68 0.01 70)`)를 쓴다 — 라이트 모드의 미세한
  평일/주말 색차는 다크에서는 단일 값으로 단순화한다(`[제안 후 승인]`)
- **검증** 컴포넌트 테스트 `Calendar.test.tsx`(다크 모드 렌더)

#### AC-HOMECAL-99 · 오늘 날짜는 위 4색 규칙을 따르지 않고 선택/오늘 스타일이 우선한다

- **Given** 오늘 날짜 셀
- **When** 선택되지 않은 상태로 렌더한다
- **Then** AC-HOMECAL-95~98의 색 대신 28px 원 + 1px `border` 링 스타일이 적용된다(기존
  `AC-HOMECAL-*`가 이미 검증한 동작 — 회귀 확인만 한다)
- **검증** 컴포넌트 테스트 `Calendar.test.tsx`(기존 테스트 재확인)

### 기록 점

#### AC-HOMECAL-100 · 기록 점과 날짜 숫자 사이 gap이 4px다(선택 여부 무관)

- **Given** 기록이 1건 이상인 날짜 셀(모바일)
- **When** 렌더한다
- **Then** 날짜 숫자와 기록 점 사이 `gap`이 선택 여부와 관계없이 4px다(목업은 5px/4px로
  구분하지만 간격 스케일 4·8·12·16·24·32·48에 5px가 없어 4px로 통일한다 — `docs/conventions/frontend.md`
  「간격은 6단계뿐이다」)
- **검증** 컴포넌트 테스트 `Calendar.test.tsx`

#### AC-HOMECAL-101 · 기록이 없는 날짜도 점과 같은 크기의 투명 자리를 유지한다

- **Given** 기록이 0건인 날짜 셀
- **When** 렌더한다
- **Then** 점 위치에 5px 크기의 요소가 존재하되 `background`가 없다(요소 자체를 생략하지
  않는다) — 기록 있는 날과 없는 날의 날짜 숫자 baseline이 같다
- **검증** 컴포넌트 테스트 `Calendar.test.tsx`

### 팔로우 레일 간격

#### AC-HOMECAL-102 · 팔로우 레일 아이템 간 gap이 16px다

- **Given** 팔로우 레일(모바일)
- **When** 아바타 아이템 2개 이상을 렌더한다
- **Then** 아이템 사이 `gap`이 16px다(목업 14px → 간격 스케일 반올림, `[사용자 결정]`)
- **검증** 컴포넌트 테스트 `FollowRail.test.tsx`

#### AC-HOMECAL-103 · 아바타와 라벨 사이 gap이 8px다

- **Given** 팔로우 레일 아이템 1개
- **When** 렌더한다
- **Then** 아바타와 이름 라벨 사이 `gap`이 8px다(목업 7px → 반올림)
- **검증** 컴포넌트 테스트 `FollowRail.test.tsx`

#### AC-HOMECAL-104 · 웹 팔로우 레일 선택 pill의 padding이 8px 16px 8px 8px다

- **Given** 웹 팔로우 레일에서 선택된 pill
- **When** 렌더한다
- **Then** `padding`이 상 8px / 우 16px / 하 8px / 좌 8px다(목업 6/14/6/6 → 반올림)
- **검증** 컴포넌트 테스트 `FollowRail.test.tsx`(web variant)

### 월 네비게이션

#### AC-HOMECAL-105 · 월 이동 버튼의 클릭 영역이 44×44px다

- **Given** 월 이동 버튼(‹, ›) 2개
- **When** 렌더한다
- **Then** 각 버튼(`<button>`)의 렌더된 `height`·`width`가 44px 이상이다(`AC-TOUCH-01` 유지)
- **검증** 컴포넌트 테스트 `MonthNav.test.tsx` + 기존 `e2e/touch-targets.spec.ts` 재통과

#### AC-HOMECAL-106 · 월 이동 버튼의 시각 박스가 32×32px다

- **Given** 월 이동 버튼 내부 요소
- **When** 렌더한다
- **Then** 버튼 안쪽의 시각적 박스(배경·테두리를 가진 `<span>` 등)의 `height`·`width`가 32px,
  `border-radius`가 7px다
- **검증** 컴포넌트 테스트 `MonthNav.test.tsx`

#### AC-HOMECAL-107 · 월 라벨이 새 타입 스케일 `month-label`(mono 22px)로 렌더된다

- **Given** 월 헤더의 `2026.09` 라벨
- **When** 렌더한다
- **Then** `font-family`가 mono, `font-size`가 22px, `font-weight`가 500,
  `letter-spacing`이 -0.03em이다. `src/test/typography.test.ts`의 `SCALE`에
  `month-label`이 추가되고, `globals.css`에 `@utility text-month-label`이 정의된다
- **검증** 컴포넌트 테스트 `MonthNav.test.tsx` + `src/test/typography.test.ts`(스케일 등록·사용 확인)

### 날짜별 목록

#### AC-HOMECAL-108 · 목록 행에 시각·별점 캡션 줄이 새 타입 스케일 `caption`(sans 11.5px)으로 렌더된다

- **Given** 날짜별 목록의 브루 로그 행 1개(별점이 있는 경우)
- **When** 렌더한다
- **Then** 레시피명 아래에 `{HH:mm} · ★ {rating}` 형식의 캡션 줄이 `font-size` 11.5px,
  색 `ink-3`로 렌더된다. `SCALE`에 `caption`이 추가되고 `@utility text-caption`이 정의된다
- **검증** 컴포넌트 테스트 `DayList.test.tsx` + `src/test/typography.test.ts`

#### AC-HOMECAL-109 · 별점이 없으면 캡션 줄에 시각만 렌더된다

- **Given** 별점이 `null`인 브루 로그 행
- **When** 렌더한다
- **Then** 캡션 줄이 `{HH:mm}`만 표시하고 `· ★`는 생략된다
- **검증** 컴포넌트 테스트 `DayList.test.tsx`

### 관계 문구

#### AC-HOMECAL-110 · 남의 달력 하단 관계 문구에 상대 닉네임이 보간된다

- **Given** 맞팔로우 상태인 사용자 `지연`의 달력을 보는 중
- **When** 날짜별 목록 하단 관계 문구를 렌더한다
- **Then** 문구가 정확히 `"맞팔로우 상태여서 지연 님의 기록이 보입니다."`다(닉네임은 이미
  화면에 로드된 팔로우 레일 데이터에서 클라이언트가 보간한다 — 새 백엔드 필드 없음)
- **검증** 컴포넌트 테스트 `DayList.test.tsx`

#### AC-HOMECAL-111 · 프로필 화면의 관계 문구도 동일하게 닉네임을 보간한다

- **Given** `/u/[id]` 프로필 화면, 맞팔로우 상태
- **When** 관계 문구를 렌더한다
- **Then** 문구가 `"맞팔로우 상태여서 {닉네임} 님의 기록이 보입니다."` 형식으로 렌더된다(기존
  고정 문구 `"맞팔로우 — 서로의 기록이 보입니다"`를 대체)
- **검증** 컴포넌트 테스트 `UserProfile.test.tsx`

### 웹 우측 컬럼 — 카드

#### AC-HOMECAL-112 · 웹 우측 컬럼의 기록이 원장 행이 아니라 카드로 렌더된다

- **Given** 웹(≥1100px)에서 날짜를 선택한 상태
- **When** 우측 컬럼의 기록 목록을 렌더한다
- **Then** 각 기록이 `paper` 배경 + 1px `border` + `border-radius` 10px + `padding` 20px +
  내부 `gap` 13px인 카드로 렌더된다(기존 `DayListRow` 원장 행 재사용을 대체)
- **검증** 컴포넌트 테스트 `DayList.test.tsx`(web variant)

#### AC-HOMECAL-113 · 카드 상단에 roast dot 10px·레시피명 15.5px·캡션 12px·대표 수치가 배치된다

- **Given** 웹 기록 카드 1개
- **When** 렌더한다
- **Then** 좌측에 roast dot(10px 원), 레시피명(`font-size` 15.5px, `font-weight` 600),
  그 아래 원두·기구·시각 캡션(12px)이, 우측에 대표 수치가 배치된다
- **검증** 컴포넌트 테스트 `DayList.test.tsx`(web variant)

#### AC-HOMECAL-114 · 카드의 대표 수치가 새 타입 스케일 `card-metric`(mono 17px)으로 렌더된다

- **Given** 웹 기록 카드의 대표 수치(수율 또는 비율)
- **When** 렌더한다
- **Then** `font-family`가 mono, `font-size`가 17px다. `SCALE`에 `card-metric`이 추가되고
  `@utility text-card-metric`이 정의된다
- **검증** 컴포넌트 테스트 `DayList.test.tsx` + `src/test/typography.test.ts`

#### AC-HOMECAL-115 · 카드 하단에 1px divider 아래 태그 줄(비율·온도·시간·별점)이 렌더된다

- **Given** 웹 기록 카드 1개
- **When** 렌더한다
- **Then** 상단 정보와 태그 줄 사이에 1px `divider`가 있고, 태그 줄에 비율(accent-wash
  배경)·온도·시간·별점 태그가 순서대로 렌더된다
- **검증** 컴포넌트 테스트 `DayList.test.tsx`(web variant)

#### AC-HOMECAL-116 · 메모가 있으면 13px italic 한 줄이 태그 줄 아래 추가된다

- **Given** `overallNote`가 있는 웹 기록 카드
- **When** 렌더한다
- **Then** 태그 줄 아래 13px italic 텍스트로 메모가 렌더된다
- **검증** 컴포넌트 테스트 `DayList.test.tsx`(web variant)

#### AC-HOMECAL-117 · 메모가 없으면 메모 줄이 렌더되지 않는다

- **Given** `overallNote`가 `null`인 웹 기록 카드
- **When** 렌더한다
- **Then** 메모 줄 요소가 DOM에 없다
- **검증** 컴포넌트 테스트 `DayList.test.tsx`(web variant)

### 웹 기록 점 위치

#### AC-HOMECAL-118 · 웹 달력 셀에서 기록 점이 날짜 숫자 오른쪽 8px 간격에 렌더된다

> **2026-09-21 정정:** 목업 원값은 6px이지만 간격 스케일(4·8·12·16·24·32·48, `docs/conventions/frontend.md`)에
> 6px가 없다. `|6-4|=2`와 `|6-8|=2`로 동점이라 계획 단계에서 "동점은 올림"으로 8px를 확정했다
> (`docs/plans/2026-09-20-plan-home-calendar-mockup-fidelity.md` Task 2).

- **Given** 웹(≥760px) 달력 셀에 기록이 있는 날짜
- **When** 렌더한다
- **Then** 기록 점이 날짜 숫자 **아래**(모바일 배치)가 아니라 **오른쪽**에 8px `gap`으로
  렌더된다
- **검증** 컴포넌트 테스트 `Calendar.test.tsx`(web variant)

### 아바타 색조

#### AC-HOMECAL-119 · 아바타 배경색이 userId 기반으로 3색 중 하나로 결정된다

- **Given** 프로필 사진이 없는 사용자 A(id=1)·B(id=2)·C(id=3)
- **When** 각각의 이니셜 아바타를 렌더한다
- **Then** 배경색이 `oklch(0.88 0.02 60)`·`oklch(0.88 0.008 80)`·`oklch(0.88 0.015 70)` 중
  하나이고, 계산식은 `userId % 3`이다(백엔드 필드 추가 없음, 프론트에서만 계산)
- **검증** 컴포넌트 테스트 `Avatar.test.tsx`

#### AC-HOMECAL-120 · 같은 사용자는 항상 같은 아바타 색을 받는다

- **Given** 사용자 A(id=1)
- **When** 아바타를 두 번(예: 팔로우 레일과 프로필 화면) 렌더한다
- **Then** 두 렌더링의 배경색이 같다(같은 `userId → color` 함수 사용)
- **검증** 컴포넌트 테스트 `Avatar.test.tsx`

### 추가 발견 (2026-09-21) — 실제 배포 화면과 목업 재대조에서 나온 6개

> 이 절은 위 92~120 작성 뒤 **실제 배포된 앱 화면**을 스크린샷으로 목업과 나란히 대조하며
> 추가로 찾은 격차다. `HOME-CALENDAR.md`를 다시 읽어 확인했다.

#### AC-HOMECAL-121 · 웹 달력 셀의 콘텐츠가 좌상단 정렬된다

- **Given** 웹(≥1100px) 달력 셀
- **When** 렌더한다
- **Then** 셀(`<button>`)의 `align-items`가 `flex-start`, `justify-content`가 `flex-start`이고,
  레시피명·"외 N건" 줄의 `text-align`이 `left`다(현재는 모바일과 같은 `center`를 그대로
  물려쓰고 있다 — 모바일 44px 정사각 셀은 중앙 정렬이 맞지만, 웹은 세로로 긴 박스라
  좌상단이 맞다)
- **검증** 컴포넌트 테스트 `Calendar.test.tsx`(web variant)

#### AC-HOMECAL-122 · 웹 우측 컬럼 컨테이너의 padding이 좌우 40px, 배경이 surface다

- **Given** 웹(≥1100px) 2컬럼 레이아웃의 우측 컬럼 컨테이너(`data-testid="day-column"`)
- **When** 렌더한다
- **Then** `padding-left`·`padding-right`가 40px이고 `background-color`가 `surface` 토큰
  값이다(현재 `p-4`로 16px 균등 padding만 적용돼 목업의 "여유로운 판" 느낌이 아니라
  좁은 박스처럼 보인다)
- **검증** 컴포넌트 테스트 또는 e2e `home-calendar-web.spec.ts`

#### AC-HOMECAL-123 · 웹 우측 컬럼에 요일 아이브로우가 렌더된다

- **Given** 웹 2컬럼에서 토요일을 선택한 상태(내 달력)
- **When** 우측 컬럼 헤더를 렌더한다
- **Then** `SATURDAY`(영문 대문자 요일, `Eyebrow` 컴포넌트 재사용 — mono 10px·`ink-3`)가
  렌더된다. 남의 달력이면 `FRIDAY · 지연` 형식이다(요일 뒤에 `· {닉네임}`)
- **검증** 컴포넌트 테스트 `DayList.test.tsx`(web variant)

#### AC-HOMECAL-124 · 웹 우측 컬럼 헤더의 날짜 숫자가 26px 근사값(page-title 27px)·weight 600으로 렌더된다

- **Given** 위와 같음
- **When** 렌더한다
- **Then** 날짜 숫자(예: `19`)가 기존 타입 스케일 `page-title`(27px, 목업 26px에서 1px
  반올림 — `[제안 후 승인]`, 새 타입 단계를 추가하지 않는다)에 `font-weight` 600을 더해
  렌더된다
- **검증** 컴포넌트 테스트 `DayList.test.tsx`(web variant) + `src/test/typography.test.ts`(기존
  단계 재사용이므로 새 등록 불필요)

#### AC-HOMECAL-125 · 웹 우측 컬럼 헤더 오른쪽에 건수가 mono 12px로 렌더된다

- **Given** 위와 같음
- **When** 렌더한다
- **Then** 헤더 우측에 `{count}건`(예: `2건`) 또는 목업 표기대로 건수가 `font-family` mono,
  `font-size` 12px로 렌더된다
- **검증** 컴포넌트 테스트 `DayList.test.tsx`(web variant)

#### AC-HOMECAL-126 · 관계 문구가 Observation 블록 스타일로 렌더된다

- **Given** 남의 달력(맞팔로우 상태)의 날짜별 목록 하단
- **When** 관계 문구를 렌더한다
- **Then** `surface` 배경 + 좌측 2px `accent` 보더 + `border-radius` `0 8px 8px 0`(우측 두
  모서리만 8px, Tailwind `rounded-r-lg`) 박스 안에 `font-size` 13.5px·`line-height` 1.65로
  렌더된다(현재는 배경·보더 없는 평범한 `<p>`다). 라벨(대문자 mono 9.5px)은 붙이지 않는다 —
  목업이 이 관계 문구에는 라벨을 쓰지 않는다
- **검증** 컴포넌트 테스트 `DayList.test.tsx`

#### AC-HOMECAL-127 · 전역 CTA 문구가 "이 레시피로 내렸다"다

- **Given** 모바일 하단 고정 CTA와 웹 상단 바 CTA(둘 다 전역 액션 — 날짜와 무관)
- **When** 렌더한다
- **Then** 두 곳 모두 버튼 텍스트가 정확히 `"이 레시피로 내렸다"`다(현재는 둘 다
  `"기록하기"`다). 우측 컬럼의 날짜별 맥락 CTA(`AC-HOMECAL-*`가 이미 다루는 "이 날짜로
  기록 추가"/"프로필 보기")는 이 조건의 대상이 아니다 — 이미 올바르다
- **검증** 컴포넌트 테스트 `page.test.tsx` + `WebTopBar.test.tsx`

#### AC-HOMECAL-128 · 모바일 날짜별 목록 영역이 뷰포트 높이의 60%를 넘지 않는다

- **Given** 모바일(390×844) 홈 화면, 1컬럼 레이아웃
- **When** 날짜별 목록(`data-testid="day-scroll"`)을 렌더한다
- **Then** 이 영역이 `flex-1`로 남는 공간을 전부 차지하지 않고, `max-height`가 뷰포트 높이의
  60% 이하로 제한된다(목업은 정확한 픽셀 상한을 주지 않는다 — "짧은 목록일수록 CTA 위
  여백이 과도하게 커진다"는 실측 문제를 억제하는 상한이다, `[제안 후 승인]`). 내용이 이
  상한을 넘으면 그 안에서 계속 스크롤된다(`AC-HOMECAL-85`가 이미 요구하는 "날짜별 목록만
  스크롤" 동작은 유지)
- **검증** e2e `home-calendar.spec.ts`(실제 뷰포트에서 `getBoundingClientRect().height`를
  재서 뷰포트 높이의 60% 이하임을 확인 + 긴 목록에서는 여전히 내부 스크롤됨을 확인)

---

## 수동 확인

없음. 전부 자동화 가능하다.

## 열어둔 결정

없음.
