---
id: BREWFORM
title: 기록 작성·편집 화면 리디자인 — 03 폼 패턴 + 원두 다이얼로그 + 평가 5축
status: 구현중
milestone: M2
supersedes:
---

# 기록 작성·편집 화면 리디자인 스펙

> 작성 규칙은 [`docs/specs/README.md`](README.md) 참조.
> **모든 인수 조건은 자동화된 테스트로 옮길 수 있어야 한다.**

## 시나리오

사용자가 레시피 상세에서 「이 레시피로 내리기」를 눌러 `/brews/new?recipeId=N`에 들어와, 실제로 내린
값을 원장 행 형태의 폼에 적는다. 입력하는 동안 다크 히어로가 실측 비율(과 값이 다 있으면 수율)을
실시간으로 보여준다. 원두는 다이얼로그(모바일은 바텀시트)에서 재고를 골라 넣고, 없으면 같은 다이얼로그 안에서
등록한다. 공개 범위를 고르고 「기록하기」로 저장한다. `/brews/[id]/edit`도 같은 레이아웃을 쓴다.

전용 목업이 없다 — `docs/design/kaldi-note-design/screens/03 Recipe Edit.dc.html`의 폼 패턴(웹 좌측 폼 +
우측 미리보기, 모바일 다크 히어로 + 원장 행 + 하단 CTA, 상태 S1~S8)과
`08 Other Screens - Web.dc.html` W3의 평가 카드(★ + 5축)를 조합한다(`INDEX.md` 「아직 없는 것」).

**백엔드 변경 없음.** `POST /api/v1/brew-logs`가 `visibility`·`rating`·5축을 이미 받는다.

### 범위 밖 (Non-goals)

- 백엔드 API·스키마 변경
- 레시피 작성 화면(`/recipes/new`) 자체의 03 리디자인 — 이 스펙은 패턴만 빌린다
- 푸어 타이머 종료 → 기록 작성으로 실측값 넘기기 (M3)
- 반개(0.5) 별점 입력
- 오프라인 기록 큐
- 원두 재고 수정·삭제
- 저장 전 SCA 존 표시 (서버 판정값만 쓴다)

## 용어

| 용어 | 정의 |
|---|---|
| 히어로 | 폼 옆(넓은 폭) 또는 위(좁은 폭)의 다크 카드. 레시피명·실측 비율·레시피 기준값·수율 |
| 원장 행 | 라벨-값 한 줄. 오른쪽에 「변경」 같은 동작 |
| 미리보기 수치 | 히어로의 비율·수율. **저장 전 표시용으로만 클라이언트가 계산한다.** 저장 후 화면(상세·목록)은 서버 값을 쓴다 — `src/lib/format.ts`의 「프론트는 계산하지 않는다」 원칙의 예외는 이 두 값뿐이다 |

---

## 인수 조건

> 검증 파일: 작성 `src/app/brews/new/page.test.tsx`, 편집 `src/app/brews/[id]/edit/page.test.tsx`,
> 순수 함수 `src/features/brewlog/formState.test.ts`, E2E `e2e/brew-form.spec.ts`.

### 기능

#### AC-BREWFORM-01 · 폭에 따라 미리보기 위치와 너비가 바뀐다

- **Given** `/brews/new?recipeId=1`이 열려 있다
- **When** 뷰포트 폭을 `1280` / `1100` / `900` / `390`px로 둔다
- **Then** `1280`: 히어로가 폼 오른쪽, 너비 `420`px / `1100`: 폼 오른쪽, 너비 `360`px / `900`·`390`: 히어로의 top이 첫 입력칸의 top보다 작다(폼 위)
- **검증** e2e

#### AC-BREWFORM-02 · 히어로가 실측 비율을 실시간으로 보여준다

- **Given** 레시피 `doseG=15.0`, `waterG=250.0`으로 작성 화면이 열렸다
- **When** `원두량`을 `16`으로 바꾼다
- **Then** 히어로 비율이 `1:15.6`이다. `원두량`을 비우면 `1:—`, `0`이면 `1:—`
- **검증** 페이지 테스트

#### AC-BREWFORM-03 · 히어로 아래 줄은 레시피 기준값이다

- **Given** 레시피 `doseG=16.0`, `waterG=250.0`, `waterTempC=92.0`, `totalTimeSeconds=210`
- **When** 작성 화면을 연다
- **Then** 히어로에 레시피 제목과 `16.0g → 250.0g · 92°C · 3:30`이 보인다. `waterTempC`·`totalTimeSeconds`가 없으면 그 조각과 앞의 ` · `가 빠진다
- **검증** 페이지 테스트

#### AC-BREWFORM-04 · 값이 다 있으면 수율이 보인다

- **Given** `원두량 15`, `음료 중량 225`, `TDS 1.38`
- **When** 입력을 마친다
- **Then** 히어로에 `수율 20.7 %`가 보인다. `TDS`를 비우면 수율 대신 `TDS가 없으면 수율을 계산할 수 없습니다.`가 보인다
- **검증** 페이지 테스트

#### AC-BREWFORM-05 · 시간은 m:ss로 넣고 초로 보낸다

- **Given** 작성 화면, 필수값 채움
- **When** `추출 시간`에 `3:30`, `드로다운 시간`에 `0:45`를 넣고 `기록하기`
- **Then** 요청 본문 `actualTotalTimeSeconds`가 `210`, `actualDrawdownSeconds`가 `45`
- **검증** 페이지 테스트

#### AC-BREWFORM-06 · 편집 화면은 저장된 초를 m:ss로 채운다

- **Given** `GET /brew-logs/42`가 `actualTotalTimeSeconds=210`, `actualDrawdownSeconds=null`
- **When** `/brews/42/edit`를 연다
- **Then** `추출 시간`이 `3:30`, `드로다운 시간`이 빈칸
- **검증** 편집 페이지 테스트

#### AC-BREWFORM-07 · 원두 다이얼로그는 재고를 로스팅일 최신순으로 보여준다

- **Given** 재고 `{id:9, beanProductId:4, roastedAt:"2026-09-05", daysOffRoast:7, remainingG:180}`, `{id:8, beanProductId:4, roastedAt:"2026-09-10", daysOffRoast:2, remainingG:200}`, 제품 `{id:4, roasterId:3, name:"예가체프"}`, 로스터 `{id:3, name:"프릿츠"}`
- **When** 원두 행의 `변경`을 누른다
- **Then** `dialog` 안 첫 행이 `프릿츠 예가체프`·`로스팅 09.10 · 2일차 · 남은 200 g`, 둘째 행이 `로스팅 09.05 · 7일차 · 남은 180 g`. `roastedAt`이 같으면 `id`가 큰 것이 먼저
- **검증** 페이지 테스트

#### AC-BREWFORM-08 · 다이얼로그에서 고르면 닫히고 선택이 반영된다

- **Given** AC-07의 다이얼로그가 열려 있다
- **When** 둘째 행(`id:9`)을 누른다
- **Then** 다이얼로그가 닫히고 원장 행에 `프릿츠 예가체프 · 7일차`가 보이며, 저장 시 `beanBatchId`가 `9`
- **검증** 페이지 테스트

#### AC-BREWFORM-09 · 다이얼로그 안에서 새 원두를 등록하면 선택된 채 닫힌다

- **Given** 다이얼로그가 열려 있다
- **When** `+ 새 원두`를 눌러 로스터·제품·재고를 입력하고 등록하고, `POST /bean-batches`가 `{id: 11, ...}`을 반환한다
- **Then** 다이얼로그가 닫히고 저장 시 `beanBatchId`가 `11`. 그때까지 입력한 `원두량` 등 폼 값은 그대로다
- **검증** 페이지 테스트

#### AC-BREWFORM-10 · 공개 범위 3분할, 기본은 나만 보기

- **Given** 작성 화면을 연다
- **When** 아무것도 바꾸지 않고 저장 / `전체`를 누르고 저장
- **Then** `나만 보기`·`맞팔로우 친구`·`전체` 3개 `radio`가 있고 `나만 보기`가 선택돼 있다. 본문 `visibility`는 각각 `"PRIVATE"` / `"PUBLIC"`. 편집 화면도 같은 3분할에 저장된 값이 선택돼 있다
- **검증** 작성·편집 페이지 테스트

#### AC-BREWFORM-11 · 5축은 1~5 버튼으로 고르고 다시 누르면 해제된다

- **Given** `맛 자세히`를 눌러 펼쳤다
- **When** `산미`의 `4`를 누른다 / 한 번 더 누른다
- **Then** `산미 4` 버튼이 `aria-pressed="true"`이고 `산미`의 `1`~`4`에 채움 표시가 있으며 저장 시 `acidity: 4` / 두 번째 뒤에는 다섯 버튼 모두 `aria-pressed="false"`이고 본문에 `acidity` 키가 없다
- **검증** 페이지 테스트

#### AC-BREWFORM-12 · 모바일에서 기록하기가 하단에 고정된다

- **Given** 뷰포트 `390×844`, 작성 화면
- **When** 페이지 맨 위에서 스크롤하지 않는다
- **Then** `기록하기` 버튼의 bottom이 뷰포트 bottom에서 `24`px 이내이고 화면에 보인다
- **검증** e2e

### 엣지 (경계값)

#### AC-BREWFORM-13 · 시간 형식의 경계

- **Given** 작성 화면
- **When** `추출 시간`에 `0:00`·`59:59` / `3:5`·`60:00`·`abc`·`3:60` / 빈칸을 넣고 저장
- **Then** `0:00`→`0`, `59:59`→`3599`로 전송 / 나머지 넷은 요청이 **0회** 나가고 그 칸에 `0:00 형식으로 입력해 주세요.` / 빈칸이면 `actualTotalTimeSeconds` 키가 없다
- **검증** `formState.test.ts` + 페이지 테스트

#### AC-BREWFORM-14 · 비율 반올림은 HALF_UP

- **Given** `원두량 20`, `물량 313` (313÷20 = 15.65)
- **When** 입력한다
- **Then** 히어로 비율이 `1:15.7`
- **검증** `formState.test.ts`

#### AC-BREWFORM-15 · 원두 재고가 없을 때

- **Given** `GET /bean-batches`가 빈 페이지를 반환한다
- **When** 원두 행의 `변경`을 누른다
- **Then** 다이얼로그에 `등록된 원두가 없습니다.`와 `+ 새 원두` 버튼이 있다
- **검증** 페이지 테스트

#### AC-BREWFORM-16 · recipeId가 없거나 숫자가 아니면

- **Given** `/brews/new` / `/brews/new?recipeId=abc`
- **When** 연다
- **Then** API 요청이 **0회** 나가고 `레시피를 골라 내려 주세요.`와 `/recipes`로 가는 `레시피 보러 가기` 링크가 있다
- **검증** 페이지 테스트

#### AC-BREWFORM-17 · 바꾼 게 있을 때만 나가기를 확인한다

- **Given** 작성 화면(레시피 id 1)
- **When** (a) 아무것도 안 바꾸고 `취소` / (b) `원두량`을 바꾸고 `취소` → `계속 편집` / (c) (b) 뒤 `나가기`
- **Then** (a) 확인 없이 `/recipes/1`로 이동 / (b) `저장하지 않고 나갈까요?` 다이얼로그가 닫히고 `원두량` 값이 유지된다 / (c) `/recipes/1`로 이동. 편집 화면은 이동 대상이 `/brews/42`
- **검증** 작성·편집 페이지 테스트

#### AC-BREWFORM-18 · 5축은 접힌 채로 시작하고 펼치기 전엔 키가 없다

- **Given** 작성 화면
- **When** `맛 자세히`를 누르지 않고 저장
- **Then** 5축 버튼이 보이지 않고, 본문에 `acidity`·`sweetness`·`body`·`bitterness`·`aftertaste` 키가 없다
- **검증** 페이지 테스트

### 실패

#### AC-BREWFORM-19 · 저장 중에는 버튼이 잠긴다

- **Given** `POST /brew-logs` 응답이 아직 오지 않았다
- **When** `기록하기`를 누른 직후
- **Then** 버튼 이름이 `저장 중…`이고 `disabled`
- **검증** 페이지 테스트

#### AC-BREWFORM-20 · 필드 오류는 그 칸에 붙고 포커스가 간다

- **Given** `POST /brew-logs`가 HTTP `400`, `code: "INVALID_REQUEST"`, `fieldErrors: [{field:"actualDoseG", message:"0보다 커야 합니다"}]`
- **When** 저장한다
- **Then** `원두량` 입력의 `aria-describedby` 대상에 `0보다 커야 합니다`가 있고 `document.activeElement`가 `원두량` 입력이다
- **검증** 페이지 테스트

#### AC-BREWFORM-21 · 측정·분쇄도 오류는 경고 블록에 서버 문구 그대로

- **Given** `POST /brew-logs`가 HTTP `400`, `code: "GRIND_SETTING_OUT_OF_RANGE"`, `message: "이 그라인더에서 쓸 수 없는 설정값입니다."` / `code: "INVALID_BREW_MEASUREMENT"`, `message: "추출 측정값이 올바르지 않습니다."`
- **When** 저장한다
- **Then** 각각 `장비` 묶음 / `결과` 묶음 위 경고 블록에 `message`가 그대로 보이고 입력값이 유지된다
- **검증** 페이지 테스트

#### AC-BREWFORM-22 · 403·404는 폼 상단 일반 에러

- **Given** `POST /brew-logs`가 HTTP `404`, `code: "NOT_FOUND"`, `message: "재고를 찾을 수 없습니다: 9"` / HTTP `403`, `code: "FORBIDDEN"`, `message: "본인의 그라인더만 브루잉 로그에 연결할 수 있습니다."`
- **When** 저장한다
- **Then** 폼 맨 위 `data-general-error` 요소에 `message`가 그대로 있고 입력값이 유지된다
- **검증** 페이지 테스트

#### AC-BREWFORM-23 · 레시피 조회 실패는 다시 시도할 수 있다

- **Given** `GET /recipes/1`이 HTTP `500`
- **When** 작성 화면을 열고 `다시 시도`를 누른다
- **Then** ErrorState가 보이고, `다시 시도` 뒤 `GET /recipes/1`이 한 번 더 나간다
- **검증** 페이지 테스트

### 비기능

#### AC-BREWFORM-24 · 가로 스크롤이 없다

- **Given** 작성·편집 화면
- **When** 폭 `390` / `1024` / `1280`px
- **Then** `document.documentElement.scrollWidth <= innerWidth`
- **검증** e2e

#### AC-BREWFORM-25 · 별점·5축·공개 범위 버튼은 44×44 이상

- **Given** 뷰포트 `390`px, `맛 자세히`를 펼쳤다
- **When** 별 5개·5축 버튼 25개·공개 범위 3개의 bounding box를 잰다
- **Then** 모두 너비·높이 `>= 44`px
- **검증** e2e

#### AC-BREWFORM-26 · 색은 토큰만 쓴다

- **Given** 이 스펙이 만들거나 고친 `src/features/brewlog/components/*.tsx`
- **When** 소스를 검사한다
- **Then** `oklch(`·`#[0-9a-fA-F]{3,6}`·`rgb(` 리터럴이 **0건**
- **검증** 단위 테스트 `brewFormTokens.test.ts`

---

## 대체하는 이전 AC

이전 스펙의 일부 AC만 대체한다(스펙 전체 대체가 아니라 frontmatter `supersedes`는 비워둔다). 구현하면서
해당 테스트를 새 AC로 옮기고, 이전 스펙의 그 AC에 「(대체됨)」 표시를 단다.

- AC-WEBBREW-09(docs/specs/2026-08-31-web-brew-log.md) → AC-BREWFORM-09 — 선택란 값 대신 다이얼로그 선택
- AC-WEBBREW-10(docs/specs/2026-08-31-web-brew-log.md) → AC-BREWFORM-07·08 — `<select>` 선택지 라벨
- AC-WEBBREW-18의 「`visibility` 키가 없다」 부분(docs/specs/2026-08-31-web-brew-log.md) → AC-BREWFORM-10
- AC-WEBBREW-23(docs/specs/2026-08-31-web-brew-log.md) → AC-BREWFORM-15
- AC-WEBBREW-30(docs/specs/2026-08-31-web-brew-log.md) → AC-BREWFORM-11 — select → 버튼
- AC-WEBLOGEDIT-04의 `추출 시간 210` 부분(docs/specs/2026-09-02-web-brew-log-edit.md) → AC-BREWFORM-06
- AC-WEBLOGEDIT-05(docs/specs/2026-09-02-web-brew-log-edit.md) → AC-BREWFORM-10 — select·라벨 `맞팔로우만`/`전체 공개` → 3분할
- AC-WEBLOGEDIT-10의 「바꾼 뒤 취소」 경우(docs/specs/2026-09-02-web-brew-log-edit.md) → AC-BREWFORM-17
- AC-TOUCH-09(docs/specs/2026-09-09-touch-targets.md) → AC-BREWFORM-25 — 편집 화면 공개 범위 select 높이. select가 3분할 버튼이 되며 대상이 사라졌다(구현 중 발견해 추가)

나머지 WEBBREW·WEBLOGEDIT·ERRFOCUS AC(그라인더 자동 선택, 5축 접힘, 바뀐 필드만 PATCH, 지우기 방지 등)는
그대로 유효하다 — 레이아웃이 바뀌어도 테스트가 계속 통과해야 한다.

---

## 구현 순서

- [x] **Task 1: 순수 함수 — m:ss 파싱·표시, 미리보기 비율·수율(HALF_UP)** — Covers: AC-BREWFORM-13, AC-BREWFORM-14

  ```ts
  // formState.ts
  export function parseMinSec(text: string): number | null | "invalid" // "" → null
  export function previewRatio(doseG: number | null, waterG: number | null): string // "1:15.6" | "1:—"
  export function previewYield(doseG, beverageG, tds): string | null // "20.7" | null
  ```

- [x] **Task 2: 시간 입력을 m:ss로 교체 (작성·편집 공통 `BrewLogFields`)** — Covers: AC-BREWFORM-05, AC-BREWFORM-06, AC-BREWFORM-13

- [x] **Task 3: 레이아웃 — 원장 행 섹션 + 히어로 + 반응형 (작성·편집)** — Covers: AC-BREWFORM-01, AC-BREWFORM-02, AC-BREWFORM-03, AC-BREWFORM-04, AC-BREWFORM-12
  - 섹션 순서: 내린 시각 → 원두 → 수치 → 장비 → 결과 → 평가. 숫자 입력 단위는 입력칸 안 오른쪽 mono 11px `ink-3`

- [x] **Task 4: 원두 다이얼로그 (선택 + 안에서 등록, 모바일 바텀시트)** — Covers: AC-BREWFORM-07, AC-BREWFORM-08, AC-BREWFORM-09, AC-BREWFORM-15
  - 등록 단계는 기존 `BeanBatchDialog`의 입력·중복 방지 로직을 재사용한다

- [x] **Task 5: 공개 범위 3분할 (작성 추가, 편집 교체)** — Covers: AC-BREWFORM-10

- [x] **Task 6: 평가 — 5축 1~5 버튼** — Covers: AC-BREWFORM-11, AC-BREWFORM-18

- [x] **Task 7: 상태 — recipeId 오류·나가기 확인·저장 중·에러 표시** — Covers: AC-BREWFORM-16, AC-BREWFORM-17, AC-BREWFORM-19, AC-BREWFORM-20, AC-BREWFORM-21, AC-BREWFORM-22, AC-BREWFORM-23

- [x] **Task 8: 비기능 — E2E 폭·터치 타깃, 토큰 검사** — Covers: AC-BREWFORM-24, AC-BREWFORM-25, AC-BREWFORM-26
  - `e2e/brew-form.spec.ts`는 `e2e/recipe-drawer-responsive.spec.ts`의 API 목킹 방식을 따른다

- [x] **Task 9: 이전 AC 대체 표시** — 위 「대체하는 이전 AC」의 각 AC에 이전 스펙 본문 「(대체됨)」 표시 + 옮겨진 테스트 ID 정리. (WEBBREW-09·10·23은 Task 4에서, WEBLOGEDIT-05·TOUCH-09는 Task 5에서, WEBBREW-30은 Task 6에서 테스트를 옮기며 함께 처리했다 — 구현완료 스펙이라 표시가 없으면 커버리지 검사가 바로 실패한다.) `./scripts/check-spec-coverage.sh`·`./scripts/check-docs.sh` 통과

---

## 수동 확인

- [ ] ★ mockup-checker로 `/brews/new`·`/brews/[id]/edit`를 `390px`/`1280px`에서 캡처해 `03 Recipe Edit`(웹 W, 모바일 M1·S4·S6)·W3 평가 카드와 대조하고, 결과를 PR 본문에 첨부한다
- [ ] 실제 기기(모바일 PWA)에서 원두 바텀시트와 하단 고정 CTA가 키보드와 겹치지 않는지 본다

## 열어둔 결정

- 원두 바텀시트의 높이(고정 vs 내용에 맞춤)는 Task 4에서 재고 5건 이상일 때 스크롤이 자연스러운 쪽으로 정하고 PR 「구현 중 결정」에 적는다
