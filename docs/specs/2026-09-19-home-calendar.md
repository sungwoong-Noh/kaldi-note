---
id: HOMECAL
title: 홈 달력 — 언제 내렸는지 한눈에 보기 (모바일 + 웹)
status: 구현완료
plan: docs/plans/2026-09-19-plan-home-calendar.md
---

# 홈 달력 스펙

> 2026-09-19 `/interview`로 확정. 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md).
> **모든 인수 조건은 자동화된 테스트로 옮길 수 있어야 한다.**
>
> 디자인 근거: [`docs/design/design_handoff_kaldi_note/HOME-CALENDAR.md`](../design/design_handoff_kaldi_note/HOME-CALENDAR.md)
> (모바일 = `Kaldi Note Home - Calendar.dc.html`, 웹 = `Kaldi Note Home - Calendar Web.dc.html`)

## 무엇을

**홈을 달력으로 바꾼다.** 지금 홈은 최근 기록 3개를 세로로 세운다. 바뀐 홈은 **언제 내렸는지**를
보여준다 — 기록이 있는 날에 점이 찍히고, 날짜를 누르면 그날의 기록이 달력 아래(웹은 우측 컬럼)에
나온다.

**남의 달력을 같은 화면에서 본다.** 달력 위의 가로 레일에서 맞팔로우인 사람을 고르면 같은 달력이
그 사람의 기록으로 갈아끼워진다.

**한 벌의 규칙을 두 레이아웃으로 그린다.** 모바일은 44px 정사각 셀에 점만, 웹은 박스 셀에 점과
대표 레시피명 한 줄이 들어가고 선택한 날짜는 우측 420px 컬럼으로 빠진다.

원칙: **빈 날을 채우거나 위로하지 않는다.** 연속 기록일·스트릭·배지·칭찬 문구를 두지 않는다.
빈 날이 많다는 사실 자체가 사용자에게 필요한 정보다.

### 범위 밖 (Non-goals)

- **닉네임 검색.** 핸드오프의 레일 마지막 「찾기」 칸은 **만들지 않는다.**
  `docs/specs/2026-09-05-web-follow.md:18`이 「2인 서비스에서 계정을 열거할 수 있게 만드는 것이
  얻는 것보다 크다」로 거부한 비목표를 유지한다. 팔로우는 기존대로 초대 링크(`/more` → `/u/{id}`)로
  맺는다.
- **스트릭·연속 기록일·배지·칭찬 문구.** 위의 원칙 그대로다.
- **여러 사람을 겹쳐 보는 모드.** 레일은 한 번에 한 사람만 선택한다 — 점이 누구 것인지 모호해진다.
- **주 단위 뷰.** 월 단위 하나만 만든다.
- **낙관적 반영.** 새 기록을 저장해도 서버 응답 전에 점을 찍지 않는다. 홈으로 돌아올 때 캐시를
  무효화해 다시 읽는다. 되돌리기 로직과 토스트 컴포넌트가 이번 분량에 들어오지 않게 한다.
- **남의 기록 수정·삭제.** 남의 달력은 읽기 전용이다. 레시피가 필요하면 포크한다.
- **홈 밖 화면의 웹 레이아웃.** 상단 바는 **홈에만** 둔다. `/recipes`·`/brews`·`/more`는 기존
  하단 탭바를 그대로 쓴다. 전 화면 적용은 별도 스펙으로 연다.
- **아바타 드롭다운 메뉴.** 웹 상단 바의 아바타는 `/more`로 가는 링크 하나다.
- **파비콘·앱 아이콘·PWA 매니페스트 교체.** 이번에 쓰는 에셋은 웹 상단 바의 로고 심볼 하나뿐이다.
  나머지 8개 SVG의 반영은 별도 스펙이며, 앱 아이콘은 실기기 확인이 필요하다.
- **우측 카드의 푸어 타이머·스텝 시퀀스.** 카드는 읽기용 요약이다.

## 왜

**"같은 레시피를 여러 번 내렸을 때 결과 차이를 추적한다"가 이 서비스의 존재 이유인데
(`CLAUDE.md` 설계 결정 1번), 지금 홈은 그 축을 보여주지 않는다.** 최근 3개를 세로로 세우는 화면은
「무엇을 내렸나」만 답하고 「언제, 얼마나 자주 내렸나」에 답하지 않는다. 달력은 그 질문에 답하는
가장 싼 형식이다.

**맞팔로우를 맺어도 상대의 기록을 훑을 경로가 사실상 없다.** `FRIENDS` 판정은 구현돼 있고 목록도
그 판정을 태우지만, 상대의 기록은 `/brews` 목록에 내 것과 **뒤섞여** 나온다. 「지연이 이번 달에 몇
번 내렸나」를 보려면 목록을 끝까지 넘기며 눈으로 골라야 한다.

**날짜가 화면마다 다르게 보일 위험이 지금도 있다.** 프론트는 `brewedAt`의 UTC 문자열 앞 10글자를
잘라 날짜로 쓴다(`frontend/src/features/brewlog/components/BrewLogCard.tsx:96`). 한국 시간 아침
8시에 내린 기록은 UTC로 전날 23시다 — 목록에서는 눈에 띄지 않던 하루 오차가 **달력에서는 점이 전날
칸에 찍히는 것으로 드러난다.** 아침 커피가 주용도인 서비스에서 대부분의 기록이 틀린다.

## 뒤집는 기존 결정

**이 스펙은 기존 문서의 비목표 세 개를 의도적으로 뒤집는다.** 각각 근거를 남긴다.

| 뒤집는 것 | 어디에 있었나 | 왜 지금 뒤집나 |
|---|---|---|
| 팔로워/팔로잉 목록 조회 | `2026-08-17-visibility-authorization.md:519`, `2026-09-05-web-follow.md:21` — 「사용자가 3명 이상이 되어 '누구를 팔로우했더라'가 실제 문제가 될 때」 | 미룬 이유가 **목록을 열거할 필요가 없어서**였는데, 레일은 열거가 **화면의 형식 자체**다. 다만 열거 범위를 **맞팔로우로 한정**해 「계정을 찾아낼 수 있게 된다」는 원래 우려는 발생하지 않는다 — 이미 서로 팔로우한 사이만 나온다 |
| 데스크톱 전용 레이아웃 | `2026-09-01-web-shell.md`의 비목표 4 — 「하단 탭바를 넓은 화면에서도 그대로 쓴다」 | 달력은 **가로 공간이 있으면 정보량이 질적으로 달라지는** 첫 화면이다. 1440px에서 44px 셀을 쓰면 화면의 2/3가 빈다. 다만 뒤집는 범위를 **홈 한 화면**으로 묶는다 |
| 요약 응답에서 `overallNote` 제외 | `2026-08-19-list-query-api.md`의 「요약 응답」 정의 | 웹 우측 카드가 메모 한 줄을 그린다. 되돌리는 비용은 응답 크기이고, 2인 규모에서 실현되지 않는다. 대안(카드마다 단건 조회)은 기록 4건인 날에 요청이 4회 더 나간다 |

## 용어

| 용어 | 정의 |
|---|---|
| 레일 | 달력 위의 가로 목록. **맞팔로우인 사람만** 담고, 첫 칸은 항상 「나」다 |
| 맞팔로우 | 서로 팔로우한 상태. `FollowStatusResponse.mutual`이 `true`이며 `FRIENDS` 공개범위 판정과 같은 값 |
| 기록일 | KST 기준으로 그 날짜에 `brewedAt`이 속하는 살아 있는 기록이 1건 이상 있는 날 |
| 대표 레시피명 | 그날 **가장 늦게 내린** 기록의 레시피 제목. 웹 셀의 한 줄 요약에 쓴다 |
| 내 달력 / 남의 달력 | 레일에서 「나」가 선택된 상태 / 맞팔로우인 다른 사람이 선택된 상태 |
| 희소 배열 | 기록이 있는 날짜만 담는 배열. 빈 날은 항목 자체가 없다 |

## 날짜 기준 — `Asia/Seoul` 고정

**이 스펙의 모든 「날짜」는 `Asia/Seoul`(UTC+9) 기준이다.** 서버가 집계할 때도, 프론트가 표시할 때도
같다. 서머타임이 없어 오프셋이 항상 `+9`이므로 상수로 다룰 수 있고, 테스트가 실행 환경의 타임존에
좌우되지 않는다.

| UTC `brewedAt` | KST 날짜 |
|---|---|
| `2026-09-18T23:00:00Z` | `2026-09-19` |
| `2026-09-19T14:59:59Z` | `2026-09-19` |
| `2026-09-19T15:00:00Z` | `2026-09-20` |

**기존 화면도 함께 고친다.** `/brews` 목록(`BrewLogCard`)과 기록 상세(`BrewDetail`)가 쓰는
`slice(0, 10)`을 공용 포맷 함수로 바꾼다. 고치지 않으면 같은 기록이 달력에서는 19일, 목록에서는
18일로 보인다.

## 데이터

**스키마 변경 없음.** 마이그레이션을 추가하지 않는다. 집계는 기존 `brew_logs`와
`idx_brew_logs_alive` 인덱스로 처리한다.

## API

| 메서드 | 경로 | 인증 | 성공 상태 | 설명 |
|---|---|---|---|---|
| `GET` | `/api/v1/brew-logs/calendar` | 필요 | 200 | **신규.** 월별 기록일 집계 |
| `GET` | `/api/v1/users/me/mutual-follows` | 필요 | 200 | **신규.** 맞팔로우 목록 (배열, 페이지 봉투 아님) |
| `GET` | `/api/v1/brew-logs` | 필요 | 200 | **수정.** `date` 파라미터 추가 + 요약에 `overallNote` 추가 |

**검증 순서는 기존 스펙과 같다:** `401`(미인증) → `400`(필드 검증).
이 스펙의 두 신규 엔드포인트는 `403`·`404`를 내지 않는다 — 아래 「볼 수 없는 대상」 참조.

### `GET /api/v1/brew-logs/calendar`

| 이름 | 타입 | 필수 | 기본값 | 설명 |
|---|---|---|---|---|
| `userId` | `Long` | X | 호출자 본인 | 누구의 달력인가 |
| `month` | `String` | O | — | `YYYY-MM`. **KST 기준의 달** |

```
GET /api/v1/brew-logs/calendar?userId=12&month=2026-09
Authorization: Bearer <토큰>
```

```json
{
  "month": "2026-09",
  "totalCount": 9,
  "days": [
    { "date": "2026-09-02", "count": 1, "primaryRecipeName": "Hoffmann V60" },
    { "date": "2026-09-05", "count": 2, "primaryRecipeName": "Kasuya 4:6" }
  ]
}
```

- `days`는 **희소 배열**이다 — 기록이 없는 날은 항목 자체가 없다.
- `days`는 `date` 오름차순이다.
- `totalCount`는 그 달 전체 건수이며 `days[*].count`의 합과 같다.
- `primaryRecipeName`은 그날 `brewedAt DESC, id DESC`로 정렬했을 때 첫 기록의 레시피 제목이다.
  **모바일은 이 값을 쓰지 않는다** — 웹 셀의 한 줄 요약 전용이다.

### `GET /api/v1/users/me/mutual-follows`

```json
[
  { "id": 12, "nickname": "지연", "profileImageUrl": "https://k.kakaocdn.net/dn/xxxx/profile.jpg" },
  { "id": 18, "nickname": "민재" }
]
```

- **페이지 봉투가 아니라 배열이다.** `GET /gear/user-grinders`와 같은 방식이다 — 맞팔로우 수는
  페이지네이션이 필요한 규모가 아니다.
- 필드는 `PublicProfileResponse`와 같다. **`email`·`role`·`createdAt`을 담지 않는다.**
- `profileImageUrl`은 null일 수 있다. `non_null` 직렬화라 null이면 키가 통째로 빠진다.
- **호출자 자신은 담기지 않는다.** 레일의 「나」 칸은 프론트가 `GET /users/me`로 따로 그린다.

**정렬:** 마지막 기록이 최근인 순. 아래 규칙을 **순서대로** 적용한다.

1. 호출자가 **볼 수 있는** 그 사람의 기록 중 가장 늦은 `brewedAt`이 최근인 순 (내림차순)
2. 볼 수 있는 기록이 **한 건도 없는** 사람은 위 그룹 **뒤에** 놓는다
3. 같은 그룹 안에서 값이 같으면(둘 다 무기록이거나, `brewedAt`이 같으면) **닉네임 오름차순**

3번이 없으면 PostgreSQL이 순서를 보장하지 않아 레일의 칸 순서가 요청마다 달라진다.

### `GET /api/v1/brew-logs` 변경

| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `date` | `String` | X | `YYYY-MM-DD`. **KST 기준의 하루.** 기존 `recipeId`·`userId`·`beanBatchId`와 `AND`로 결합 |

**요약 응답에 `overallNote`를 추가한다.** `BrewLogSummaryResponse`가 단건 응답과 같은 필드 집합이
된다. `null`이면 `non_null` 직렬화로 키가 빠진다.

### 볼 수 없는 대상

세 엔드포인트 모두 `list-query-api.md`의 규칙을 그대로 따른다 — **존재하지 않거나 볼 수 없는
`userId`를 가리켜도 `403`·`404`를 내지 않고 `200`과 빈 결과를 반환한다.** `id`를 바꿔가며 요청해
타인의 존재 여부를 알아내는 것을 막기 위해서다.

**주의: 「맞팔로우가 아니다」와 「빈 결과」는 같지 않다.** 집계 범위는 단건 판정 규칙의 확장이므로,
맞팔로우가 아닌 사람이라도 **그 사람의 `PUBLIC` 기록은 집계된다.** 맞팔로우가 아닐 때 빠지는 것은
`FRIENDS`와 `PRIVATE`뿐이다.

### 파라미터 검증

| 상황 | 상태 | `code` |
|---|---|---|
| `month`가 `YYYY-MM` 형식이 아니다 (`2026-13`, `26-09`, 생략) | `400` | `INVALID_REQUEST` |
| `date`가 `YYYY-MM-DD` 형식이 아니다 (`2026-9-19`) | `400` | `INVALID_REQUEST` |
| `month`가 미래 달이다 | `200` | — (빈 결과) |
| 토큰 없음 | `401` | — |

**미래 달을 서버가 막지 않는 이유:** 「미래」의 기준이 서버 시계에 의존해 자정 직전 요청의 결과가
예측 불가능해진다. 미래로 넘어가지 못하게 하는 것은 화면의 일이다(`AC-HOMECAL-32`).

## 화면

| 경로 | 무엇 |
|---|---|
| `/` | **전면 교체.** 최근 기록 3개 → 달력 |

### 공통 규칙 (모바일·웹 동일)

| 항목 | 값 |
|---|---|
| 주 시작 | **월요일** |
| 기록 점 | 건수와 무관하게 **항상 1개**. 5px 원, `signal-record` |
| 기록 없는 날 | 같은 크기의 **투명한 자리를 유지**한다 (숫자 baseline이 흔들리지 않게) |
| 진입 시 | **오늘이 자동 선택**된다 |
| 월을 넘기면 | **선택 없음** 상태. 그 달의 최근 기록일을 대신 고르지 않는다 |
| 빈 날짜를 누르면 | **선택되고** 「이 날에는 기록이 없습니다.」 한 줄을 보여준다 |
| 기록이 1건인 날 | 상세로 직행하지 않는다. 항상 목록에 1행으로 표시한다 |
| 미래 달 | **넘어가지 않는다.** 이번 달에서 다음 달 버튼이 비활성 |
| 과거 달 | **하한 없음** |
| 사람을 바꾸면 | `selectedMonth`는 유지, `selectedDate`는 초기화(오늘이 그 달에 있으면 오늘, 아니면 `null`) |

### 문구 (리터럴)

| 자리 | 내 달력 | 남의 달력 |
|---|---|---|
| 월 헤더 | `2026.09` + `9 BREWS` | `2026.09` + `지연 · 6 BREWS` |
| 목록 헤더 (모바일) | `09.19 SAT · 2 BREWS` | `09.19 SAT · 지연 · 1 BREW` |
| 관계 문구 (목록 하단) | 없음 | `맞팔로우 — 서로의 기록이 보입니다` |
| 빈 날짜 | `이 날에는 기록이 없습니다.` | 같음 |

**건수 라벨:** `1`이면 `1 BREW`, 그 외에는 `N BREWS`. `0`이면 `0 BREWS`.

**관계 문구는 `web-follow.md`의 것을 그대로 재사용한다.** 핸드오프는 「맞팔로우 상태여서 지연 님의
기록이 보입니다.」를 제안했으나, 같은 관계를 `/u/{id}` 프로필과 홈이 다르게 말하지 않는다.

### 대표 수치

목록 행·카드의 우측 수치는 **`extractionYieldPercent`가 있으면 `20.4 %`, 없으면
`brewRatio`로 `1:15.6`**. 내 기록과 남의 기록에 같은 규칙을 쓴다.

### 모바일 (`< 760px`)

```
헤더           로고만
레일           가로 스크롤, 아바타 50px, 선택은 2px 링
월 헤더        2026.09 + 건수 + ‹ ›
요일 헤더       월 화 수 목 금 토 일
달력 그리드     7열 × 5~6행, 셀 44px 정사각, 점만
──────────── 1px divider
날짜별 목록     선택된 날짜의 기록 (← 이 영역만 스크롤)
CTA            기록하기
탭 바          홈 · 레시피 · 기록 · 더보기
```

- 행은 기존 **원장 행** 컴포넌트를 쓴다. 행을 누르면 `/brews/[id]`.
- 첫 주의 빈칸은 같은 높이의 빈 `div`다.
- 하단 CTA 「기록하기」 → **`/recipes`.**

> **구현 중 정정(2026-09-19, 사람 승인).** 원래 이 CTA와 웹의 두 CTA 모두 `/brews/new`로
> 보내고 선택 날짜를 `?date=`로 프리필하려 했다. 구현하며 `/brews/new`가 **`recipeId`를
> 필수로 받는다**는 것을 발견했다(`BrewLogForm`이 그 값으로 레시피를 조회해 목표 수치를
> 그린다) — 캘린더 홈에는 「이 레시피」라고 부를 특정 레시피가 없어 `NaN`으로 깨진다.
> **날짜 프리필은 이번 범위에서 뺀다.** 세 CTA(모바일 하단·웹 상단 바·웹 우측 하단) 모두
> `/recipes`로 보내 레시피를 먼저 고르게 한다 — 기존 흐름(레시피 상세의 「이 레시피로
> 내렸다」)과 같다. `/brews/new`에 `recipeId` 없이도 열리는 진입점을 만드는 것은 별도
> 스펙이다(「열어둔 결정」 참조).

### 웹 (`≥ 1100px`)

```
상단 바        로고 + 홈·레시피·기록 + 기록하기 + 아바타      (고정)
레일           상단 바 아래 가로 전폭, 선택은 채운 pill        (고정)
├─ 좌측 flex:1   월 헤더 → 요일 헤더 → 달력 그리드
└─ 우측 420px   선택 날짜 헤더 → 기록 카드 (← 이 영역만 스크롤) → 맥락 CTA
```

- **셀은 박스다.** 남는 세로 높이를 5행(6주에 걸친 달이면 6행)이 `1fr`로 나눠 갖는다.
  **그리드 영역 전체 높이는 달이 바뀌어도 같아야 한다.**
- 셀 내용: 날짜 숫자 + 점(숫자 오른쪽 6px) + 대표 레시피명 한 줄 + 2건 이상이면 `외 N건`.
  **최대 2줄까지만.** 기록을 셀 안에 쌓지 않는다 — 그건 우측 컬럼의 일이다.
- 다른 달 칸은 내용 없이 배경만 채운다.
- 선택된 셀은 `inset 0 0 0 2px` 링 + 배경. **셀 전체가 클릭 영역이다.**
- 우측 카드: roast dot + 레시피명 + 원두·기구·시각 캡션 + 대표 수치 / 태그 줄(비율·온도·시간·별점)
  / 메모(있을 때) / Observation 블록(`diagnosis`가 있을 때).
- **CTA가 둘이고 하는 일이 다르다.** (단, 위 정정으로 내 달력의 둘 다 목적지는 같다 — `/recipes`)

| 자리 | 내 달력 | 남의 달력 |
|---|---|---|
| 상단 바 (전역) | primary `기록하기` → `/recipes` | 같음 |
| 우측 하단 (선택 날짜 종속) | primary `이 날짜로 기록 추가` → `/recipes` | secondary `지연 님 프로필 보기` → `/u/12` |

- 상단 바의 아바타를 누르면 `/more`로 간다.
- 로고는 `docs/design/design_handoff_kaldi_note/assets/logo-symbol.svg`(`currentColor` 상속판)
  **심볼 + HTML 텍스트 워드마크** 조합이다. 락업 SVG를 쓰지 않는다 — 워드마크가 `<text>`로
  조판돼 있어 폰트 의존이 생긴다.

### 반응형 분기

| 폭 | 레이아웃 |
|---|---|
| `≥ 1100px` | 좌측 달력 + 우측 420px 2컬럼 |
| `760–1099px` | 1컬럼 — 달력 아래에 선택 날짜 목록. **셀은 웹 박스 유지** |
| `< 760px` | 모바일 — 셀 44px 정사각, 점만, 요약 줄 없음 |

경계는 **`1100`과 `760`이 각각 넓은 쪽에 포함된다** — `1100px`는 2컬럼, `1099px`는 1컬럼,
`760px`는 1컬럼, `759px`는 모바일이다.

### 디자인 토큰 추가

| Token | 라이트 | 다크 | 용도 |
|---|---|---|---|
| `--signal-record` | `oklch(0.55 0.16 30)` | `oklch(0.65 0.17 30)` | 달력의 기록 점 — **이 용도 외에는 쓰지 않는다** |

치수·색의 나머지 값은 전부
[`HOME-CALENDAR.md`](../design/design_handoff_kaldi_note/HOME-CALENDAR.md)를 따른다. 스펙에
중복해 적지 않는다 — 두 곳에 적으면 언젠가 어긋난다.

### 접근성

- 날짜 셀은 `button`, `aria-label="9월 19일, 기록 2건"` / 기록이 없으면 `"9월 19일, 기록 없음"`.
- 선택된 셀에 `aria-current="date"`.
- 점은 장식이므로 `aria-hidden` — 정보는 label 텍스트로 전달한다.
- 레일은 `role="tablist"`, 각 칸이 `role="tab"` + `aria-selected`.
- `←` `→`로 하루, `↑` `↓`로 7일 이동.

### 캐싱

- 캐시 키는 `(userId, month)`. 월을 앞뒤로 오갈 때 재요청하지 않는다.
- 현재 달을 읽을 때 **이전 달도 함께 프리페치**한다.
- 로딩 중에는 점만 비우고 **그리드 골격은 그대로 둔다.** 스켈레톤 블록을 깔지 않는다 —
  레이아웃이 튄다.
- 새 기록을 저장하고 홈으로 돌아오면 달력 쿼리를 무효화해 다시 읽는다.

---

## 어떻게 동작 — 인수 조건

### 정상 동작 — 달력 집계 API

#### AC-HOMECAL-01 · 기록이 있는 날짜만 담는다

- **Given** 2026-09에 `2026-09-02`와 `2026-09-05`(KST)에만 기록이 있는 사용자
- **When** `GET /api/v1/brew-logs/calendar?month=2026-09`
- **Then** `days`의 길이가 `2`이고 `date`가 각각 `"2026-09-02"`, `"2026-09-05"`다
- **검증** API 테스트 `BrewLogCalendarControllerTest`

#### AC-HOMECAL-02 · UTC 전날 23시 기록은 KST 다음 날에 집계된다

- **Given** `brewedAt`이 `2026-09-18T23:00:00Z`인 기록 1건만 있는 사용자
- **When** `GET /api/v1/brew-logs/calendar?month=2026-09`
- **Then** `days`가 `[{ "date": "2026-09-19", "count": 1, ... }]`다 — `2026-09-18`이 아니다
- **검증** API 테스트 `BrewLogCalendarControllerTest`

#### AC-HOMECAL-03 · KST 자정 경계가 `15:00:00Z`에서 갈린다

- **Given** `brewedAt`이 각각 `2026-09-19T14:59:59Z`, `2026-09-19T15:00:00Z`인 기록 2건
- **When** `GET /api/v1/brew-logs/calendar?month=2026-09`
- **Then** `days`가 `[{"date":"2026-09-19","count":1,...},{"date":"2026-09-20","count":1,...}]`다
- **검증** API 테스트 `BrewLogCalendarControllerTest`

#### AC-HOMECAL-04 · 같은 날 2건이면 항목은 1개이고 count가 2다

- **Given** `2026-09-05`(KST)에 기록 2건이 있는 사용자
- **When** `GET /api/v1/brew-logs/calendar?month=2026-09`
- **Then** `date`가 `"2026-09-05"`인 항목이 **1개**이고 그 `count`가 `2`다
- **검증** API 테스트 `BrewLogCalendarControllerTest`

#### AC-HOMECAL-05 · totalCount는 그 달 전체 건수다

- **Given** `2026-09-02`에 1건, `2026-09-05`에 2건이 있는 사용자
- **When** `GET /api/v1/brew-logs/calendar?month=2026-09`
- **Then** `totalCount`가 `3`이고 `month`가 `"2026-09"`다
- **검증** API 테스트 `BrewLogCalendarControllerTest`

#### AC-HOMECAL-06 · days는 date 오름차순이다

- **Given** `2026-09-20`, `2026-09-02`, `2026-09-11` 순으로 저장된 기록 3건
- **When** `GET /api/v1/brew-logs/calendar?month=2026-09`
- **Then** `days[*].date`가 `["2026-09-02", "2026-09-11", "2026-09-20"]`이다
- **검증** API 테스트 `BrewLogCalendarControllerTest`

#### AC-HOMECAL-07 · 소프트 삭제된 기록은 집계되지 않는다

- **Given** `2026-09-02`에 기록 2건이 있고 그중 1건의 `deleted_at`이 `NULL`이 아니다
- **When** `GET /api/v1/brew-logs/calendar?month=2026-09`
- **Then** `date`가 `"2026-09-02"`인 항목의 `count`가 `1`이고 `totalCount`가 `1`이다
- **검증** API 테스트 `BrewLogCalendarControllerTest`

#### AC-HOMECAL-08 · 맞팔로우 상대의 FRIENDS 기록이 집계된다

- **Given** 호출자와 상호 팔로우한 사용자 `12`가 `2026-09-05`에 `visibility=FRIENDS` 기록 1건
- **When** `GET /api/v1/brew-logs/calendar?userId=12&month=2026-09`
- **Then** `totalCount`가 `1`이고 `days`에 `"2026-09-05"`가 있다
- **검증** API 테스트 `BrewLogCalendarControllerTest`

#### AC-HOMECAL-09 · 맞팔로우가 아니면 PUBLIC만 집계된다

- **Given** 호출자와 팔로우 관계가 없는 사용자 `12`가 `2026-09-05`에 `PUBLIC` 1건,
  `2026-09-06`에 `FRIENDS` 1건, `2026-09-07`에 `PRIVATE` 1건
- **When** `GET /api/v1/brew-logs/calendar?userId=12&month=2026-09`
- **Then** `totalCount`가 `1`이고 `days`가 `2026-09-05` 하나뿐이다
- **검증** API 테스트 `BrewLogCalendarControllerTest`

#### AC-HOMECAL-10 · 존재하지 않는 userId는 200과 빈 결과다

- **Given** 어떤 사용자도 갖지 않는 `userId=999999`
- **When** `GET /api/v1/brew-logs/calendar?userId=999999&month=2026-09`
- **Then** HTTP `200`, `days`가 `[]`, `totalCount`가 `0`이다 — `403`도 `404`도 아니다
- **검증** API 테스트 `BrewLogCalendarControllerTest`

#### AC-HOMECAL-14 · userId를 생략하면 호출자 본인의 달력이다

- **Given** 호출자가 `2026-09-02`에 기록 1건, 다른 사용자가 `2026-09-03`에 `PUBLIC` 1건
- **When** `GET /api/v1/brew-logs/calendar?month=2026-09` (`userId` 없음)
- **Then** `days`가 `2026-09-02` 하나뿐이다
- **검증** API 테스트 `BrewLogCalendarControllerTest`

#### AC-HOMECAL-66 · primaryRecipeName은 그날 가장 늦게 내린 기록의 레시피명이다

- **Given** `2026-09-05`(KST)에 `08:00`에 「Hoffmann V60」, `14:00`에 「Kasuya 4:6」으로 내린 기록 2건
- **When** `GET /api/v1/brew-logs/calendar?month=2026-09`
- **Then** `date`가 `"2026-09-05"`인 항목의 `primaryRecipeName`이 `"Kasuya 4:6"`이다
- **검증** API 테스트 `BrewLogCalendarControllerTest`

#### AC-HOMECAL-67 · 기록이 없는 날은 days에 항목 자체가 없다

- **Given** `2026-09-02`에만 기록이 있는 사용자
- **When** `GET /api/v1/brew-logs/calendar?month=2026-09`
- **Then** `days`에 `"2026-09-03"`을 `date`로 갖는 항목이 없다 — `count: 0` 항목이 아니다
- **검증** API 테스트 `BrewLogCalendarControllerTest`

### 정상 동작 — 날짜별 목록

#### AC-HOMECAL-15 · date는 KST 기준 하루로 필터한다

- **Given** `brewedAt`이 `2026-09-18T23:00:00Z`, `2026-09-19T14:59:59Z`,
  `2026-09-19T15:00:00Z`인 기록 3건
- **When** `GET /api/v1/brew-logs?date=2026-09-19`
- **Then** `content`의 길이가 `2`이고 `2026-09-19T15:00:00Z` 기록이 빠진다
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-HOMECAL-16 · date와 userId는 AND로 결합된다

- **Given** `2026-09-19`에 호출자 기록 1건, 맞팔로우 사용자 `12`의 기록 1건
- **When** `GET /api/v1/brew-logs?userId=12&date=2026-09-19`
- **Then** `content`의 길이가 `1`이고 그 `userId`가 `12`다
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-HOMECAL-73 · 목록 요약 응답에 overallNote가 담긴다

- **Given** `overallNote`가 `"산미가 강했다"`인 기록 1건
- **When** `GET /api/v1/brew-logs`
- **Then** `content[0].overallNote`가 `"산미가 강했다"`다
- **검증** API 테스트 `BrewLogControllerTest`

### 정상 동작 — 맞팔로우 목록

#### AC-HOMECAL-18 · 맞팔로우인 사람만 담긴다

- **Given** 호출자가 `12`와 상호 팔로우, `13`을 일방 팔로우, `14`에게 일방 팔로우당한 상태
- **When** `GET /api/v1/users/me/mutual-follows`
- **Then** 배열의 길이가 `1`이고 `[0].id`가 `12`다
- **검증** API 테스트 `MutualFollowControllerTest`

#### AC-HOMECAL-19 · 마지막 기록이 최근인 순으로 정렬된다

- **Given** 맞팔로우 `12`의 마지막 기록이 `2026-09-10`, `13`의 마지막 기록이 `2026-09-18`
- **When** `GET /api/v1/users/me/mutual-follows`
- **Then** `[*].id`가 `[13, 12]`다
- **검증** API 테스트 `MutualFollowControllerTest`

#### AC-HOMECAL-20 · 기록이 없는 맞팔로우는 맨 뒤에 닉네임 오름차순으로 놓인다

- **Given** 맞팔로우 `12`(닉네임 `지연`, 기록 있음), `13`(닉네임 `하은`, 기록 없음),
  `14`(닉네임 `민재`, 기록 없음)
- **When** `GET /api/v1/users/me/mutual-follows`
- **Then** `[*].id`가 `[12, 14, 13]`이다 — 무기록자끼리 `민재` → `하은` 순이다
- **검증** API 테스트 `MutualFollowControllerTest`

#### AC-HOMECAL-21 · 마지막 기록 시각이 같으면 닉네임 오름차순이다

- **Given** 맞팔로우 `12`(닉네임 `하은`), `13`(닉네임 `민재`)의 마지막 기록 `brewedAt`이 동일하다
- **When** `GET /api/v1/users/me/mutual-follows`
- **Then** `[*].id`가 `[13, 12]`다
- **검증** API 테스트 `MutualFollowControllerTest`

#### AC-HOMECAL-22 · 응답에 email과 role이 없다

- **Given** `email`과 `role`을 가진 맞팔로우 사용자 1명
- **When** `GET /api/v1/users/me/mutual-follows`
- **Then** `[0]`의 키가 `id`·`nickname`·`profileImageUrl`뿐이고 `email`·`role`·`createdAt` 키가 없다
- **검증** API 테스트 `MutualFollowControllerTest`

#### AC-HOMECAL-23 · 자기 자신은 목록에 없다

- **Given** 맞팔로우가 `12` 한 명인 호출자 `11`
- **When** `GET /api/v1/users/me/mutual-follows`
- **Then** `[*].id`에 `11`이 없다
- **검증** API 테스트 `MutualFollowControllerTest`

### 경계값 — 반응형 분기

#### AC-HOMECAL-55 · 1100px에서 2컬럼이다

- **Given** 기록이 있는 달을 보는 홈, 뷰포트 폭 `1100px`
- **When** 화면을 연다
- **Then** 좌측 달력과 우측 폭 `420px` 컬럼이 동시에 보인다
- **검증** e2e `home-calendar-web.spec.ts`

#### AC-HOMECAL-56 · 1099px에서 1컬럼이고 셀은 웹 박스다

- **Given** 뷰포트 폭 `1099px`
- **When** 화면을 연다
- **Then** 우측 컬럼이 없고 선택 날짜 목록이 달력 **아래**에 있으며, 셀에 대표 레시피명 줄이 있다
- **검증** e2e `home-calendar-web.spec.ts`

#### AC-HOMECAL-57 · 759px에서 모바일 레이아웃이다

- **Given** 뷰포트 폭 `759px`
- **When** 화면을 연다
- **Then** 셀에 대표 레시피명 줄이 없고 하단 탭바가 보인다
- **검증** e2e `home-calendar.spec.ts`

### 정상 동작 — 달력 화면 (공통)

#### AC-HOMECAL-25 · 주 시작이 월요일이다

- **Given** 홈
- **When** 화면을 연다
- **Then** 요일 헤더의 첫 칸이 `월`이고 마지막 칸이 `일`이다
- **검증** 컴포넌트 테스트 `Calendar.test.tsx`

#### AC-HOMECAL-26 · 기록이 2건인 날에도 점은 1개다

- **Given** `2026-09-05`의 `count`가 `2`인 달력 응답
- **When** 화면을 연다
- **Then** `2026-09-05` 셀 안의 점 요소가 `1`개다
- **검증** 컴포넌트 테스트 `Calendar.test.tsx`

#### AC-HOMECAL-27 · 진입하면 오늘이 선택돼 있다

- **Given** 오늘이 `2026-09-19`(KST)
- **When** 홈을 연다
- **Then** `2026-09-19` 셀에 `aria-current="date"`가 있다
- **검증** 컴포넌트 테스트 `HomePage.test.tsx`

#### AC-HOMECAL-28 · 날짜를 누르면 목록이 그 날짜 기록으로 바뀐다

- **Given** `2026-09-05`에 기록 2건이 있는 달력
- **When** `2026-09-05` 셀을 누른다
- **Then** 목록 헤더가 `09.05 SAT · 2 BREWS`이고 행이 2개다
- **검증** 컴포넌트 테스트 `HomePage.test.tsx`

#### AC-HOMECAL-29 · 빈 날짜를 누르면 선택되고 빈 문구가 뜬다

- **Given** `2026-09-03`에 기록이 없는 달력
- **When** `2026-09-03` 셀을 누른다
- **Then** 그 셀에 `aria-current="date"`가 있고 `이 날에는 기록이 없습니다.`가 보인다
- **검증** 컴포넌트 테스트 `HomePage.test.tsx`

#### AC-HOMECAL-30 · 기록이 1건인 날을 눌러도 상세로 이동하지 않는다

- **Given** `2026-09-02`에 기록 1건이 있는 달력
- **When** `2026-09-02` 셀을 누른다
- **Then** 주소가 `/`에 머물고 목록에 행이 1개 있다
- **검증** e2e `home-calendar.spec.ts`

#### AC-HOMECAL-31 · 목록 행을 누르면 상세로 간다

- **Given** `2026-09-02`가 선택돼 있고 그날 기록의 `id`가 `7`
- **When** 목록의 첫 행을 누른다
- **Then** 주소가 `/brews/7`이다
- **검증** e2e `home-calendar.spec.ts`

#### AC-HOMECAL-32 · 이번 달에서 다음 달 버튼이 비활성이다

- **Given** 오늘이 `2026-09-19`이고 `2026-09`를 보는 중
- **When** 화면을 연다
- **Then** 다음 달 버튼이 `disabled`다
- **검증** 컴포넌트 테스트 `MonthNav.test.tsx`

#### AC-HOMECAL-33 · 이전 달로 넘기면 선택 없음 상태가 된다

- **Given** `2026-09-19`가 선택된 `2026-09` 달력
- **When** 이전 달 버튼을 누른다
- **Then** 월 헤더가 `2026.08`이고 `aria-current="date"`인 셀이 없으며 목록이 비어 있다
- **검증** 컴포넌트 테스트 `HomePage.test.tsx`

#### AC-HOMECAL-34 · 좌우 스와이프로 월이 바뀐다

- **Given** `2026-09`를 보는 중
- **When** 달력 영역에서 우로 스와이프한다
- **Then** 월 헤더가 `2026.08`이다
- **검증** e2e `home-calendar.spec.ts`

#### AC-HOMECAL-35 · 화살표 키로 날짜가 이동한다

- **Given** `2026-09-19` 셀에 포커스가 있다
- **When** `→`를 한 번, `↓`를 한 번 누른다
- **Then** 포커스가 `2026-09-20`을 거쳐 `2026-09-27`에 있다
- **검증** 컴포넌트 테스트 `Calendar.test.tsx`

### 정상 동작 — 레일

#### AC-HOMECAL-36 · 첫 칸이 「나」이고 기본 선택이다

- **Given** 맞팔로우가 2명인 사용자
- **When** 홈을 연다
- **Then** 레일의 첫 칸 라벨이 `나`이고 그 칸의 `aria-selected`가 `"true"`다
- **검증** 컴포넌트 테스트 `FollowRail.test.tsx`

#### AC-HOMECAL-37 · 상대를 누르면 달력이 그 사람 기록으로 바뀐다

- **Given** 맞팔로우 `지연`(id `12`)이 레일에 있다
- **When** `지연` 칸을 누른다
- **Then** `GET /api/v1/brew-logs/calendar?userId=12&month=2026-09`가 호출되고
  월 헤더가 `2026.09` + `지연 · 6 BREWS`다
- **검증** 컴포넌트 테스트 `HomePage.test.tsx`

#### AC-HOMECAL-38 · 사람을 바꾸면 month는 유지되고 selectedDate는 초기화된다

- **Given** `2026-08`을 보며 `2026-08-11`을 선택한 내 달력 (오늘은 `2026-09-19`)
- **When** 레일에서 `지연`을 누른다
- **Then** 월 헤더가 `2026.08`이고 `aria-current="date"`인 셀이 없다
- **검증** 컴포넌트 테스트 `HomePage.test.tsx`

#### AC-HOMECAL-39 · 남의 달력에 관계 문구가 뜬다

- **Given** 레일에서 `지연`이 선택돼 있고 기록이 있는 날짜를 골랐다
- **When** 목록을 본다
- **Then** 목록 하단에 `맞팔로우 — 서로의 기록이 보입니다`가 있다
- **검증** 컴포넌트 테스트 `HomePage.test.tsx`

#### AC-HOMECAL-44 · profileImageUrl이 없으면 닉네임 첫 글자가 뜬다

- **Given** `profileImageUrl` 키가 없는 맞팔로우 `{ "id": 12, "nickname": "지연" }`
- **When** 레일을 본다
- **Then** 그 칸에 `img`가 없고 텍스트 `지`가 있다
- **검증** 컴포넌트 테스트 `FollowRail.test.tsx`

#### AC-HOMECAL-47 · 레일이 tablist 역할을 갖는다

- **Given** 맞팔로우가 1명인 사용자
- **When** 홈을 연다
- **Then** 레일 컨테이너가 `role="tablist"`이고 각 칸이 `role="tab"`과 `aria-selected`를 갖는다
- **검증** 컴포넌트 테스트 `FollowRail.test.tsx`

#### AC-HOMECAL-71 · 웹 레일에서 선택된 사람이 채운 pill이다

- **Given** 뷰포트 폭 `1440px`, 레일에서 `나`가 선택됨
- **When** 화면을 연다
- **Then** 선택된 칸의 배경색이 `ink` 토큰 값이고 비선택 칸은 배경이 투명하다
- **검증** e2e `home-calendar-web.spec.ts`

### 정상 동작 — 문구와 수치

#### AC-HOMECAL-40 · 월 헤더 라벨이 달력 주인에 따라 다르다

- **Given** 9월 `totalCount`가 `9`
- **When** 내 달력과 `지연`의 달력을 각각 본다
- **Then** 각각 `9 BREWS`, `지연 · 6 BREWS`다
- **검증** 컴포넌트 테스트 `MonthNav.test.tsx`

#### AC-HOMECAL-41 · 1건은 `1 BREW`, 0건은 `0 BREWS`다

- **Given** `totalCount`가 각각 `1`, `0`인 달력 응답
- **When** 월 헤더를 본다
- **Then** 각각 `1 BREW`, `0 BREWS`다
- **검증** 단위 테스트 `brewCountLabel.test.ts`

#### AC-HOMECAL-42 · 목록 헤더가 날짜·요일·건수를 담는다

- **Given** `2026-09-19`(토)에 기록 2건
- **When** 그 날짜를 선택한다
- **Then** 목록 헤더가 `09.19 SAT · 2 BREWS`다
- **검증** 컴포넌트 테스트 `DayList.test.tsx`

#### AC-HOMECAL-43 · 수율이 없으면 비율을 보여준다

- **Given** `extractionYieldPercent`가 `20.4`인 기록과, 그 키가 없고 `brewRatio`가 `15.6`인 기록
- **When** 목록을 본다
- **Then** 각각 `20.4 %`, `1:15.6`이다
- **검증** 컴포넌트 테스트 `DayList.test.tsx`

### 정상 동작 — 웹 셀

#### AC-HOMECAL-63 · 기록이 있는 셀에 대표 레시피명이 뜬다

- **Given** 뷰포트 폭 `1440px`, `2026-09-05`의 `primaryRecipeName`이 `"Kasuya 4:6"`
- **When** 화면을 연다
- **Then** `2026-09-05` 셀에 `Kasuya 4:6`이 보인다
- **검증** e2e `home-calendar-web.spec.ts`

#### AC-HOMECAL-64 · 기록이 3건이면 `외 2건`이 뜬다

- **Given** 뷰포트 폭 `1440px`, `2026-09-05`의 `count`가 `3`
- **When** 화면을 연다
- **Then** `2026-09-05` 셀에 `외 2건`이 보인다
- **검증** e2e `home-calendar-web.spec.ts`

#### AC-HOMECAL-65 · 기록이 1건이면 `외 N건`이 없다

- **Given** 뷰포트 폭 `1440px`, `2026-09-02`의 `count`가 `1`
- **When** 화면을 연다
- **Then** `2026-09-02` 셀에 `외`로 시작하는 텍스트가 없다
- **검증** e2e `home-calendar-web.spec.ts`

#### AC-HOMECAL-68 · 6주에 걸친 달도 그리드 전체 높이가 같다

- **Given** 뷰포트 폭 `1440px`. `2026-08`은 6주, `2026-09`는 5주에 걸친다
- **When** `2026-09`에서 이전 달로 넘긴다
- **Then** 그리드 컨테이너의 높이가 두 달에서 같고, 행 수가 `5`에서 `6`으로 바뀐다
- **검증** e2e `home-calendar-web.spec.ts`

#### AC-HOMECAL-69 · 다른 달 칸은 내용 없이 배경만 있다

- **Given** 뷰포트 폭 `1440px`, `2026-09-01`이 화요일이라 첫 주 월요일 칸이 8월에 속한다
- **When** 화면을 연다
- **Then** 그 칸에 날짜 숫자도 점도 없고 `button`이 아니다
- **검증** e2e `home-calendar-web.spec.ts`

#### AC-HOMECAL-70 · 선택된 셀에 링과 배경이 있다

- **Given** 뷰포트 폭 `1440px`
- **When** `2026-09-05` 셀을 누른다
- **Then** 그 셀의 `box-shadow`가 `inset`을 포함하고 배경색이 비선택 셀과 다르다
- **검증** e2e `home-calendar-web.spec.ts`

### 정상 동작 — 웹 상단 바와 우측 컬럼

#### AC-HOMECAL-58 · 상단 바에 6개 요소가 있다

- **Given** 뷰포트 폭 `1440px`
- **When** 홈을 연다
- **Then** 로고·`홈`·`레시피`·`기록`·`기록하기`·아바타가 모두 보이고 하단 탭바가 보이지 않는다
- **검증** e2e `home-calendar-web.spec.ts`

#### AC-HOMECAL-59 · 아바타를 누르면 더보기로 간다

- **Given** 뷰포트 폭 `1440px`
- **When** 상단 바의 아바타를 누른다
- **Then** 주소가 `/more`다
- **검증** e2e `home-calendar-web.spec.ts`

#### AC-HOMECAL-60 · 상단 바 CTA는 레시피 선택으로 보낸다

> 2026-09-19 정정 — 원래 문구는 「상단 바 CTA는 날짜를 프리필하지 않는다」였다. 위
> 「구현 중 정정」 참조.

- **Given** 뷰포트 폭 `1440px`, `2026-09-05`가 선택된 상태
- **When** `기록하기`를 누른다
- **Then** 주소가 `/recipes`다
- **검증** e2e `home-calendar-web.spec.ts`

#### AC-HOMECAL-61 · 우측 하단 CTA도 레시피 선택으로 보낸다

> 2026-09-19 정정 — 원래 문구는 「우측 하단 CTA는 선택 날짜를 프리필한다」였다.

- **Given** 뷰포트 폭 `1440px`, 내 달력에서 `2026-09-05`가 선택된 상태
- **When** `이 날짜로 기록 추가`를 누른다
- **Then** 주소가 `/recipes`다
- **검증** e2e `home-calendar-web.spec.ts`

#### AC-HOMECAL-62 · 남의 달력 우측 CTA는 프로필로 간다

- **Given** 뷰포트 폭 `1440px`, 레일에서 `지연`(id `12`)이 선택된 상태
- **When** `지연 님 프로필 보기`를 누른다
- **Then** 주소가 `/u/12`다
- **검증** e2e `home-calendar-web.spec.ts`

#### AC-HOMECAL-72 · 메모가 있으면 카드에 한 줄이 뜬다

- **Given** 뷰포트 폭 `1440px`, 선택 날짜 기록의 `overallNote`가 `"산미가 강했다"`
- **When** 우측 카드를 본다
- **Then** `산미가 강했다`가 보인다
- **검증** e2e `home-calendar-web.spec.ts`

#### AC-HOMECAL-74 · 메모가 없으면 그 줄 자체가 없다

- **Given** 뷰포트 폭 `1440px`, 선택 날짜 기록에 `overallNote` 키가 없다
- **When** 우측 카드를 본다
- **Then** 메모 요소가 DOM에 없다 — 빈 줄이 남지 않는다
- **검증** e2e `home-calendar-web.spec.ts`

#### AC-HOMECAL-77 · diagnosis가 있으면 Observation 블록이 뜬다

- **Given** 뷰포트 폭 `1440px`, 선택 날짜 기록의 `diagnosis`가
  `"TDS가 없어 추출 수율을 계산할 수 없습니다."`
- **When** 우측 카드를 본다
- **Then** 그 문구가 **가공 없이 그대로** 보인다
- **검증** e2e `home-calendar-web.spec.ts`

#### AC-HOMECAL-78 · 상단 바에 로고 심볼이 렌더된다

- **Given** 뷰포트 폭 `1440px`
- **When** 홈을 연다
- **Then** 상단 바에 `svg` 요소와 텍스트 `kaldi·note`가 있다
- **검증** e2e `home-calendar-web.spec.ts`

#### AC-HOMECAL-79 · 우측 컬럼만 스크롤한다

- **Given** 뷰포트 폭 `1440px`, 기록이 4건인 날짜가 선택된 상태
- **When** 우측 컬럼을 아래로 스크롤한다
- **Then** 좌측 달력 그리드의 화면상 `y` 좌표가 변하지 않는다
- **검증** e2e `home-calendar-web.spec.ts`

### 정상 동작 — 반응형 헤더

> **갱신 (2026-09-20).** 모바일에서 헤더가 아예 안 보인다는 수동 확인 중 지적을 받았다.
> `WebTopBar`가 `min-[1100px]:flex`라 그 미만에서는 로고조차 없었다 — 하단 탭바가 네비게이션은
> 대신하지만 브랜드 헤더 자리를 채우지 못한다. 새 컴포넌트를 만들지 않고 같은 `WebTopBar`를
> 확장한다 — `<header>`는 항상 렌더링하고, 로고 심볼 + 워드마크는 항상 보이며, 네비·CTA·아바타만
> `min-[1100px]:flex`로 좁힌다. 적용 폭은 `<1100px` — 기존 `WebTopBar`가 켜지는 지점의 정확한
> 반대편이다.

#### AC-HOMECAL-80 · 1100px 미만에서도 로고 헤더가 보인다

- **Given** 뷰포트 폭 `390px`
- **When** 홈을 연다
- **Then** 상단에 `svg` 요소와 텍스트 `kaldi·note`가 있다
- **검증** e2e `home-calendar.spec.ts`

#### AC-HOMECAL-81 · 그 헤더에는 네비게이션 링크가 없다

- **Given** 뷰포트 폭 `390px`
- **When** 홈을 연다
- **Then** 상단 헤더 안에 `홈`·`레시피`·`기록` 링크가 없다 — 하단 탭바에만 있다
- **검증** e2e `home-calendar.spec.ts`

#### AC-HOMECAL-82 · 그 헤더에는 CTA와 아바타가 없다

- **Given** 뷰포트 폭 `390px`
- **When** 홈을 연다
- **Then** 상단 헤더 안에 `기록하기` 버튼과 프로필 아바타 링크가 없다
- **검증** e2e `home-calendar.spec.ts`

#### AC-HOMECAL-83 · 1100px 이상에서는 기존 전체 헤더가 그대로 보인다

- **Given** 뷰포트 폭 `1440px`
- **When** 홈을 연다
- **Then** 상단 헤더 안에 `홈`·`레시피`·`기록` 링크, `기록하기` 버튼, 아바타가 모두 있다
- **검증** e2e `home-calendar-web.spec.ts` (기존 `AC-HOMECAL-58` 회귀 확인)

#### AC-HOMECAL-84 · 웹에서는 `Shell`의 `max-w-2xl`에 눌리지 않는다

> **2026-09-20 발견.** `Shell` 컴포넌트가 모든 화면에 `max-w-2xl`(672px)을 고정으로 씌운다.
> 홈의 웹 2컬럼 레이아웃(달력 `flex:1` + 우측 고정 `420px`)이 그 안에 눌려 들어가면서
> 달력 칸이 20~30px까지 좁아졌다 — `truncate`를 붙여도 칸 자체가 없으니 소용이 없었다.
> `AC-HOMECAL-55`는 고정폭인 우측 컬럼만 재서 통과했고, 좁아진 좌측 칼럼은 아무도 재지
> 않아 놓쳤다. `Shell`에 `wide` prop을 추가해 홈의 웹 모드(`≥760px`)에서는 그 제약을 뺀다.

- **Given** 뷰포트 폭 `1440px`
- **When** 홈을 연다
- **Then** 달력 그리드(`role="grid"`)의 렌더된 너비가 `900px`보다 크다
- **검증** e2e `home-calendar-web.spec.ts`

### 정상 동작 — roast dot, 접근성, 캐싱

#### AC-HOMECAL-75 · roast dot 색이 로스팅 강도에 따라 다르다

- **Given** `roastLevel`이 각각 `LIGHT`, `DARK`인 원두를 쓴 기록 2건
- **When** 목록을 본다
- **Then** 두 행의 roast dot `background-color`가 서로 다르다
- **검증** 컴포넌트 테스트 `RoastDot.test.tsx`

#### AC-HOMECAL-76 · 원두를 연결하지 않은 기록은 roast dot이 없다

- **Given** `beanBatchId` 키가 없는 기록 1건
- **When** 목록을 본다
- **Then** 그 행에 roast dot 요소가 없다
- **검증** 컴포넌트 테스트 `DayList.test.tsx`

#### AC-HOMECAL-45 · 날짜 셀의 aria-label이 건수를 말한다

- **Given** `2026-09-19`에 기록 2건, `2026-09-03`에 기록 없음
- **When** 두 셀의 `aria-label`을 읽는다
- **Then** 각각 `"9월 19일, 기록 2건"`, `"9월 3일, 기록 없음"`이다
- **검증** 컴포넌트 테스트 `Calendar.test.tsx`

#### AC-HOMECAL-46 · 선택된 셀에 aria-current가 있다

- **Given** `2026-09-05`를 선택한 상태
- **When** DOM을 본다
- **Then** `aria-current="date"`인 요소가 정확히 1개이고 그것이 `2026-09-05` 셀이다
- **검증** 컴포넌트 테스트 `Calendar.test.tsx`

#### AC-HOMECAL-48 · 모바일 하단 CTA는 레시피 선택으로 보낸다

> 2026-09-19 정정 — 원래 문구는 「모바일 하단 CTA는 선택 날짜를 프리필한다」였다. `/brews/new`가
> `recipeId`를 필수로 받아 캘린더 홈에서 곧바로 열 수 없다는 것을 구현 중 발견했다(사람 승인,
> 위 「구현 중 정정」 참조). 날짜 프리필은 이번 범위에서 뺀다.

- **Given** 뷰포트 폭 `390px`, `2026-09-05`가 선택된 상태
- **When** `기록하기`를 누른다
- **Then** 주소가 `/recipes`다
- **검증** e2e `home-calendar.spec.ts`

#### AC-HOMECAL-49 · 기록을 저장하고 돌아오면 점이 찍혀 있다

- **Given** `2026-09-19`에 기록이 없는 달력
- **When** `/brews/new`에서 `2026-09-19`로 기록을 저장하고 홈으로 돌아온다
- **Then** `2026-09-19` 셀에 점이 있다
- **검증** e2e `home-calendar.spec.ts`

#### AC-HOMECAL-50 · 이전 달로 넘길 때 추가 요청이 없다

- **Given** `2026-09`를 열어 `2026-09`와 `2026-08` 응답을 이미 받았다
- **When** 이전 달 버튼을 누른다
- **Then** `month=2026-08`에 대한 네트워크 요청이 추가로 발생하지 않는다
- **검증** 컴포넌트 테스트 `HomePage.test.tsx` (MSW 요청 카운트)

#### AC-HOMECAL-51 · 기록이 4건인 날에도 달력 위치가 변하지 않는다

- **Given** 뷰포트 폭 `390px`, 기록이 1건인 날이 선택된 상태에서 그리드의 `y` 좌표를 기록한다
- **When** 기록이 4건인 날을 선택한다
- **Then** 그리드의 `y` 좌표가 같다
- **검증** e2e `home-calendar.spec.ts`

#### AC-HOMECAL-52 · 로딩 중에도 그리드 골격이 유지된다

- **Given** 달력 응답이 아직 오지 않은 상태
- **When** 화면을 본다
- **Then** 7열 그리드와 날짜 숫자가 이미 있고 점만 없다 — 스켈레톤 블록이 없다
- **검증** 컴포넌트 테스트 `HomePage.test.tsx`

#### AC-HOMECAL-53 · signal-record 토큰이 라이트·다크에서 각각 지정값이다

- **Given** `globals.css`
- **When** 라이트와 다크에서 `--signal-record`를 읽는다
- **Then** 각각 `oklch(0.55 0.16 30)`, `oklch(0.65 0.17 30)`이다
- **검증** 단위 테스트 `tokens.test.ts`

#### AC-HOMECAL-54 · 기존 목록과 상세가 KST 날짜로 표시된다

- **Given** `brewedAt`이 `2026-09-18T23:00:00Z`인 기록
- **When** `/brews` 목록과 `/brews/[id]` 상세를 본다
- **Then** 두 곳 모두 `2026-09-19`를 보여준다 — `2026-09-18`이 아니다
- **검증** 컴포넌트 테스트 `BrewLogCard.test.tsx`, `BrewDetail.test.tsx`

### 에러

#### AC-HOMECAL-11 · month 형식이 틀리면 400이다

- **Given** 인증된 호출자
- **When** `GET /api/v1/brew-logs/calendar?month=2026-13`
- **Then** HTTP `400`과 `code: "INVALID_REQUEST"`를 반환한다
- **검증** API 테스트 `BrewLogCalendarControllerTest`

#### AC-HOMECAL-12 · 미래 달은 200과 빈 결과다

- **Given** 오늘이 `2026-09-19`
- **When** `GET /api/v1/brew-logs/calendar?month=2027-01`
- **Then** HTTP `200`, `days`가 `[]`, `totalCount`가 `0`이다
- **검증** API 테스트 `BrewLogCalendarControllerTest`

#### AC-HOMECAL-13 · 토큰이 없으면 401이다

- **Given** `Authorization` 헤더 없음
- **When** `GET /api/v1/brew-logs/calendar?month=2026-09`
- **Then** HTTP `401`을 반환한다
- **검증** API 테스트 `BrewLogCalendarControllerTest`

#### AC-HOMECAL-17 · date 형식이 틀리면 400이다

- **Given** 인증된 호출자
- **When** `GET /api/v1/brew-logs?date=2026-9-19`
- **Then** HTTP `400`과 `code: "INVALID_REQUEST"`를 반환한다
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-HOMECAL-24 · 맞팔로우 목록도 토큰이 없으면 401이다

- **Given** `Authorization` 헤더 없음
- **When** `GET /api/v1/users/me/mutual-follows`
- **Then** HTTP `401`을 반환한다
- **검증** API 테스트 `MutualFollowControllerTest`

---

## 수동 확인

> 규칙은 [`docs/conventions/verification.md`](../conventions/verification.md) 참조.
> 아래는 전부 **차단형이 아니다** — `status`를 막지 않는다.

- [ ] 폰에서 달력을 좌우로 스와이프할 때 월 전환이 손에 붙는가 (임계 거리·속도)
- [ ] 5px 점이 실기기 화면에서 충분히 보이는가 — 특히 주말 칸의 밝은 명도 위에서
- [x] 1440px에서 셀의 레시피명 한 줄이 실제 레시피 제목 길이로 ellipsis 되는가

  > **갱신 (2026-09-20).** 수동 확인이 아니라 결함이었다 — 잘림 자체가 코드에 없어서, 긴
  > 레시피명("Tetsu Kasuya 4:6 Method" 등)이 줄바꿈 없이 쌓여 다음 주 칸까지 겹쳐 화면이
  > 통째로 깨졌다. 셀에 `overflow-hidden`, 레시피명·「외 N건」에 `truncate`를 붙여 고치고
  > `Calendar.test.tsx`에 회귀 테스트를 추가했다.
- [ ] 6주에 걸친 달로 넘길 때 레이아웃이 튀지 않는가
- [ ] 상단 바 로고의 심볼과 HTML 워드마크가 세로 정렬이 맞는가
- [ ] 다크 모드에서 `signal-record` 점이 배경과 충분히 대비되는가

## 열어둔 결정

- **하루에 기록이 100건을 넘는 경우.** 날짜별 목록은 `size=100`으로 한 번만 부른다. 2인 서비스에서
  실현되지 않으므로 페이지네이션을 두지 않는다. 사람이 늘어 실제로 닿으면 그때 연다.
- **나머지 에셋 8개(파비콘·앱 아이콘·락업)의 반영.** 홈과 무관하므로 별도 스펙으로 연다.
  앱 아이콘은 실기기 설치 확인이 필요하다.
- **상단 바를 홈 밖 화면에도 적용할지.** 이번에는 홈만이다. `/recipes`·`/brews`·`/more`의 웹
  레이아웃은 목업(`Kaldi Note Screens - Web.dc.html`)에 있으나 별도 스펙이다.
- **`recipeId` 없이 `/brews/new`를 여는 진입점.** 이번 세 CTA(모바일 하단·웹 상단 바·웹 우측
  하단)는 전부 `/recipes`로 보내 레시피를 먼저 고르게 한다. 캘린더 홈에서 곧바로 기록을
  시작하려면 `/brews/new` 자체가 레시피 선택 UI를 품거나, 날짜를 세션에 잠깐 들고 있다가
  레시피를 고른 뒤 합류하는 방식이 필요하다 — 둘 다 이번 스펙의 범위를 넘는 결정이라 별도
  인터뷰로 연다.
