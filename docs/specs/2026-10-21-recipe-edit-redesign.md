---
id: RECIPEEDIT
title: 레시피 작성·편집 리디자인 — 목업 03 정합
status: 승인
milestone: M2.5
supersedes:
---

# 레시피 작성·편집 리디자인 스펙

> 작성 규칙은 [`docs/specs/README.md`](README.md) 참조.
> **모든 인수 조건은 자동화된 테스트로 옮길 수 있어야 한다.**

## 시나리오

사용자가 `/recipes/new`에서 새 레시피를, `/recipes/{id}/edit`에서 내 레시피를 목업 03(Recipe Edit)과 같은
화면으로 쓴다. 비율 히어로가 원두·물 입력에 따라 바로 바뀌고, 웹은 오른쪽 미리보기에서 타임라인과 물 합계
Observation을 함께 본다. 스텝은 요약 행으로 보이고 모바일은 바텀시트, 웹은 편집 패널에서 고친다. 담아온
레시피는 같은 화면에 「원본」 배너가 붙고, 내 것이 아닌 레시피로 들어오면 폼 대신 「담아서 편집」을 안내한다(#174).

디자인 입력: `docs/design/kaldi-note-design/screens/03 Recipe Edit.dc.html`(W · M1 · M2 · M3 · S1~S8 · 반응형),
결정 `docs/design/kaldi-note-design/docs/DECISIONS.md` R1~R5. 이슈 #165 · #174.

구현은 **PR 2개**로 나눈다(스택 PR 아님 — ①이 main에 머지된 뒤 ② 브랜치를 판다).

- **PR ① 폼 본문** — 히어로 · 세그먼트 · 장비 · 미리보기 · 저장 위치 · 원본 배너 · 상태 · #174
- **PR ② 스텝 편집** — 스텝 표 · 편집 패널 · 바텀시트 · 붓는 방식 · 교반 · 메모

### 범위 밖 (Non-goals)

- 웹 스텝 드래그 정렬(R2의 「웹만 드래그」) — 위/아래 버튼으로 같은 일을 한다. 필요해지면 새 스펙
- 서버 스텝 검증 완화 — R1·R3은 「경고만, 저장 허용」이지만 **서버 규칙(AC-RECIPE-46·50)을 유지한다.**
  화면은 미리 경고하고, 그래도 저장하면 지금처럼 서버 문구가 뜬다(사용자 결정 2026-10-21)
- 레시피에 원두 연결, 포크 흐름 자체의 변경, 레시피 상세·서랍 화면(#166)
- 새 API · 새 에러 코드 · 새 색 토큰

## 용어

| 용어 | 정의 |
|---|---|
| 비율 | `waterG / doseG`를 소수 1자리 HALF_UP으로 `1:15.6`. 원두·물 중 하나라도 비었거나 범위 밖이면 `—` |
| 붓는 스텝 | `BLOOM`·`POUR`. 물 합계는 이것들만 센다(`stepSequence.isPouringStep`) |
| 물 합계 | 붓는 스텝 `waterG`의 합 |
| 원본 | `parentRecipeId`가 가리키는 레시피 |
| 구간 | 모바일 `<760` · 태블릿 `760–1099` · 좁은 웹 `1100–1279` · 웹 `≥1280` (px). 웹 경계 1100은 앱 셸(`useIsWide`·`WebTopBar`)과 같다 — 목업의 1024를 따르면 1024–1099에서 저장 버튼이 놓일 상단 바가 없다 |

## 계약

새 API 없음. 기존 경로를 그대로 쓴다.

| 메서드 | 경로 | 화면에서 |
|---|---|---|
| GET | `/api/v1/recipes/{id}` | 편집 초기값, 원본(`parentRecipeId`) 조회 |
| POST | `/api/v1/recipes` | 새 레시피 저장 |
| PUT | `/api/v1/recipes/{id}` | 편집 저장 (전체 교체) |
| POST | `/api/v1/recipes/{id}/fork` | #174 「담아서 편집」 |
| GET | `/api/v1/users/me` | 소유자 판정(`ownerUserId === me.id`) |

요청 본문에 **`temperatureType`·`recommendedRoastLevel`을 새로 싣는다.** 지금 폼은 이 둘을 보내지 않아 서버가
HOT·MEDIUM으로 채운다 — ICE·약배전 레시피를 편집 저장하면 값이 바뀌는 잠재 버그다(AC-RECIPEEDIT-03).

응답은 `non_null` — `grindMicronEstimated`·`parentRecipeId`·`sourceAuthorName`은 없으면 키가 빠진다.

## 화면

### 입력 범위 (서버 DTO와 같다)

| 필드 | 범위 | S3 문구 |
|---|---|---|
| 제목 | 필수, ≤100자 | 「제목을 입력해 주세요.」 |
| 원두 `doseG` | 1.0–200.0 g | 「1.0–200.0 g 사이로 입력해 주세요.」 |
| 물 `waterG` | 10.0–3000.0 g | 「3000 g 이하로 입력해 주세요.」(10.0 미만이면 「10.0 g 이상 입력해 주세요.」) |
| 물 온도 | 60.0–100.0 °C | 서버 필드 오류 |
| 총 시간 | 1–3600초, `m:ss` 입력 | 서버 필드 오류 |
| 설명 | ≤2000자 | 입력이 멈춘다 |
| 스텝 메모 | ≤500자 | 입력이 멈춘다 |
| 스텝 수 | ≤30 | 추가 버튼 비활성 |

클라이언트 검증은 **제목 · 원두 · 물** 셋만 한다. 나머지는 지금처럼 서버 필드 오류를 그 필드에 붙인다
(AC-WEBEDIT-30~33 유지).

### 라벨

| 항목 | 값 → 라벨 |
|---|---|
| 온도 | HOT · ICE |
| 추천 배전도 | LIGHT 약배전 · MEDIUM 중배전 · DARK 강배전 |
| 공개 범위 (웹) | PRIVATE 나만 보기 · FRIENDS 맞팔로우 친구 · PUBLIC 전체 |
| 공개 범위 (모바일) | 나만 · 맞팔로우 · 전체 |
| 분쇄도 단위 | CLICK 클릭 · NUMBER 눈금 · MICRON µm |
| 스텝 종류 | BLOOM 뜸 · POUR 붓기 · WAIT 대기 · SWIRL 돌리기 · STIR 젓기 · DRAWDOWN 배출 |
| 붓는 방식 | CENTER 중심 · SPIRAL 나선 · PULSE 펄스 · EDGE 가장자리 |
| 교반 | NONE 없음 · SWIRL 돌리기 · STIR 젓기 |

새 레시피 기본값: HOT · 중배전(MEDIUM) · 나만 보기(PRIVATE). 편집은 서버 값.

### 구간별 배치

| 구간 | 배치 |
|---|---|
| `≥1280` | 폼 2열(기본·수치·장비 / 스텝 표) + 오른쪽 **420px** 미리보기 |
| `1100–1279` | 폼 1열(스텝 표가 아래로) + 오른쪽 **360px** 미리보기, 스텝 표 「방식·메모」 열 숨김 |
| `760–1099` | 1컬럼. 폼 위 히어로 + 접힌 타임라인. 스텝은 카드 행 + 행 아래 인라인 편집 |
| `<760` | 모바일 M1. 스텝 편집은 바텀시트 M2, 타임라인 없음(히어로만) |

### 미리보기 (웹)

- 비율 · 원두 · 물 · 총 시간
- 타임라인 — 스텝마다 막대 1개(종류 라벨 + 누적 물량, 붓지 않는 스텝은 `—`). 축 `0:00 / 중간 / 끝`,
  끝 = max(총 시간, 마지막 스텝 종료). 아래 「오른쪽 숫자는 누적 물량(g)입니다.」
- Observation — 스텝이 1개 이상일 때만:
  - 같음: 「스텝 물 합계가 총 물량과 같습니다.」
  - 적음: 「스텝 물 합계가 총 물량보다 20 g 적습니다. 저장하려면 합계를 맞춰 주세요.」
  - 많음: 「스텝 물 합계가 총 물량보다 20 g 많습니다. 저장하려면 합계를 맞춰 주세요.」
  - 차이 숫자는 소수 1자리, `.0`이면 정수로(`20 g`, `2.5 g`)
- 스텝 헤더의 합계 `250 / 250 g`은 다르면 `--danger` 색(R4)

### 분쇄도 (R5)

- 입력 중 환산 API를 부르지 않는다(지금의 실시간 환산 제거)
- `grindMicronEstimated`가 없으면 「저장하면 추정 입도(µm)가 계산됩니다.」, 있으면 「약 660 µm · 추정치」
- 범위 밖 설정값은 저장 시 서버 `GRIND_SETTING_OUT_OF_RANGE`가 분쇄도 필드에 붙는다

### 저장 위치 · 제목

| | 새 레시피 | 편집 |
|---|---|---|
| 화면 제목 | 새 레시피 | 레시피 수정 |
| 모바일 | 헤더 「저장」 + 하단 고정 「레시피 저장」 | 헤더 「저장」 + 하단 고정 「변경 사항 저장」 |
| 웹 | 상단 바 「취소」 + 「레시피 저장」 | 상단 바 「취소」 + 「변경 사항 저장」 |

### 원본 배너 (M3)

`parentRecipeId`가 있는 편집 화면에만. 원본은 `GET /recipes/{parentRecipeId}`로 읽는다(응답에 원본 제목·원두량이 없다).

- 성공: 「원본」 라벨 + 「{sourceAuthorName} 님의 레시피 · {원본 제목}」, 히어로 아래 「원본 15.0 g」
- 실패(403·404·500): 「{sourceAuthorName} 님의 레시피」만, 「원본 … g」 줄 없음. `sourceAuthorName`도 없으면 배너 없음

### 상태

| | 화면 |
|---|---|
| S1 스텝 0개 | 「스텝이 없습니다.」 + 「스텝 없이도 저장할 수 있습니다. 타이머는 총 시간만 셉니다.」 |
| S2 스텝 30개 | 「+ 스텝 추가」 비활성 + 「스텝은 30개까지 추가할 수 있습니다.」 |
| S3 검증 에러 | 상단 「N개 항목을 확인해 주세요.」, 필드 아래 문구, 첫 에러 필드로 포커스, 요청 0건, 히어로 `—` |
| S4 저장 중 | 저장 버튼 「저장 중…」, 모든 입력·버튼 비활성 |
| S5 저장 실패(5xx·네트워크) | 「저장하지 못했습니다. 입력한 내용은 그대로 있습니다.」 + 「다시 시도」 |
| S6 나가기 | 고친 뒤 취소·뒤로 → 「저장하지 않고 나갈까요?」 / 「입력한 내용이 사라집니다.」 / 나가기 · 계속 편집 |
| S7 불러오기 | 로딩 표시 / 실패 「레시피를 불러오지 못했습니다.」 + 「다시 시도」. 404는 기존 「레시피를 찾을 수 없습니다」 |
| S8 경계 | 제목 카운터 `n / 100`. 설명 2000자에서 입력이 멈추고 카운터가 accent |
| 내 것 아님(#174) | 폼 없음. 「내 레시피만 편집할 수 있습니다.」 + 「담아서 편집」 + 「레시피로 돌아가기」 |

재사용: 기록 폼의 `HeroNumberChip` · `TimeField` · `LeaveConfirmDialog` · `focusFirstError`, `stepSequence.ts`의
밀기·당기기 규칙(AC-WEBEDIT-11~20 유지).

---

## 인수 조건

### 기능

#### AC-RECIPEEDIT-01 · 비율 히어로가 원두·물로 바로 계산된다

- **Given** `/recipes/new`
- **When** 원두 `16.0`, 물 `250.0`을 입력한다 / 원두를 비운다
- **Then** 히어로 `1:15.6` / `—`
- **검증** 컴포넌트 테스트 `RecipeForm.test.tsx`

#### AC-RECIPEEDIT-02 · 새 레시피 기본 선택은 HOT · 중배전 · 나만 보기

- **Given** `/recipes/new`
- **When** 아무것도 고르지 않고 제목 「아침 레시피」, 원두 `15`, 물 `250`으로 저장한다
- **Then** 세그먼트 선택이 HOT · 중배전 · 나만 보기이고, POST 본문이 정확히 `{ "title": "아침 레시피", "doseG": 15,
  "waterG": 250, "visibility": "PRIVATE", "temperatureType": "HOT", "recommendedRoastLevel": "MEDIUM", "steps": [] }`
- **검증** `src/app/recipes/new/page.test.tsx`

#### AC-RECIPEEDIT-03 · 편집 저장이 온도·배전도를 보존한다

- **Given** `temperatureType:"ICE"`, `recommendedRoastLevel:"LIGHT"`인 내 레시피
- **When** 편집 화면에서 제목만 바꿔 저장한다
- **Then** PUT 본문에 `temperatureType:"ICE"`, `recommendedRoastLevel:"LIGHT"`
- **검증** `RecipeEditor.test.tsx`

#### AC-RECIPEEDIT-04 · 분쇄도 단위 세그먼트가 요청에 실린다

- **Given** `/recipes/new`, 그라인더 선택, 설정값 `24`
- **When** 단위 「눈금」을 누르고 저장한다
- **Then** 본문 `grindSettingUnit:"NUMBER"`, `grindSettingValue:24`
- **검증** `RecipeForm.test.tsx`

#### AC-RECIPEEDIT-05 · 추정 입도는 저장된 값만 보여 주고 환산 API를 부르지 않는다

- **Given** (a) `grindMicronEstimated` 없는 레시피 (b) `grindMicronEstimated:660`인 레시피
- **When** 편집 화면을 열고 분쇄도 설정값을 바꾼다
- **Then** (a) 「저장하면 추정 입도(µm)가 계산됩니다.」 (b) 「약 660 µm · 추정치」. 두 경우 모두
  `/api/v1/grind/**` 요청 0건
- **검증** `RecipeEditor.test.tsx` (MSW 요청 카운트)

#### AC-RECIPEEDIT-06 · Observation이 물 합계 차이를 문장으로 말한다

- **Given** 총 물 `250.0`, 붓는 스텝 합계 (a) `230` (b) `270` (c) `250`
- **When** 미리보기를 본다
- **Then** (a) 「스텝 물 합계가 총 물량보다 20 g 적습니다. 저장하려면 합계를 맞춰 주세요.」
  (b) 「스텝 물 합계가 총 물량보다 20 g 많습니다. 저장하려면 합계를 맞춰 주세요.」
  (c) 「스텝 물 합계가 총 물량과 같습니다.」 — (a)(b)는 합계 `230 / 250 g`이 `text-danger`
- **검증** 단위 `preview.test.ts` + `RecipeForm.test.tsx`

#### AC-RECIPEEDIT-07 · 타임라인이 스텝마다 막대와 누적 물량을 그린다

- **Given** 총 시간 `3:30`, 스텝 뜸 0:00/0:45/45 · 붓기 0:45/0:30/105 · 붓기 1:30/0:30/100 · 배출 2:00/1:30
- **When** 미리보기를 본다
- **Then** 막대 4개, 누적 `45` · `150` · `250` · `—`, 축 `0:00` · `1:45` · `3:30`
- **검증** 단위 `preview.test.ts` + `RecipeForm.test.tsx`

#### AC-RECIPEEDIT-08 · 담아온 레시피 편집에 원본 배너가 붙는다

- **Given** `parentRecipeId:3`, `sourceAuthorName:"지연"`인 내 레시피, 원본 3은 제목 「아침에 마시는 밝은 워시드」·원두 `15.0`
- **When** 편집 화면을 연다
- **Then** 「원본」 + 「지연 님의 레시피 · 아침에 마시는 밝은 워시드」, 「원본 15.0 g」
- **검증** `RecipeEditor.test.tsx`

#### AC-RECIPEEDIT-09 · 원본을 읽지 못하면 작성자만 남는다

- **Given** AC-08과 같되 `GET /recipes/3`이 403
- **When** 편집 화면을 연다
- **Then** 「지연 님의 레시피」는 있고 「원본 15.0 g」은 없다. 폼은 정상
- **검증** `RecipeEditor.test.tsx`

#### AC-RECIPEEDIT-10 · 화면 제목과 저장 버튼 문구

- **Given** 새 레시피 / 편집
- **When** 화면을 연다
- **Then** 제목 「새 레시피」·저장 「레시피 저장」 / 제목 「레시피 수정」·저장 「변경 사항 저장」. `≥1100px`에서는 웹 상단 바가
  보이고 그 오른쪽에 「취소」·저장이 놓인다(목업 W)
- **검증** `page.test.tsx` · `navScreens.test.ts` · e2e `recipe-edit.spec.ts`

### 엣지

#### AC-RECIPEEDIT-20 · 스텝 0개(S1)

- **Given** 스텝이 없는 새 레시피
- **When** 화면을 보고 저장한다
- **Then** 「스텝이 없습니다.」와 「스텝 없이도 저장할 수 있습니다. 타이머는 총 시간만 셉니다.」, Observation 없음,
  본문 `steps:[]`
- **검증** `RecipeForm.test.tsx`

#### AC-RECIPEEDIT-21 · 제목 100자·설명 2000자(S8)

- **Given** `/recipes/new`
- **When** 제목에 100자, 설명에 2001자를 입력한다
- **Then** 제목 카운터 `100 / 100`, 설명 값 길이 2000, 설명 카운터에 `text-accent`
- **검증** `RecipeForm.test.tsx`

#### AC-RECIPEEDIT-22 · 고친 뒤 나가면 확인한다(S6)

- **Given** 편집 화면
- **When** (a) 제목을 고치고 「취소」 → 「계속 편집」 (b) 고치지 않고 「취소」
- **Then** (a) 「저장하지 않고 나갈까요?」가 뜨고 라우터 이동 0회 (b) 다이얼로그 없이 `/recipes/{id}`로 이동
- **검증** `RecipeEditor.test.tsx`

#### AC-RECIPEEDIT-23 · 내 것이 아닌 레시피로 들어오면 담아서 편집을 안내한다(#174)

- **Given** `me.id=1`, 레시피 12는 `sourceType:"CURATED"`(ownerUserId 없음) / 레시피 13은 `ownerUserId:2`
- **When** `/recipes/12/edit`를 열고 「담아서 편집」을 누른다
- **Then** 폼 입력칸 0개, 「내 레시피만 편집할 수 있습니다.」. 누르면 `POST /recipes/12/fork` 후
  `/recipes/{새 id}/edit`로 이동. 13도 같은 안내
- **검증** `RecipeEditor.test.tsx`

### 실패

#### AC-RECIPEEDIT-30 · 클라이언트 검증(S3)

- **Given** `/recipes/new`
- **When** 제목 빈칸, 원두 `0.0`, 물 `3200`으로 저장한다
- **Then** 요청 0건, 「3개 항목을 확인해 주세요.」, 각 필드 문구(「제목을 입력해 주세요.」「1.0–200.0 g 사이로 입력해
  주세요.」「3000 g 이하로 입력해 주세요.」), 포커스는 제목, 히어로 `—`
- **검증** `page.test.tsx`

#### AC-RECIPEEDIT-31 · 저장 실패(S5)

- **Given** `POST /recipes`가 500
- **When** 유효한 입력으로 저장한다
- **Then** 「저장하지 못했습니다. 입력한 내용은 그대로 있습니다.」, 입력값 유지. 「다시 시도」를 누르면 같은 본문으로
  POST 1회 더
- **검증** `page.test.tsx`

#### AC-RECIPEEDIT-32 · 불러오기 실패(S7)

- **Given** `GET /recipes/5`가 500
- **When** `/recipes/5/edit`를 연다
- **Then** 「레시피를 불러오지 못했습니다.」, 「다시 시도」를 누르면 GET 1회 더
- **검증** `RecipeEditor.test.tsx`

#### AC-RECIPEEDIT-33 · 저장 중 잠금(S4)

- **Given** 응답이 오지 않는 POST
- **When** 저장한다
- **Then** 저장 버튼 문구 「저장 중…」, 화면의 `input`·`select`·`textarea`·`button`이 전부 `disabled`
- **검증** `page.test.tsx`

### 비기능 (레이아웃 e2e)

#### AC-RECIPEEDIT-80 · 웹 미리보기 폭

- **Given** `/recipes/new`
- **When** 폭 1440 · 1280 / 1100에서 `[data-recipe-preview]`를 잰다
- **Then** 너비 420 / 360(±1px), 폼 영역의 오른쪽에 있다(`preview.left ≥ form.right`)
- **검증** e2e `recipe-edit.spec.ts`

#### AC-RECIPEEDIT-81 · 좁은 폭에는 미리보기 열이 없다

- **Given** `/recipes/new`
- **When** 폭 900 / 390
- **Then** `[data-recipe-preview]` 없음, 히어로가 첫 입력칸보다 위. 900은 접힌 타임라인 `[data-timeline-toggle]`이 있고
  390은 타임라인 없음
- **검증** e2e `recipe-edit.spec.ts`

#### AC-RECIPEEDIT-82 · 모바일 하단 고정 저장

- **Given** 390×844, `/recipes/new`
- **When** 페이지 끝까지 스크롤하기 전과 후
- **Then** 「레시피 저장」 버튼 아래끝과 뷰포트 아래끝의 간격이 `0 ≤ d ≤ 24`
- **검증** e2e `recipe-edit.spec.ts`

#### AC-RECIPEEDIT-83 · 누르는 영역 44×44

- **Given** `/recipes/new`, `/recipes/12/edit`(내 레시피 스텁)
- **When** 기존 touch-targets 스윕(390 · 1440)
- **Then** 새 세그먼트·칩·행 버튼 전부 ≥44×44
- **검증** e2e `touch-targets.spec.ts` (기존 스윕에 경로가 이미 있다 — 새 요소가 걸리는지만 확인)

### 스텝 편집 (PR ②)

#### AC-RECIPEEDIT-40 · 웹 스텝 표와 편집 패널

- **Given** 폭 1440, 스텝 4개
- **When** 표를 보고 2번 행을 누른다
- **Then** 헤더 순서 `# · 종류 · 시작 · 지속 · 물 · 방식·메모`, 「스텝 2 편집」 패널이 표 아래 열린다
- **검증** e2e `recipe-edit.spec.ts` + `RecipeStepEditor.test.tsx`

#### AC-RECIPEEDIT-41 · 1100–1279에서 방식·메모 열을 숨긴다

- **Given** 폭 1100
- **When** 스텝 표를 본다
- **Then** 「방식·메모」 열 헤더가 보이지 않는다
- **검증** e2e `recipe-edit.spec.ts`

#### AC-RECIPEEDIT-42 · 모바일 요약 행과 바텀시트

- **Given** 폭 390, 스텝 뜸 0:00/45초/45 g
- **When** 1번 행을 누른다
- **Then** 행 텍스트 `뜸` · `0:00 · 45초` · `45 g`, `role="dialog"` 「스텝 1」 시트가 열린다
- **검증** e2e `recipe-edit.spec.ts` + `RecipeStepEditor.test.tsx`

#### AC-RECIPEEDIT-43 · 시트는 적용해야 반영된다

- **Given** 스텝 2 물 `105`
- **When** 시트에서 `110`으로 바꾸고 (a) 「적용」 (b) 닫기
- **Then** (a) 행 `110 g` (b) 행 `105 g`
- **검증** `RecipeStepEditor.test.tsx`

#### AC-RECIPEEDIT-44 · 시트에서 삭제하면 뒤 스텝이 당겨진다

- **Given** 스텝 3개, 시작 0 · 45 · 90
- **When** 시트에서 2번 「삭제」
- **Then** 스텝 2개, 시작 0 · 45 (AC-WEBEDIT-15 규칙)
- **검증** `RecipeStepEditor.test.tsx`

#### AC-RECIPEEDIT-45 · 붓는 방식·교반이 요청에 실린다

- **Given** 붓기 스텝
- **When** 방식 「나선」, 교반 「돌리기」를 고르고 저장
- **Then** 본문 스텝에 `pourTechnique:"SPIRAL"`, `agitation:"SWIRL"`
- **검증** `RecipeStepEditor.test.tsx` + `page.test.tsx`

#### AC-RECIPEEDIT-46 · 스텝 메모 500자

- **Given** 스텝 편집
- **When** 메모에 501자를 입력한다
- **Then** 값 길이 500, 카운터 `500/500`
- **검증** `RecipeStepEditor.test.tsx`

#### AC-RECIPEEDIT-47 · 시작·지속은 m:ss로 입력한다

- **Given** 스텝 편집
- **When** 시작에 `1:30`, 지속에 `0:45`를 입력하고 저장
- **Then** 본문 `startAtSeconds:90`, `durationSeconds:45`
- **검증** `RecipeStepEditor.test.tsx`

#### AC-RECIPEEDIT-48 · 스텝 30개(S2)

- **Given** 스텝 30개
- **When** 화면을 본다
- **Then** 「+ 스텝 추가」 `disabled`, 「스텝은 30개까지 추가할 수 있습니다.」
- **검증** `RecipeStepEditor.test.tsx`

#### AC-RECIPEEDIT-49 · 붓지 않는 스텝의 물 칸

- **Given** 배출 스텝
- **When** 표·행을 보고 저장한다
- **Then** 물 칸 `—`, 물 입력 없음, 본문 그 스텝에 `waterG` 키 없음
- **검증** `RecipeStepEditor.test.tsx`

---

## 대체하는 이전 AC

스펙 전체가 아니라 일부 AC만 대체한다(frontmatter `supersedes`는 비운다). 구현하면서 해당 테스트를 새 AC로 옮기거나
지우고, 이전 스펙의 그 AC에 「(대체됨)」 표시를 단다.

- AC-WEBEDIT-07(`2026-08-30-web-recipe-write.md`) → AC-RECIPEEDIT-02 — 최소 본문에 `temperatureType`·`recommendedRoastLevel`이 늘
  실린다(빠뜨리면 서버가 편집 저장 때 HOT·MEDIUM으로 덮는다)
- AC-WEBEDIT-21 → AC-RECIPEEDIT-47 — 초 입력 + m:ss 보조 표기가 m:ss 입력으로
- AC-WEBEDIT-22 · 23 → AC-RECIPEEDIT-06 — 부족량 문구가 Observation으로
- AC-WEBEDIT-25 ~ 29 → AC-RECIPEEDIT-05 — 실시간 환산 제거(R5)
- AC-WEBHDR-10(`2026-09-20-web-header-rollout.md`)의 `/recipes/new`·`/recipes/{id}/edit` → AC-RECIPEEDIT-10 — 목업 W는 상단 바에
  저장을 둔다(기록 폼 AC-BREWFIT-03과 같은 방식)
- AC-STRUCT-05(`2026-09-15-structure.md`) → AC-RECIPEEDIT-40 · 42 — 스텝 행이 표·요약 행으로(PR ②)
- AC-STRUCT-09 → AC-RECIPEEDIT-07 · 80 — 편집 화면에 미리보기 타임라인이 생긴다

유지: AC-WEBEDIT-01 ~ 06 · 08 ~ 20 · 24 · 30 ~ 37, AC-STRUCT-06(단위는 숫자 셀 안에 그대로 있다), AC-RECIPE-46 · 50(서버 스텝 검증).

---

## 구현 순서

### PR ① 폼 본문 (`feat/recipe-edit-form`)

- [ ] **Task 1: 폼 상태에 온도·배전도** — Covers: AC-RECIPEEDIT-02, 03
  `RecipeFormState`에 `temperatureType`·`recommendedRoastLevel`, `fromRecipe`·`toRequestBody`·`emptyFormState`.
- [ ] **Task 2: 미리보기 순수 함수** — Covers: AC-RECIPEEDIT-01, 06, 07
  `features/recipe/preview.ts` — `ratioLabel`, `waterObservation`, `timelineBars`. 단위 테스트 먼저.
- [ ] **Task 3: 클라이언트 검증** — Covers: AC-RECIPEEDIT-30
  `validateRecipeForm(state)` → 필드별 문구, `focusFirstError` 재사용.
- [ ] **Task 4: 폼 레이아웃 재구성** — Covers: AC-RECIPEEDIT-01, 04, 05, 10, 20, 21
  히어로(칩) · 기본(제목·설명·공개 세그먼트) · 수치(원두·물·온도·총 시간 + HOT/ICE·배전도) · 장비 원장 행 · 분쇄도 세그먼트 +
  R5 문구. `GrindSettingField`의 실시간 환산 제거, WEBEDIT-25~29 테스트 정리.
- [ ] **Task 5: 미리보기 컬럼과 반응형** — Covers: AC-RECIPEEDIT-06, 07, 80, 81
- [ ] **Task 6: 저장 위치·상태(S4~S7)** — Covers: AC-RECIPEEDIT-10, 22, 31, 32, 33, 82
- [ ] **Task 7: 원본 배너** — Covers: AC-RECIPEEDIT-08, 09
- [ ] **Task 8: 내 것 아님(#174)** — Covers: AC-RECIPEEDIT-23
- [ ] **Task 9: e2e·터치 타깃·대체 표시** — Covers: AC-RECIPEEDIT-80 ~ 83, 이전 스펙 「(대체됨)」 표시

### PR ② 스텝 편집 (① 머지 후 새 브랜치)

- [ ] **Task 10: 웹 스텝 표 + 편집 패널** — Covers: AC-RECIPEEDIT-40, 41, 47, 49
- [ ] **Task 11: 모바일 요약 행 + 바텀시트** — Covers: AC-RECIPEEDIT-42, 43, 44
- [ ] **Task 12: 방식·교반·메모 입력** — Covers: AC-RECIPEEDIT-45, 46
- [ ] **Task 13: S2 + 760–1099 인라인 편집** — Covers: AC-RECIPEEDIT-48
- [ ] **Task 14: STRUCT-05 대체 정리 + e2e**

---

## 수동 확인

- [ ] ★ 실제 백엔드로 새 레시피 저장 → 상세에서 값 확인 (PR ①)
- [ ] ★ ICE·약배전 레시피를 편집 저장한 뒤 값이 유지된다 (PR ①)
- [ ] ★ 담은 레시피 편집에 원본 배너 (PR ①)
- [ ] ★ 390px에서 스텝 시트로 스텝 1개 추가·수정·삭제 후 저장 (PR ②)
- [ ] 목업 03 W · M1 · M2 · M3과 나란히 대조(1440 · 390, 라이트·다크) — 비차단, 격차는 갈래 B 이슈로

## 열어둔 결정

- 웹 스텝 드래그(R2) — 위/아래 버튼으로 불편하다는 말이 나오면 새 스펙
- 서버 스텝 검증 완화(R1·R3 원안) — 실제로 합계를 맞추기 번거롭다는 사용 경험이 쌓이면 재검토
