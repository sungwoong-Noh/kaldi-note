---
id: MYCUPS
title: 내 잔 목록 — 목업 BM1·BW1 정합 + 이번 달·별점 필터
status: 승인
milestone: M2
supersedes:
---

# 내 잔 목록 스펙

> 작성 규칙은 [`docs/specs/README.md`](README.md) 참조.
> **모든 인수 조건은 자동화된 테스트로 옮길 수 있어야 한다.**

## 시나리오

사용자가 `/brews`(「내 잔」)를 열면 **자기가 내린 잔만** 최신순 원장으로 본다. 모바일은 2줄 원장 행,
웹은 장부형 표다. 알약으로 「이번 달」·「★ 4 이상」만 걸러 보고, 행을 눌러 기록 상세로 간다.
화면은 목업 `02 Recipes and Cups` BM1(모바일)·BW1(웹)을 따르고, 부품은 `/dev/kit`
(`src/components/kit/`)을 쓴다 — [ADR 0010](../decisions/0010-mockup-is-visual-source-of-truth.md).

지금 `/brews`는 `GET /brew-logs`를 `userId` 없이 불러 **맞팔 친구의 FRIENDS·PUBLIC 잔까지 섞인다**
(통계 `/stats`는 본인 것만 센다). 이 스펙이 그것도 바로잡는다.

### 범위 밖 (Non-goals)

- 기록 상세 2컬럼(#141) · 기록 작성·편집 폼(#161)
- 홈 달력 오른쪽 `DayList` 카드(이슈 #143 본문이 가리키던 것 — 이미 `DayCard`로 구현돼 있다)
- `GET /brew-logs/stats` 변경 — 필터와 무관하게 늘 전체 기준이다
- 정렬 변경(지금처럼 `brewedAt` 내림차순) · 알약 개수 표시 · 아바타 메뉴(M4 #169)

## 용어

| 용어 | 정의 |
|---|---|
| 이번 달 | 오늘(KST)이 속한 달. 2026-10-10이면 `month=2026-10` |
| N | 현재 필터를 적용한 목록 응답의 `totalElements` |
| 보조줄 | 웹 표 레시피 칸의 둘째 줄 `원두 · 드리퍼` |

## 계약

| 메서드 | 경로 | 인증 | 계약 파일 |
|---|---|---|---|
| GET | `/api/v1/brew-logs` | 필요 | [`2026-10-10-my-cups-ledger.json`](../contracts/2026-10-10-my-cups-ledger.json) |

기존 파라미터(`page`·`size`·`recipeId`·`userId`·`beanBatchId`·`date`)에 **둘을 더한다.** 전부 선택이고
서로 AND다.

| 파라미터 | 형식 | 의미 | 위반 |
|---|---|---|---|
| `month` | `YYYY-MM` | KST 그 달 1일 00:00 이상, 다음 달 1일 00:00 미만 | 400 `INVALID_REQUEST` — 메시지는 달력과 같다(`CalendarMonth.parse`) |
| `minRating` | 정수 `1`~`5` (양끝 포함) | `rating >= minRating`. **별점 없는 잔은 제외** | 범위 밖 400 `INVALID_REQUEST`, 정수 아님 400 `INVALID_REQUEST`(기존 전역 처리) |

프론트는 「내 잔」에서 늘 `userId={me.id}`를 붙인다.

화면 상태는 URL에 둔다: `?filter=month` → `month=<이번 달>`, `?filter=rated` → `minRating=4`, 없음 → 전체.

---

## 인수 조건

> 화면 AC의 값은 `e2e/stubs.ts`·`src/test/fixtures.ts`의 실제 응답 픽스처 기준이다 —
> `brewLogPage`(id 2: 2026-08-31 · 20 g · 92 °C · 3:30 · 수율 17.6 · ★ 4 / id 3: 2026-08-30 · 시간·수율 없음 · ★ 3),
> 레시피 `hoffmann`(`James Hoffmann Ultimate V60`, 드리퍼 `Hario V60 02`), 원두 `프릿츠 예가체프`(`MEDIUM_LIGHT`).
> 오늘은 `2026-10-10`(KST)로 고정한다.

### 기능

#### AC-MYCUPS-01 · 목록은 본인 잔만 부른다

- **Given** 로그인 사용자 `me.id = 11`
- **When** `/brews`를 연다
- **Then** 목록 요청 URL에 `userId=11`이 있다
- **검증** 컴포넌트 테스트 `BrewsPage`(MSW 요청 캡처)

#### AC-MYCUPS-02 · month는 KST 그 달의 잔만 준다

- **Given** 같은 사용자의 잔 `2026-09-30T14:59:59Z`(KST 9/30 23:59:59) · `2026-09-30T15:00:00Z`(KST 10/01 00:00) · `2026-10-31T14:59:59Z` · `2026-10-31T15:00:00Z`
- **When** `GET /api/v1/brew-logs?month=2026-10`
- **Then** 가운데 둘(`2026-09-30T15:00:00Z`, `2026-10-31T14:59:59Z`)만 온다
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-MYCUPS-03 · minRating은 그 값 이상만 주고 별점 없는 잔은 뺀다

- **Given** 별점 `5` · `4` · `3` · 없음인 잔 4개
- **When** `GET /api/v1/brew-logs?minRating=4`
- **Then** `5`·`4` 두 개만 오고 `totalElements`가 `2`다
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-MYCUPS-04 · 「이번 달」 알약은 month를 붙이고 URL에 남는다

- **Given** `/brews`
- **When** 알약 `이번 달`을 누른다
- **Then** URL이 `/brews?filter=month`가 되고, 목록 요청에 `month=2026-10`과 `userId=11`이 함께 있다. 그 알약이 `aria-pressed="true"`다
- **검증** 컴포넌트 테스트 `BrewsPage`

#### AC-MYCUPS-05 · 「★ 4 이상」은 minRating=4, 「전체」는 쿼리를 지운다

- **Given** `/brews?filter=month`
- **When** `★ 4 이상`을 누른다
- **Then** URL이 `/brews?filter=rated`, 요청에 `minRating=4`가 있고 `month`는 없다
- **When** 이어서 `전체`를 누른다
- **Then** URL이 `/brews`, 요청에 `month`·`minRating`이 둘 다 없다
- **검증** 컴포넌트 테스트 `BrewsPage`

#### AC-MYCUPS-06 · 모바일 헤더는 eyebrow·제목·아바타다

- **Given** 뷰포트 `390×844`, 목록 `totalElements: 2`
- **When** `/brews`를 렌더한다
- **Then** eyebrow 텍스트가 `My cups · 2`(CSS `text-transform: uppercase`), `h1`이 `내 잔`, 오른쪽에 36×36 아바타가 있다. 아바타는 링크·버튼이 아니다. 기존의 헤더 `레시피` 링크는 없다
- **검증** e2e `my-cups.spec.ts`

#### AC-MYCUPS-07 · 웹 헤더는 연도 eyebrow와 알약·개수다

- **Given** 뷰포트 `1440×900`, `totalElements: 2`
- **When** `/brews`를 렌더한다
- **Then** eyebrow가 `My cups · 2026`, 제목 오른쪽에 알약 `전체`·`이번 달`·`★ 4 이상`과 `2잔`이 한 줄에 있다
- **검증** e2e `my-cups.spec.ts`

#### AC-MYCUPS-08 · 모바일 행은 2줄 원장이다

- **Given** 뷰포트 `390×844`
- **When** 첫 행(id 2)을 읽는다
- **Then** 1줄 왼쪽 `James Hoffmann Ultimate V60`, 오른쪽 `20 g`. 2줄 왼쪽 `08.31 월 · 92°C · 3:30`, 오른쪽 `17.6 % · ★ 4`(색 `accent`). 행 왼쪽에 `MEDIUM_LIGHT` 배전도 점(10px)이 있다
- **검증** 컴포넌트 테스트 `BrewsPage` + e2e(점 크기)

#### AC-MYCUPS-09 · 웹 표는 BW1의 열과 보조줄을 갖는다

- **Given** 뷰포트 `1440×900`
- **When** 표를 읽는다
- **Then** 머리글이 `날짜`·`레시피 / 원두`·`원두량`·`온도`·`시간`·`수율`·`평가` 순이고, 날짜 열 폭 `108`, 원두량 `100`, 온도 `90`, 시간 `90`, 수율 `100`, 평가 `70`px(레시피 열이 나머지). 원두량·온도·시간·수율·평가는 `text-align: right`. 첫 행 레시피 칸이 배전도 점 + `James Hoffmann Ultimate V60` + 보조줄 `프릿츠 예가체프 · Hario V60 02`다
- **검증** e2e `my-cups.spec.ts`

#### AC-MYCUPS-10 · 통계 타일은 웹 4칸·모바일 2칸이다

- **Given** `BrewLogStatsResponse { monthCount: 9, averageRating: 3.7, favoriteDoseG: 16.0, favoriteRecipeTitle: "케냐 94도 3푸어" }`
- **When** 웹(`≥760px`)에서 렌더한다
- **Then** 라벨 `이번 달`·`평균 별점`·`가장 많이 쓴 원두량`·`즐겨 쓴 레시피`, 값 `9잔`·`★ 3.7`·`16 g`·`케냐 94도 3푸어`. 앞 세 값은 Mono 24px, 레시피 값은 Sans 15px다
- **When** 모바일(`<760px`)에서 렌더한다
- **Then** `이번 달`·`평균 별점` 2칸만 있고 값은 Mono 22px다
- **검증** 컴포넌트 테스트 `BrewsPage`(라벨·값) + e2e(크기)

> AC-RECIPESBREWS-76의 라벨 `최빈 원두량`을 이 AC가 `가장 많이 쓴 원두량`으로 갱신한다(목업 BW1). 값은 그대로다.
> AC-WEBBREW-35의 날짜 `2026-08-31`은 AC-MYCUPS-13 표기 `08.31`로 갱신했다(구현 중 발견해 추가).

#### AC-MYCUPS-11 · 모바일만 하단 전폭 「기록하기」가 있다

- **Given** 목록 1건 이상
- **When** `390×844`에서 렌더한다
- **Then** 목록 아래에 폭이 본문 폭과 같은 `기록하기` 링크가 있고 `/recipes`로 간다
- **When** `1440×900`에서 렌더한다
- **Then** 본문에 `기록하기`가 없다(상단 바 CTA만 있다 — AC-GRAMMAR-05)
- **검증** e2e `my-cups.spec.ts`

#### AC-MYCUPS-12 · 행 전체가 기록 상세 링크다

- **Given** 모바일·웹 각각
- **When** 첫 행의 날짜 글자를 누른다
- **Then** `/brews/2`로 이동한다
- **검증** e2e `my-cups.spec.ts`

### 엣지 (경계값)

#### AC-MYCUPS-13 · 올해가 아닌 잔은 연도를 붙인다

- **Given** `brewedAt: "2025-09-19T00:00:00Z"`, 오늘 `2026-10-10`
- **When** 행을 렌더한다
- **Then** 날짜가 `2025.09.19 금`이다. 올해 잔은 `08.31 월`(연도 없음)이다
- **검증** 단위 테스트 `formatLedgerDate`

#### AC-MYCUPS-14 · 없는 값은 그 조각만 빠진다

- **Given** id 3(시간·수율 없음, ★ 3)
- **When** 모바일 행을 렌더한다
- **Then** 2줄 왼쪽이 `08.30 일 · 92°C`, 오른쪽이 `★ 3`이다. 별점도 없으면 오른쪽 자리가 비고 `·`가 남지 않는다
- **When** 웹 표를 렌더한다
- **Then** 시간·수율 칸이 `—`다(AC-RECIPESBREWS-87 유지)
- **검증** 컴포넌트 테스트 `BrewsPage`

#### AC-MYCUPS-15 · 보조줄은 있는 것만 잇고, 점 자리는 비워도 유지한다

- **Given** `beanBatchId`가 없는 잔, 레시피 드리퍼 `Hario V60 02`
- **When** 웹 표를 렌더한다
- **Then** 보조줄이 `Hario V60 02`다. 원두도 드리퍼도 없으면 보조줄 요소가 없다. 어느 경우든 제목의 왼쪽 x좌표가 점이 있는 행과 같다
- **검증** 컴포넌트 테스트(텍스트) + e2e(x좌표)

#### AC-MYCUPS-16 · minRating·month의 양끝은 허용된다

- **Given** 로그인 사용자
- **When** `minRating=1`, `minRating=5`, `month=2026-01`, `month=2026-12`로 각각 부른다
- **Then** 넷 다 `200`이다
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-MYCUPS-17 · date가 month 밖이면 빈 목록이다

- **Given** 로그인 사용자
- **When** `GET /api/v1/brew-logs?month=2026-10&date=2026-09-30`
- **Then** `200`, `content: []`, `totalElements: 0`
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-MYCUPS-18 · 필터 결과 0건이면 안내와 해제 링크가 뜬다

- **Given** `/brews?filter=rated`, 목록 응답 `totalElements: 0`, 통계는 AC-10의 값
- **When** 렌더한다
- **Then** `조건에 맞는 잔이 없습니다`와 `전체 보기`가 있고, `전체 보기`를 누르면 URL이 `/brews`가 된다. 통계 타일은 그대로 `9잔`이다. 전체 0건일 때의 문구 `아직 기록이 없습니다`는 이때 나오지 않는다
- **검증** 컴포넌트 테스트 `BrewsPage`

### 실패

#### AC-MYCUPS-19 · month 형식이 틀리면 400이다

- **Given** 로그인 사용자
- **When** `month=2026-13`, `month=2026-1`, `month=202610`으로 각각 부른다
- **Then** 셋 다 HTTP `400`과 `code: "INVALID_REQUEST"`를 반환한다
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-MYCUPS-20 · minRating이 범위 밖이거나 정수가 아니면 400이다

- **Given** 로그인 사용자
- **When** `minRating=0`, `minRating=6`, `minRating=abc`로 각각 부른다
- **Then** 셋 다 HTTP `400`과 `code: "INVALID_REQUEST"`를 반환한다
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-MYCUPS-21 · 모르는 filter 값은 전체로 본다

- **Given** 로그인 사용자
- **When** `/brews?filter=xyz`를 연다
- **Then** 목록 요청에 `month`·`minRating`이 없고 `전체` 알약이 `aria-pressed="true"`다. 에러 화면이 아니다
- **검증** 컴포넌트 테스트 `BrewsPage`

### 비기능

#### AC-MYCUPS-22 · 알약과 「더 보기」의 누르는 영역이 44×44 이상이다

- **Given** `390×844`, `hasNext: true`
- **When** 알약 3개와 `더 보기` 버튼을 잰다
- **Then** `e2e/hitArea.ts`의 `undersized`가 빈 배열이다(보이는 높이는 목업대로 44 미만일 수 있다 — ADR 0010)
- **검증** e2e `my-cups.spec.ts`

#### AC-MYCUPS-23 · 가로 스크롤이 없다

- **Given** 로그인 사용자
- **When** `390×844`와 `1440×900`에서 `/brews`를 연다
- **Then** `document.documentElement.scrollWidth`가 각각 뷰포트 폭 이하이고, 웹 표를 감싼 요소의 `scrollWidth`가 `clientWidth`와 같다
- **검증** e2e `my-cups.spec.ts`

#### AC-MYCUPS-24 · 보조줄·점에 새 API를 만들지 않는다

- **Given** `/brews` 구현
- **When** 목록 한 페이지를 렌더한다
- **Then** 원두명은 `useBeanLabel`, 배전도는 `useRoastLevel`, 드리퍼는 `useBrewers`(레시피 `brewerId`)로만 구한다. 백엔드에 추가되는 것은 목록 파라미터 `month`·`minRating` 둘뿐이다
- **검증** 컴포넌트 테스트 `BrewsPage`(MSW에 등록되지 않은 경로 요청 시 실패)

---

## 구현 순서

- [x] **Task 1: 백엔드 — month·minRating 필터** — Covers: AC-MYCUPS-02, 03, 16, 17, 19, 20

  ```java
  // BrewLogController.list: @RequestParam(required=false) String month, @RequestParam(required=false) Integer minRating
  // month → CalendarMonth.parse(month)로 [start, end) — date와 둘 다 있으면 교집합(max start, min end)
  // minRating: null 또는 1..5, 아니면 BusinessException(INVALID_REQUEST)
  // BrewLogRepository.findVisible(..., Integer minRating, ...): (:minRating is null or b.rating >= :minRating)
  ```

- [x] **Task 2: 프론트 API·URL 상태** — Covers: AC-MYCUPS-01, 04, 05, 21

  ```ts
  // fetchBrewLogPage(page, size, { userId, month, minRating }, onSessionLost)
  // useMyCupsFilter(): ?filter=month|rated → { month: kstMonth(today) } | { minRating: 4 } | {}
  // queryKey: ["brew-logs", "mine", filter]
  ```

- [x] **Task 3: 헤더·통계 타일·빈 상태** — Covers: AC-MYCUPS-06, 07, 10, 18

  kit `PageHeader`·`StatTile`·`PillFilter`. 웹 타일은 값 24px·패딩 18/20 변형을 `StatTile`에 prop으로 더한다.

- [x] **Task 4: 모바일 원장 행 · 날짜 표기** — Covers: AC-MYCUPS-08, 13, 14

  kit `LedgerRow` + `formatLedgerDate(brewedAt, today)`(`src/lib/format.ts`).

- [x] **Task 5: 웹 표 · 보조줄** — Covers: AC-MYCUPS-09, 15, 24

  행 컴포넌트 안에서 `useBeanLabel`·`useRoastLevel`, 페이지에서 `useBrewers` 한 번.

- [ ] **Task 6: 하단 CTA·행 링크·더 보기** — Covers: AC-MYCUPS-11, 12, 22

  kit `BottomCta`를 링크로도 쓸 수 있게(`href` prop). 「더 보기」는 밑줄 텍스트 모양의 `button` + `hit-44`.

- [ ] **Task 7: e2e·목업 대조** — Covers: AC-MYCUPS-23 (+ 06·07·09·11·12·22의 e2e 부분)

  `e2e/my-cups.spec.ts` 작성, `pnpm compare`로 `brews-390`·`brews-1440` 재생성.

---

## 수동 확인

- [ ] ★ `pnpm compare`의 `brews-390`·`brews-1440`에서 목업 BM1·BW1 대비 「큼」 격차 0건. 비교 이미지를 PR 본문에 첨부한다

## 열어둔 결정

- 모바일 헤더 아바타의 동작(메뉴·프로필 이동) — M4 #169에서 정한다. 그때까지 장식이다
