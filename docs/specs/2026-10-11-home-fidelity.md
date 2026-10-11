---
id: HOMEFIT
title: 홈 목업 정합 — 01 CW1(웹)·C1(모바일), 레일 띠·오른쪽 칼럼·카드 캡션·관찰 1회
status: 승인
milestone: M2
supersedes:
---

# 홈 목업 정합 스펙

> 작성 규칙은 [`docs/specs/README.md`](README.md) 참조.
> **모든 인수 조건은 자동화된 테스트로 옮길 수 있어야 한다.**

## 시나리오

사용자가 홈(`/`)을 열면 목업 `01 Home - Web` CW1·`01 Home - Mobile` C1과 같은 모양의 달력 홈을 본다.
웹은 상단 바 아래 전폭 팔로우 띠, 왼쪽 달력, 화면 높이를 채우는 오른쪽 날짜 칼럼(카드 · 관찰 1회 ·
맨 아래 고정 CTA)이고, 모바일은 50px 레일 · 달력 · 원장 행 날짜 목록이다. 동작(데이터·선택·월 이동)은
바꾸지 않고 **보이는 것과 카드 캡션의 내용**만 바꾼다 — [ADR 0010](../decisions/0010-mockup-is-visual-source-of-truth.md).

2026-10-11 `pnpm compare` 점검에서 웹 「멂」·모바일 「보통」이었다. #167(홈 격차)·#172(달 이동 버튼 상자
안의 상자)·#179(아바타 찌그러짐)를 흡수한다.

### 범위 밖 (Non-goals)

- 닉네임 검색 — 레일 끝 칸은 「찾기」가 아니라 「초대」다(아래 AC-03)
- 월간 패턴 관찰 문구(「이번 달 9번 중 7번이 92°C」) — 계산 규칙이 없다. 관찰 블록은 기존 `diagnosis`를 1회 쓴다
- 달력·목록 API 변경, 스와이프·키보드 동작, 남의 달력 CTA, 「이 날짜로 기록 추가」의 이동 대상
- 목업의 탭 라벨 `기록` — 지금은 `내 잔`이 맞다(AC-RECIPESBREWS-79)

## 용어

| 용어 | 정의 |
|---|---|
| 캡션 | 웹 카드 레시피명 아래 줄. `원두 · 드리퍼 · 시각` |
| 관찰 블록 | 카드들 아래 1개. 그날 기록 중 `tdsPercent`가 있는 가장 최근(`brewedAt` 최대) 잔의 `diagnosis` |
| 오른쪽 칼럼 | 웹(≥1100px) 날짜 칼럼. 달력 영역 높이 전체를 채운다 |

## 계약

API 변경 없음. 캡션은 기존 조회만 쓴다 — 원두 `useBeanLabel`(배치 → 제품 → 로스터), 드리퍼 `useBrewers` +
레시피 `brewerId`(`useRecipeLabels`와 같은 쿼리 키 `["recipe", id]`), 시각은 `brewedAt`의 KST `HH:mm`.

---

## 인수 조건

> 값은 e2e 스텁 기준이다 — 오늘 `2026-09-19`(KST), 선택 날짜 기록 2건(hoffmann · 원두 `프릿츠 예가체프` ·
> 드리퍼 `Hario V60 02` · `brewedAt` `…T09:00:00Z` → `18:00`), 달력 `homeCalendar`(2026-09, `7 BREWS`).

### 기능

#### AC-HOMEFIT-01 · 웹 팔로우 레일은 상단 바 아래 전폭 띠다

- **Given** 뷰포트 `1440×900`
- **When** 홈을 연다
- **Then** 레일 컨테이너의 폭이 뷰포트 폭과 같고, `padding`이 `16px 48px`, `border-bottom`이 `1px`이다. 레일의 top이 상단 바의 bottom과 같다
- **검증** e2e `home-fidelity.spec.ts`

#### AC-HOMEFIT-02 · 웹 레일 알약은 CW1 값이다

- **Given** 뷰포트 `1440×900`
- **When** 레일 알약을 잰다
- **Then** 알약 안 아바타가 `32×32`, 이름 `font-size` `13.5px`, 알약 `padding` `6px 14px 6px 6px`, 알약 사이 간격 `18px`다. 선택된 `나` 알약의 배경이 `--ink`, 이름 `font-weight`가 `600`이다
- **검증** e2e

#### AC-HOMEFIT-03 · 레일 끝은 「+ 초대」이고 /more로 간다

- **Given** 웹 `1440×900`과 모바일 `390×844` 각각
- **When** 레일 마지막 항목을 누른다
- **Then** 그 항목의 이름이 `초대`이고 점선(`border-style: dashed`) 원 안에 `+`가 있으며, `/more`로 이동한다. 웹에서는 그 앞에 `1×24px` 세로 구분선이 있다
- **검증** e2e

> 2026-09-19 홈 달력 스펙의 범위 밖 「찾기 칸을 만들지 않는다」를 이 AC가 바꾼다(검색이 아니라 초대 링크로 연결).

#### AC-HOMEFIT-04 · 모바일 레일은 C1 값이다

- **Given** 뷰포트 `390×844`
- **When** 레일을 잰다
- **Then** 아바타 `50×50`, 라벨 `11.5px`·아바타와 라벨 사이 `7px`, 항목 간격 `14px`. 선택된 `나`는 아바타에 `2px` `--ink` 링, 라벨 `font-weight` `600`이고 나머지 라벨은 `400`이다
- **검증** e2e

#### AC-HOMEFIT-05 · 월 머리는 한 줄이다

- **Given** 웹·모바일 각각
- **When** 월 머리를 읽는다
- **Then** `2026.09`와 `7 BREWS`가 있고 두 요소의 세로 중심 차이가 `4px` 미만이다
- **검증** e2e

#### AC-HOMEFIT-06 · 달 이동 버튼은 32×32 한 겹이다

- **Given** 웹·모바일 각각
- **When** `이전 달` 버튼을 잰다
- **Then** 버튼의 보이는 박스가 `32×32`, `border` `1px`, `border-radius` `7px`이고 버튼 안에 테두리를 가진 자식 요소가 없다(#172). 누르는 영역은 `e2e/hitArea.ts` 기준 44×44 이상이다
- **검증** e2e

#### AC-HOMEFIT-07 · 웹 달력 칸의 요약 줄은 작다

- **Given** 뷰포트 `1440×900`, `2026-09-05`(2건)
- **When** 그 칸을 읽는다
- **Then** 레시피명 줄이 `11.5px`이고 한 줄(`white-space: nowrap`, `text-overflow: ellipsis`)이다. `외 1건`이 `11px`이다. 기록 점이 날짜 숫자 오른쪽 `6px`에 있다
- **검증** e2e

#### AC-HOMEFIT-08 · 웹 오른쪽 칼럼은 420px surface이고 달력 높이를 채운다

- **Given** 뷰포트 `1440×900`
- **When** 오른쪽 칼럼을 잰다
- **Then** 폭 `420px`, 좌우 `padding` `40px`, 배경 `--surface`. 칼럼 높이와 달력 영역(월 머리 ~ 그리드 끝) 높이의 차이가 `1px` 이하다
- **검증** e2e

#### AC-HOMEFIT-09 · 「이 날짜로 기록 추가」는 칼럼 맨 아래에 있다

- **Given** 뷰포트 `1440×900`
- **When** CTA를 잰다
- **Then** CTA의 bottom과 오른쪽 칼럼의 bottom 차이가 `32px` 이하다
- **검증** e2e

#### AC-HOMEFIT-10 · 웹 날짜 머리는 「9월 19일」과 「2 brews」다

- **Given** `2026-09-19`, 기록 2건
- **When** 웹 날짜 머리를 렌더한다
- **Then** eyebrow `SATURDAY`, 날짜 `9월 19일`(`26px`·`600`), 오른쪽 `2 brews`(Mono `12px`, 소문자)다
- **검증** 컴포넌트 테스트 `DayList` + e2e(크기)

#### AC-HOMEFIT-11 · 웹 카드 캡션은 원두 · 드리퍼 · 시각이다

- **Given** 뷰포트 `1440×900`, 선택 날짜 첫 기록
- **When** 카드를 읽는다
- **Then** 캡션이 `프릿츠 예가체프 · Hario V60 02 · 18:00`(`12px`)이고, 레시피명이 `15.5px`·`600`, 대표 수치가 Mono `17px`이다
- **검증** 컴포넌트 테스트 `DayCard` + e2e(크기)

#### AC-HOMEFIT-12 · 진단은 카드 밖 관찰 블록 1개다

- **Given** 선택 날짜 기록 2건 — 18:00 잔은 `tdsPercent` 있음·`diagnosis` `"추출이 부족합니다. …"`, 09:00 잔은 `tdsPercent` 있음·다른 `diagnosis`
- **When** 웹 오른쪽 칼럼을 렌더한다
- **Then** 카드(`data-testid="day-card"`) 안에 `diagnosis` 문구가 없다. 카드 목록 아래 `data-observation` 블록이 정확히 1개 있고 내용이 18:00 잔의 `diagnosis` 그대로다
- **검증** 컴포넌트 테스트 `DayList`

#### AC-HOMEFIT-13 · 모바일 날짜 목록은 원장 행이다

- **Given** 뷰포트 `390×844`, 선택 날짜 기록 2건
- **When** 목록을 잰다
- **Then** 각 행 위에 `1px` 구분선이 있고 마지막 행 아래에도 `1px` 구분선이 있다. 레시피명 `14.5px`·`500`, 캡션 `11.5px`, 대표 수치 Mono `14px`, 배전도 점 `9px`다
- **검증** e2e

#### AC-HOMEFIT-14 · 아바타 사진은 고정 박스다

- **Given** `profileImageUrl`이 있는 아바타, `size` `32`·`36`·`50` 각각
- **When** 렌더한다
- **Then** `img`의 computed `width`·`height`가 각각 `size`px이고 `object-fit`이 `cover`다(#179)
- **검증** 컴포넌트 테스트 `Avatar`

### 엣지 (경계값)

#### AC-HOMEFIT-15 · 캡션은 있는 조각만 잇는다

- **Given** 원두 없는 기록(`beanBatchId` 없음, 드리퍼 `Hario V60 02`) / 원두·드리퍼 둘 다 없는 기록
- **When** 웹 카드를 렌더한다
- **Then** 캡션이 각각 `Hario V60 02 · 18:00` / `18:00`이다
- **검증** 컴포넌트 테스트 `DayCard`

#### AC-HOMEFIT-16 · 읽을 수 없는 원두는 캡션에서 빠진다

- **Given** 남의 달력, 원두 배치 조회가 `403`
- **When** 웹 카드를 렌더한다
- **Then** 캡션이 `Hario V60 02 · 18:00`이고 `비공개 원두`가 캡션에 없다
- **검증** 컴포넌트 테스트 `DayCard`

#### AC-HOMEFIT-17 · TDS 없는 날은 관찰 블록이 없다

- **Given** 선택 날짜 기록이 전부 `tdsPercent` 없음
- **When** 웹 오른쪽 칼럼을 렌더한다
- **Then** `data-observation` 요소가 없다
- **검증** 컴포넌트 테스트 `DayList`

#### AC-HOMEFIT-18 · 카드가 넘쳐도 카드 영역만 스크롤된다

- **Given** 뷰포트 `1440×900`, 선택 날짜 기록 5건
- **When** 홈을 연다
- **Then** 카드 영역의 `scrollHeight`가 `clientHeight`보다 크고, CTA가 뷰포트 안에 있으며, `document.documentElement.scrollHeight`가 `900` 이하다
- **검증** e2e

#### AC-HOMEFIT-19 · 6주 달에서도 칼럼 높이가 달력과 같다

- **Given** 뷰포트 `1440×900`, 오늘 `2026-03-19`(6주에 걸친 달)
- **When** 홈을 연다
- **Then** 오른쪽 칼럼 높이와 달력 영역 높이의 차이가 `1px` 이하다
- **검증** e2e

### 실패

#### AC-HOMEFIT-20 · 아바타 사진이 실패하면 이니셜 원이다

- **Given** `profileImageUrl`이 있지만 이미지 로드가 실패한다(`error` 이벤트)
- **When** 아바타를 렌더한다
- **Then** `img`가 사라지고 닉네임 첫 글자 원이 같은 `size`로 그려진다
- **검증** 컴포넌트 테스트 `Avatar`

#### AC-HOMEFIT-21 · 원두·기구 조회가 실패해도 카드는 그려진다

- **Given** 원두 배치 조회 `500`, 기구 목록 조회 `500`
- **When** 웹 카드를 렌더한다
- **Then** 카드와 레시피명이 그려지고 캡션은 `18:00`이다. 에러 화면이 아니다
- **검증** 컴포넌트 테스트 `DayCard`

### 비기능

#### AC-HOMEFIT-22 · 가로 스크롤이 없다

- **Given** 홈 스텁(e2e)
- **When** `390×844`와 `1440×900`에서 홈을 연다
- **Then** `document.documentElement.scrollWidth`가 각각 뷰포트 폭 이하다
- **검증** e2e

#### AC-HOMEFIT-23 · 캡션에 새 API를 부르지 않는다

- **Given** 웹 홈, 선택 날짜 기록 2건
- **When** 렌더 중 나간 요청 경로를 모은다
- **Then** 전부 기존 경로(`users/me`·`users/me/mutual-follows`·`brew-logs`·`brew-logs/calendar`·`recipes/{id}`·`gear/brewers`·`bean-batches/{id}`·`bean-products/{id}`·`roasters`) 안이다
- **검증** 컴포넌트 테스트 `HomePage`(MSW 요청 기록)

---

## 대체하는 이전 AC

ADR 0010(목업이 시각의 정본)에 따라 아래 AC는 이 스펙의 값으로 바뀐다. **동작이 바뀐 AC**는 헤딩을
「(대체됨)」 문단으로 바꾸고 테스트 ID를 새 AC로 옮긴다. **값만 바뀐 AC**는 원래 AC의 값을 갱신하고 테스트에
두 ID를 함께 단다.

- AC-HOMECAL-77(카드 안 진단) → AC-HOMEFIT-12 — 동작 변경(카드 밖 1회)
- AC-HOMECAL-102·103·104(레일 간격·pill padding) → AC-HOMEFIT-02·04 — 값 갱신
- AC-HOMECAL-105(클릭 영역 44 박스) → AC-HOMEFIT-06 — hit area로
- AC-HOMECAL-106(안쪽 시각 박스 32) → AC-HOMEFIT-06 — 버튼 자신이 32 한 겹(구현 중 추가)
- AC-HOMECAL-108·113(캡션 내용) → AC-HOMEFIT-11·13 — 웹 카드 캡션은 원두·드리퍼·시각
- AC-HOMECAL-118(점 간격 8px) → AC-HOMEFIT-07 — `6px`
- AC-HOMECAL-122(패딩 48) → AC-HOMEFIT-08 — `40px`
- AC-HOMECAL-124(날짜 `19`) → AC-HOMEFIT-10 — `9월 19일`
- AC-HOMECAL-125(`2건`) → AC-HOMEFIT-10 — `2 brews`

구현 중 이 목록 밖의 테스트가 같은 이유로 깨지면, 이 목록에 추가하고 같은 방식으로 옮긴다.

---

## 구현 순서

- [x] **Task 1: 아바타 고정 박스 + 실패 시 이니셜(#179)** — Covers: AC-HOMEFIT-14, 20

  ```tsx
  // Avatar: const [failed, setFailed] = useState(false)
  // <img style={{ width: size, height: size }} className="rounded-full object-cover" onError={() => setFailed(true)} />
  ```

- [x] **Task 2: 팔로우 레일 — 웹 띠·모바일 50px·「+ 초대」** — Covers: AC-HOMEFIT-01, 02, 03, 04

  웹 레일을 본문 밖(상단 바 바로 아래 전폭)으로 옮긴다. 레이아웃 변경이라 `src/app/page.tsx` 구조를 손댄다.

- [x] **Task 3: 월 머리 한 줄 + 달 이동 버튼 한 겹(#172)** — Covers: AC-HOMEFIT-05, 06

- [x] **Task 4: 웹 달력 칸 요약 줄** — Covers: AC-HOMEFIT-07

- [x] **Task 5: 웹 오른쪽 칼럼 — 폭·높이·스크롤·CTA 고정·날짜 머리** — Covers: AC-HOMEFIT-08, 09, 10, 18, 19

- [x] **Task 6: 웹 카드 캡션·관찰 1회** — Covers: AC-HOMEFIT-11, 12, 15, 16, 17, 21, 23

  `/brews` 표의 보조줄과 같은 조회(`useBeanLabel`·`useBrewers`·레시피 캐시). 관찰은 `DayList`가 고른다.

- [ ] **Task 7: 모바일 날짜 목록 원장 행** — Covers: AC-HOMEFIT-13

- [ ] **Task 8: e2e·스텁 정합·목업 대조** — Covers: AC-HOMEFIT-22 (+ e2e 부분)

  `homeCalendar` 픽스처에 `2026-09-19`를 넣어 목록이 있는 날에 점이 찍히게 한다. `e2e/home-fidelity.spec.ts`,
  `pnpm compare`로 `home-390`·`home-1440` 재생성.

---

## 수동 확인

- [ ] ★ `pnpm compare`의 `home-390`·`home-1440`에서 목업 C1·CW1 대비 「큼」 격차 0건. 비교 이미지를 PR 본문에 첨부한다

## 열어둔 결정

- 월간 패턴 관찰 문구 — 무엇을 셀지(온도·비율·원두) 규칙이 생기면 별도 스펙으로 연다
