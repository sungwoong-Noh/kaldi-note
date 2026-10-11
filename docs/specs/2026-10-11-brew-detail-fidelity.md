---
id: BDETAIL
title: 기록 상세 목업 정합 — 웹 W3 2컬럼 · 모바일 B2 · 대표 수치 수율
status: 승인
milestone: M2
supersedes:
---

# 기록 상세 목업 정합 스펙

> 작성 규칙은 [`docs/specs/README.md`](README.md) 참조.
> **모든 인수 조건은 자동화된 테스트로 옮길 수 있어야 한다.**

## 시나리오

사용자가 `/brews/[id]`에서 한 잔의 기록을 다시 본다 — 얼마나 잘 추출됐는지(수율·TDS·SCA), 레시피와 무엇이
달랐는지(차이를 문장으로), 어떤 원두·장비로 내렸는지, 맛을 어떻게 평가했는지. 다 본 뒤 「다시 내리기」로 같은
레시피의 새 기록을 연다.

- **웹(≥1100px)**: 왼쪽 본문 = 제목 영역 + 4열 비교표(항목·레시피·실제·차이) + 푸어 스텝. 오른쪽 칼럼
  (1100–1279: 360px, ≥1280: 420px, 전체 높이 `surface` 판 + 왼쪽 구분선) = 히어로(대표 수치) + 원두·장비 +
  평가 + 메모. 동작(`다시 내리기`·`수정`·`삭제`)은 상단 바 오른쪽 자리.
- **모바일(<1100px)**: 위 `뒤로`·`수정`, 제목 영역 → 히어로 → 비교표(문장은 행 아래) → 푸어 스텝 → 원두·장비
  원장 행 → 평가 → 메모 → 하단 전폭 `다시 내리기` + `삭제`.

목표 모습: `docs/design/kaldi-note-design/screens/08 Other Screens - Web.dc.html`(W3),
`08 Other Screens - Mobile.dc.html`(B2). 시각은 목업이 정본이다(ADR 0010). **백엔드 변경 없음** — 값은 전부
기존 응답(기록·레시피·브루어 마스터·내 그라인더)에서 온다.

### 범위 밖 (Non-goals)

- `친구에게 공유` 버튼 — 친구 피드(#148, M4)에서 다룬다
- 웹 다크 모드 시안
- 「그때의 레시피」 스냅샷과 비교 — 지금처럼 **현재 레시피**와 비교한다(AC-STRUCT-12 유지)
- 카드(홈·내 잔)의 대표 수치 — `headline()`은 그대로 두고 상세만 새 규칙을 쓴다
- 남의 기록의 그라인더 이름 — 내 그라인더 목록만 읽을 수 있다

## 용어

| 용어 | 정의 |
|---|---|
| 대표 수치 | 히어로의 큰 값. 수율(`extractionYieldPercent`) → 없으면 비율(`brewRatio`) → 없으면 물 온도 |
| SCA 칸 | `strengthZone`·`extractionZone`을 한 칸으로. 둘 다 `IDEAL`이면 `적정`, 아니면 `IDEAL`이 아닌 것만 `농도 옅음 · 추출 과다`처럼(한글은 `statusLabel`) |
| 분쇄도 비교 | **내 기록**이고 내 그라인더(`userGrinderId`)의 모델 = 레시피 `grinderModelId`일 때만 비교표에 행이 생긴다. 단위는 레시피 `grindSettingUnit`(`CLICK`→`클릭`, `NUMBER`→없음, `MICRON`→`μm`) |
| 분쇄 방향 | 설정값이 크면 **굵다**(모든 단위 공통, 2026-10-11 사람 결정) |
| 읽기 전용 점 | 평가 5축을 버튼이 아닌 그림(`role="img"`, 접근 이름 `산미 4`)으로 그린 것 |

---

## 인수 조건

> 픽스처: 기록 `brewLogWithTds`(id 2 · 내 것 userId 11 · `2026-08-31T09:00:00Z` · 20 g / 300 g / 92 °C / 3:30 ·
> 그라인더 2 · 22 · 음료 260 g · TDS 1.35 · 수율 17.6 · 농도 `IDEAL` · 추출 `UNDER` · ★4 · 5축 4/3/3/2/4 ·
> 메모 `산미가 좋다` · 원두 재고 3 · 3일차), 레시피 `kasuyaRecipe`(id 12 · 20 g / 300 g / 92 °C / 3:30 · 브루어 2
> `Hario V60 02`), 원두 `yirgacheffeBatch`(로스팅 `2026-08-28`) → `프릿츠 예가체프`, 내 그라인더 `myComandante`
> (id 2 · 별명 `집`).
>
> 검증 파일: 페이지 `src/app/brews/[id]/page.test.tsx`, 문장 `src/features/brewlog/diffPhrase.test.ts`,
> E2E `e2e/brew-detail-fidelity.spec.ts`.

### 기능

#### AC-BDETAIL-01 · 웹은 2컬럼, 모바일은 1컬럼이다

- **Given** `/brews/2`
- **When** 뷰포트 폭을 `1280` / `1100` / `1099`px로 둔다
- **Then** `1280`: 오른쪽 칼럼(`[data-detail-aside]`) 너비 `420`px / `1100`: `360`px. 두 경우 모두 그 left가 본문(`[data-detail-main]`) right보다 크다 / `1099`: `[data-detail-aside]`가 **0개**
- **검증** e2e

#### AC-BDETAIL-02 · 대표 수치는 수율 → 비율 → 물 온도 순이다

- **Given** 기록 (a) `brewLogWithTds` / (b) `brewLogWithoutTds`(수율 없음, 비율 15.0) / (c) (b)에서 `brewRatio` 키를 뺀 것
- **When** 상세를 연다
- **Then** 히어로 eyebrow·값이 (a) `Extraction yield` · `17.6 %` / (b) `Ratio` · `1:15.0` / (c) `물 온도` · `92 °C`. 어느 경우든 `[data-lead]`가 정확히 **1개**
- **검증** 페이지 테스트

#### AC-BDETAIL-03 · 히어로 아래 줄은 TDS·음료·SCA다

- **Given** 기록 `brewLogWithTds` / 같은 기록에 `extractionZone: "IDEAL"`
- **When** 상세를 연다
- **Then** 히어로 칸 `TDS` = `1.35 %`, `음료` = `260 g`, `SCA` = `추출 부족` / `SCA` = `적정`
- **검증** 페이지 테스트

#### AC-BDETAIL-04 · 제목 영역은 날짜·레시피·원두 줄이다

- **Given** 기록 `brewLogWithTds`, 브루어 목록에 id 2 `Hario V60 02`
- **When** 상세를 연다
- **Then** eyebrow `08.31 월 · 18:00`(KST). `h1`이 정확히 1개이고 그 안의 링크 이름 `Tetsu Kasuya 4:6 Method`, href `/recipes/12`. 그 아래 줄 `프릿츠 예가체프 · 로스팅 08.28 · Hario V60 02`
- **검증** 페이지 테스트

#### AC-BDETAIL-05 · 웹 비교표는 4열이고 같으면 「같습니다.」다

- **Given** 뷰포트 `1280`px, 기록 `brewLogWithTds`에 `actualDoseG: 21.0`, 레시피 `kasuyaRecipe`에 `grinderModelId: 1`, `grindSettingValue: 22`, `grindSettingUnit: "CLICK"`
- **When** 비교표를 읽는다
- **Then** 열 머리 `항목`·`레시피`·`실제`·`차이`. 행 라벨 순서 `원두량`·`물량`·`물 온도`·`분쇄도`·`추출 시간`. `원두량` 행: `20 g` · `21 g` · `원두를 1.0 g 더 썼습니다.`, `물량` 행 차이 칸 `같습니다.`
- **검증** 페이지 테스트

#### AC-BDETAIL-06 · 분쇄도 차이는 클릭 수와 굵기로 말한다

- **Given** 단위 `CLICK`, 레시피 `22`
- **When** 실제가 `24` / `20` / `22`
- **Then** `2 클릭 굵게 갈았습니다.` / `2 클릭 가늘게 갈았습니다.` / `null`. 단위 `MICRON` 600 → 660이면 `60 μm 굵게 갈았습니다.`, 단위 `NUMBER` 3 → 2.5면 `0.5 가늘게 갈았습니다.`
- **검증** 단위 테스트 `diffPhrase.test.ts`

#### AC-BDETAIL-07 · 모바일 비교표는 문장을 행 아래에 붙이고 같으면 비운다

- **Given** 뷰포트 `390`px, AC-BDETAIL-05와 같은 기록
- **When** 비교표를 읽는다
- **Then** 열 머리에 `차이`가 **없다**. `원두량` 행 아래 `원두를 1.0 g 더 썼습니다.`. `같습니다.` 글자가 화면에 **0개**
- **검증** 페이지 테스트

#### AC-BDETAIL-08 · 원두·장비는 원장 행이다

- **Given** 기록 `brewLogWithTds`(내 것), 내 그라인더 `myComandante`(id 2)
- **When** 상세를 연다
- **Then** 원장 행 `원두`: 값 `프릿츠 예가체프`, 보조줄 `로스팅 08.28 · 3일차`. 원장 행 `분쇄도`: `집 · 22 클릭`(레시피 단위가 `CLICK`일 때) — 레시피에 단위가 없으면 `집 · 22`
- **검증** 페이지 테스트

#### AC-BDETAIL-09 · 평가 — 웹은 읽기 전용 점, 모바일은 한 줄이다

- **Given** 기록 `brewLogWithTds`
- **When** 뷰포트 `1280` / `390`
- **Then** 둘 다 `★ 4`. `1280`: 이름이 `산미 4`·`단맛 3`·`바디 3`·`쓴맛 2`·`여운 4`인 `img` 5개, 평가 영역 안 버튼 **0개** / `390`: 텍스트 `산미 4 · 단맛 3 · 바디 3 · 쓴맛 2 · 여운 4`
- **검증** 페이지 테스트

#### AC-BDETAIL-10 · 메모는 인용으로 보인다

- **Given** 기록 `brewLogWithTds`
- **When** 상세를 연다
- **Then** `[data-detail-note]`의 텍스트가 `“산미가 좋다”`
- **검증** 페이지 테스트

#### AC-BDETAIL-11 · 웹 동작은 상단 바에 있다

- **Given** 뷰포트 `1280`px, 내 기록 `/brews/2`
- **When** 연다
- **Then** `banner` 안에 링크 `다시 내리기`(href `/brews/new?recipeId=12`)·링크 `수정`(href `/brews/2/edit`)·버튼 `삭제`. `main` 안에는 이 셋이 **0개**
- **검증** e2e

#### AC-BDETAIL-12 · 모바일 동작은 위 수정, 아래 다시 내리기·삭제다

- **Given** 뷰포트 `390×844`, 내 기록 `/brews/2`
- **When** 연다
- **Then** `banner` 안에 `수정`. 링크 `다시 내리기`의 너비가 `main` 너비와 같고(±1px) bottom이 뷰포트 bottom에서 `24`px 이내(`>= 0`). 버튼 `삭제`가 `다시 내리기` 아래에 있다
- **검증** e2e

### 엣지 (경계값)

#### AC-BDETAIL-13 · 남의 기록은 다시 내리기만 있고 분쇄도 비교가 없다

- **Given** 기록 `brewLogWithTds`에 `userId: 99`, 레시피에 `grinderModelId: 1`·`grindSettingValue: 22`·`grindSettingUnit: "CLICK"`
- **When** 상세를 연다
- **Then** `다시 내리기` 1개, `수정`·`삭제` **0개**. 비교표에 `분쇄도` 행이 **없다**. 원장 행 `분쇄도`는 `22 클릭`(그라인더 이름 없음)
- **검증** 페이지 테스트

#### AC-BDETAIL-14 · 모델이 다르면 분쇄도 비교가 없다

- **Given** 내 기록, 내 그라인더 모델 `1`, 레시피 `grinderModelId: 5`
- **When** 상세를 연다
- **Then** 비교표에 `분쇄도` 행이 **없다**
- **검증** 페이지 테스트

#### AC-BDETAIL-15 · 기준값이 없으면 대시다

- **Given** 뷰포트 `1280`px, 레시피에서 `waterTempC` 키를 뺐다
- **When** 비교표를 읽는다
- **Then** `물 온도` 행의 레시피 칸 `—`, 차이 칸 `—`
- **검증** 페이지 테스트

#### AC-BDETAIL-16 · TDS가 없으면 TDS·SCA 칸이 없다

- **Given** 기록 `brewLogWithoutTds`
- **When** 상세를 연다
- **Then** 히어로에 `TDS`·`SCA` 칸 **0개**. 텍스트 `TDS 측정값이 없어 추출 수율을 계산할 수 없습니다.`가 **없다**(AC-WEBBREW-42 유지)
- **검증** 페이지 테스트

#### AC-BDETAIL-17 · 없는 값의 블록은 그리지 않는다

- **Given** 기록에서 `rating`·`acidity`·`sweetness`·`body`·`bitterness`·`aftertaste`·`overallNote`·`beanBatchId` 키를 뺐다
- **When** 상세를 연다
- **Then** `★` 글자 **0개**, 이름이 `산미 `로 시작하는 `img` **0개**, `[data-detail-note]` **0개**, 원장 행 `원두` **0개**
- **검증** 페이지 테스트

### 실패

#### AC-BDETAIL-18 · 레시피를 못 읽으면 실측값을 원장 행으로 보인다

- **Given** `GET /recipes/12`가 (a) HTTP `403`, `code: "FORBIDDEN"` / (b) HTTP `404`, `code: "NOT_FOUND"`
- **When** 상세를 연다
- **Then** 비교표·푸어 스텝 **없음**. 원장 행 `원두량 20 g`·`물량 300 g`·`물 온도 92 °C`·`추출 시간 3:30`. `h1`은 (a) `비공개 레시피` / (b) `삭제된 레시피`이고 링크가 아니다(AC-WEBNAME-31 문구). `다시 내리기`는 그대로 있다
- **검증** 페이지 테스트

#### AC-BDETAIL-19 · 기록이 없으면 오류 화면이다

- **Given** `GET /brew-logs/2`가 HTTP `404`, `code: "NOT_FOUND"`
- **When** 상세를 연다
- **Then** 서버 `message`가 보이고 버튼 `다시 시도`가 있다. 누르면 `GET /brew-logs/2`가 한 번 더 나간다
- **검증** 페이지 테스트

### 비기능

#### AC-BDETAIL-20 · 가로 스크롤이 없다

- **Given** `/brews/2`
- **When** 폭 `390` / `1099` / `1100` / `1280`px
- **Then** `document.documentElement.scrollWidth <= innerWidth`
- **검증** e2e

#### AC-BDETAIL-21 · 누르는 영역 44×44

- **Given** 뷰포트 `390` / `1280`px
- **When** `다시 내리기`·`수정`·`삭제`·레시피 제목 링크의 누르는 영역을 잰다(`e2e/hitArea.ts`)
- **Then** 모두 너비·높이 `>= 44`px
- **검증** e2e

#### AC-BDETAIL-22 · 새 컴포넌트는 색 토큰만 쓴다

- **Given** 이 스펙이 만들거나 고친 `src/features/brewlog/components/*.tsx`
- **When** 소스를 검사한다
- **Then** `oklch(`·`#[0-9a-fA-F]{3,6}`·`rgb(` 리터럴 **0건**(`brewFormTokens.test.ts`의 대상에 포함)
- **검증** 단위 테스트

---

## 대체하는 이전 AC

스펙 전체가 아니라 일부 AC만 대체한다(frontmatter `supersedes`는 비운다). 구현하면서 해당 테스트를 새 AC로 옮기고
이전 스펙의 그 AC에 「(대체됨)」 표시를 단다.

- AC-CONSIST-09(docs/specs/2026-09-08-screen-consistency.md) → AC-BDETAIL-02 — 상세 대표 수치가 수율 우선
- AC-CONSIST-10 → AC-BDETAIL-02(c) — 물 온도 승격은 그대로, 위치만 새 히어로
- AC-CONSIST-11 → AC-BDETAIL-18 — 「실측값」 절이 없어지고, 레시피를 못 읽을 때만 원장 행
- AC-WEBBREW-40(docs/specs/2026-08-31-web-brew-log.md) → AC-BDETAIL-05·18
- AC-WEBLOGSTEP-02(docs/specs/2026-09-03-web-brew-log-steps.md) → AC-BDETAIL-01 배치 — 스텝은 비교표 뒤
- AC-SMALL-05(docs/specs/2026-09-17-small-features.md)의 **웹** 부분 → AC-BDETAIL-05 — 웹 차이 열은 `같습니다.`. 모바일은 AC-BDETAIL-07이 잇는다

- AC-HOMECAL-54(docs/specs/2026-09-19-home-calendar.md)의 **상세** 표기 `2026-09-19` → AC-BDETAIL-04의 `09.19 토 · 08:00` — KST 변환은 그대로(구현 중 발견, 2026-10-11 사람 확인)

- AC-WEBLOGEDIT-01·02(docs/specs/2026-09-02-web-brew-log-edit.md)의 링크 이름 `편집` → `수정`(AC-BDETAIL-11·13). 결정 표 #18에서 정한 것을 구현 중 대체 목록에 추가

- AC-STRUCT-18(docs/specs/2026-09-15-structure.md) → AC-BDETAIL-02 — 구현 중 발견(결정 표 #3의 결과)
- AC-GRAMMAR-02·09(docs/specs/2026-09-27-web-shell-grammar.md)의 `/brews/2` → AC-BDETAIL-01·02·05 — 구현 중 발견(결정 표 #2의 결과)

나머지 CONSIST·STRUCT·WEBNAME·WEBLOGSTEP·WEBLOGEDIT·SMALL AC는 그대로 유효하다.

---

## 구현 순서

각 태스크는 TDD 사이클 하나다(실패 테스트 → 실패 확인 → 최소 구현 → 통과 확인 → 커밋).

- [x] **Task 1: 분쇄도 차이 문장** — Covers: AC-BDETAIL-06

  `diffPhrase`에 `"grind"` 종류를 더한다(`2 클릭 굵게 갈았습니다.`). 단위 문자열은 호출하는 쪽이 넘긴다.

- [x] **Task 2: 상세 대표 수치 + 히어로** — Covers: AC-BDETAIL-02, 03, 16

  `headline.ts`에 `detailHeadline(log)`(수율 → 비율 → 물 온도)을 더한다. 카드의 `headline()`은 건드리지 않는다.
  히어로는 기록 폼 `BrewHero` 웹 모양(eyebrow · 큰 값 · 3열)을 따르되 상세 전용 컴포넌트로 둔다.

- [x] **Task 3: 제목 영역** — Covers: AC-BDETAIL-04

  날짜 eyebrow(KST `MM.DD 요일 · HH:mm`), `h1` 링크, 원두·로스팅일·드리퍼 줄(`useBrewSubParts` 재사용).

- [x] **Task 4: 웹 2컬럼 + 상단 바 동작** — Covers: AC-BDETAIL-01, 11, 20

  `useIsWide`로 웹/모바일 중 한쪽만 그린다. `WebTopBar`의 `#topbar-actions` 자리를 `/brews/[id]`에도 둔다(모든 폭).
  동작은 `createPortal` — 기록 폼 `WebActions`를 공용으로 옮겨 쓴다.

- [x] **Task 5: 비교표 웹 4열 + 모바일** — Covers: AC-BDETAIL-05, 07, 15

  `RecipeComparison`을 `wide`에 따라 4열 표 / 행 아래 문장으로. 같은 행은 웹에서만 `같습니다.`.

- [x] **Task 6: 분쇄도 비교 행** — Covers: AC-BDETAIL-13(분쇄도), 14

  내 기록이고 내 그라인더 모델 = 레시피 모델일 때만 비교표에 `분쇄도` 행. `useUserGrinders`는 내 기록일 때만 부른다.

- [ ] **Task 7: 원두·장비 원장 행 + 평가 + 메모** — Covers: AC-BDETAIL-08, 09, 10, 17

  키트 `LedgerField`·`SectionLabel` 재사용. 읽기 전용 점은 키트에 `TasteDots`의 읽기 전용 모양을 더하지 않고
  상세 안의 작은 컴포넌트로 둔다(버튼이 없어야 한다).

- [ ] **Task 8: 모바일 동작 + 남의 기록** — Covers: AC-BDETAIL-12, 13(동작)

  하단 전폭 `다시 내리기`(sticky, AC-BREWFORM-12와 같은 방식) + `삭제` 텍스트 버튼. 위 `수정`은 상단 바 자리.

- [ ] **Task 9: 실패 경로** — Covers: AC-BDETAIL-18, 19

  레시피를 못 읽으면 비교표 대신 실측값 원장 행 4개.

- [ ] **Task 10: 누르는 영역 + 토큰 + 대체 AC 정리** — Covers: AC-BDETAIL-21, 22

  「대체하는 이전 AC」의 테스트를 옮기고 이전 스펙에 「(대체됨)」 표시. `e2e/screens.ts`·`structure.spec.ts`의
  `/brews/2` 기대값 갱신.

---

## 수동 확인

- [ ] ★ `/brews/2`를 `390`·`1280`px에서 목업 W3·B2와 나란히 놓고 「큼」 격차 0건을 사람이 확인한다
  (`pnpm compare` 대상에 `/brews/2`를 더해도 된다)

## 열어둔 결정

- 없음
