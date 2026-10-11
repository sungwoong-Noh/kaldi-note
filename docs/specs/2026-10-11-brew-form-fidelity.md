---
id: BREWFIT
title: 공용 입력 부품 + 기록 작성·편집 시안 정합 — 섹션 라벨·숫자 셀·원장 필드·맛 도트
status: 초안
milestone: M2
supersedes:
---

# 공용 입력 부품 + 기록 작성·편집 시안 정합 스펙

> 작성 규칙은 [`docs/specs/README.md`](README.md) 참조.
> **모든 인수 조건은 자동화된 테스트로 옮길 수 있어야 한다.**

## 시나리오

사용자가 `/brews/new?recipeId=N`(또는 `/brews/[id]/edit`)에서 실제로 내린 값을 적는다. 화면은
`03 Recipe Edit`의 입력 문법을 따른다 — 섹션 제목은 mono 작은 라벨, 숫자는 칸 안에 라벨이 있는 2열 셀,
원두·그라인더·분쇄도는 원장 행 + 「변경」, 5축은 점(도트)이다.

- **웹(≥1100px)**: 상단 바 오른쪽에 `취소`·`기록하기`. 왼쪽은 2열 폼, 오른쪽 칼럼(1100–1279: 360px,
  ≥1280: 420px)은 히어로(실측 3열 + 레시피 값 흐리게 + 수율 줄)와 「레시피와 다른 점」 블록.
- **모바일(<1100px)**: 히어로 안에 원두량·물량 칩, 그 아래 원장 행 요약 8줄. 행을 누르면 그 묶음만 담은
  바텀시트가 뜬다. 상단 `저장` + 하단 풀폭 `기록하기`.

목표 모습(시안): https://claude.ai/artifact/FjkYdBWjmPVUkQDVrzesmJ (#161). 시각은 목업이 정본이다
(ADR 0010). **백엔드 변경 없음.**

### 범위 밖 (Non-goals)

- 백엔드 API·스키마 변경
- 새 부품을 다른 화면(레시피 작성 #165, 환산기, 더보기, 기록 상세 #141)에 적용 — 각자의 스펙에서 한다
- 분쇄도 차이 문장(「두 클릭 굵게 갈았습니다」) — `diffPhrase`에 분쇄도를 넣으면 기록 상세도 바뀐다
- 레시피 폼의 공개 범위 라벨(`맞팔로우만·전체 공개`) 통일 — #165
- 웹 다크 모드 시안
- 푸어 타이머 → 기록 연결 (M3)
- 모바일 「레시피와 다른 점」 블록

## 용어

| 용어 | 정의 |
|---|---|
| 섹션 라벨 | `SectionLabel`. mono 10.5px, `ink-3`, 자간 0.06em. 시안 `.label` |
| 숫자 셀 | `NumberCell`. 테두리 칸(최소 높이 52px) 안에 왼쪽 라벨(13.5px `ink-3`), 오른쪽 입력값(mono 16px, 500) + 단위(mono 11px `ink-3`). 시안 `.cell` |
| 원장 필드 | `LedgerField`. 그리드 `76px · 1fr · auto` — 라벨(mono 10.5px) · 값(15px, 아래 보조줄 mono 11.5px) · 동작(「변경」 13.5px). 위 hairline, 마지막만 아래 hairline. 최소 높이 48px. 시안 `.row` |
| 맛 도트 | `TasteDots`. 축 이름 · 지름 22px 점 5개(간격 6px) · 오른쪽 숫자(mono 12px). 점마다 누르는 영역 44×44 |
| 묶음 시트 | 모바일에서 원장 행을 눌렀을 때 뜨는 `BottomSheet`. 그 행에 속한 입력만 담는다 |
| 기준 표시 | 레시피 값을 실측 아래 흐리게 보여주는 줄(`레시피 15`, `레시피 22 클릭`) |

### 묶음 시트 구성 (모바일)

| 원장 행 | 값 표기(요약) | 시트 안 입력 |
|---|---|---|
| 레시피 | 레시피 제목 | — (누를 수 없다) |
| 내린 시각 | `MM.DD HH:mm` | 내린 시각 |
| 원두 | `로스터 · 제품` / 보조줄 `로스팅 MM.DD · N일차` | 기존 원두 바텀시트(BREWFORM-07~09) |
| 온도·시간 | `96 °C · 3:45` / 보조줄 `드로다운 0:40` | 물 온도 · 추출 시간 · 드로다운 시간 |
| 장비 | `그라인더 · 24 클릭` / 보조줄 기준 표시 | 그라인더 · 분쇄도 값 |
| 결과 | `450 g · TDS 1.38` / 보조줄 `수율 20.4 %` | 음료 중량 · TDS |
| 평가 | 별점(18px) + 동작 `맛 자세히` | 5축 맛 도트 |
| 메모 | 첫 줄(말줄임) | 메모 |

값이 없는 조각은 `—`로 쓴다. 별점은 행 안에서 바로 누른다(시트를 열지 않는다).

---

## 인수 조건

> 검증 파일: 작성 `src/app/brews/new/page.test.tsx`, 편집 `src/app/brews/[id]/edit/page.test.tsx`,
> 부품 `src/components/kit/kit.test.tsx`, E2E `e2e/brew-form-fidelity.spec.ts`.
> 입력의 **접근 이름은 지금 그대로**다(`원두량`·`물량`·`물 온도`·`추출 시간`·`드로다운 시간`·`음료 중량`·`TDS`·`분쇄도 값`).
> 보이는 라벨만 시안 문구(`원두`·`물`·`드로다운`)로 바꾼다 — 기존 WEBBREW·WEBLOGEDIT·ERRFOCUS 테스트가 그대로 돈다.

### 기능

#### AC-BREWFIT-01 · 공용 부품 4종이 키트에 있다

- **Given** `/dev/kit`
- **When** 연다
- **Then** `[data-kit="section-label"]`·`[data-kit="number-cell"]`·`[data-kit="ledger-field"]`·`[data-kit="taste-dots"]`가 각각 1개 이상 있다
- **검증** 단위 테스트 `kit.test.tsx`

#### AC-BREWFIT-02 · 숫자 셀은 라벨이 칸 안에 있고 단위가 값 뒤에 붙는다

- **Given** `<NumberCell label="원두" accessibleName="원두량" unit="g" value="30.5" />`
- **When** 그린다
- **Then** 이름이 `원두량`인 `textbox`(inputmode `decimal`)가 하나 있고 값이 `30.5`다. 그 칸 요소 안에 `원두`와 `g` 글자가 있다
- **검증** 단위 테스트 `kit.test.tsx`

#### AC-BREWFIT-03 · 웹은 상단 바에 취소·기록하기가 있고 하단 동작 줄이 없다

- **Given** 뷰포트 `1280×900`, `/brews/new?recipeId=1`
- **When** 연다
- **Then** `기록하기` 버튼이 `banner`(상단 바) 안에 있고 bottom이 `80`px 이하다. `banner` 안에 `취소`도 있다. 그 밖에 이름이 `기록하기`인 버튼은 **0개**다
- **검증** e2e

#### AC-BREWFIT-04 · 오른쪽 칼럼 폭과 전환 지점

- **Given** `/brews/new?recipeId=1`
- **When** 뷰포트 폭을 `1280` / `1100` / `1099`px로 둔다
- **Then** `1280`: 히어로 너비 `420`px / `1100`: `360`px, 히어로 left가 폼 right보다 크다 / `1099`: 원장 필드 `온도·시간`이 보이고 이름이 `물 온도`인 입력은 보이지 않는다(시트 안)
- **검증** e2e

#### AC-BREWFIT-05 · 웹 폼은 2열이다

- **Given** 뷰포트 `1280`px
- **When** 섹션 라벨 `기본`·`수치`·`원두와 장비`·`결과`·`평가`·`메모`의 위치를 잰다
- **Then** `기본`·`수치`·`원두와 장비`의 left가 같고, `결과`·`평가`·`메모`의 left가 같으며 앞쪽 left보다 크다. `기본`과 `결과`의 top 차이가 `4`px 미만이다
- **검증** e2e

#### AC-BREWFIT-06 · 웹 히어로는 실측 3열 아래에 레시피 값을 흐리게 보인다

- **Given** 레시피 `doseG=15.0`, `waterG=250.0`, `totalTimeSeconds=210`, 뷰포트 `1280`px
- **When** `원두량 16`, `물량 250`, `추출 시간 3:45`를 넣는다
- **Then** 히어로 비율 `1:15.6`. 열 `원두`: `16 g` / `레시피 15`, 열 `물`: `250 g` / `레시피 250`, 열 `시간`: `3:45` / `레시피 3:30`. 레시피에 `totalTimeSeconds`가 없으면 `시간` 열의 기준 표시가 없다
- **검증** 페이지 테스트

#### AC-BREWFIT-07 · 웹 히어로 둘째 줄은 수율·TDS·음료다

- **Given** 뷰포트 `1280`px
- **When** `원두량 15`, `음료 중량 225`, `TDS 1.38` / 이어서 `TDS`를 비운다
- **Then** `수율 20.7 %`·`TDS 1.38 %`·`음료 225 g` / `수율 —`·`TDS —`·`음료 225 g`. 문장 「TDS가 없으면 수율을 계산할 수 없습니다.」는 웹 히어로에 **없다**
- **검증** 페이지 테스트

#### AC-BREWFIT-08 · 웹은 레시피와 다른 점을 저장 전에 미리 보여준다

- **Given** 레시피 `doseG=30.0`, `waterTempC=93.0`, 뷰포트 `1280`px
- **When** `원두량 31`, `물 온도 96`을 넣는다 / 둘 다 레시피 값으로 되돌린다
- **Then** 「레시피와 다른 점」 블록에 `원두를 1.0 g 더 썼습니다`와 `3 °C 높게 내렸습니다`가 이 순서로 있다(문장은 `diffPhrase` — AC-SMALL-01~06과 같다) / 블록이 **없다**
- **검증** 페이지 테스트

#### AC-BREWFIT-09 · 분쇄도 기준 표시는 같은 모델·단위일 때만

- **Given** 레시피 `grinderModelId=5`, `grindSettingValue=22`, `grindSettingUnit="CLICK"`
- **When** 모델 `5`(CLICK)인 그라인더를 고른다 / 모델 `6`인 그라인더를 고른다
- **Then** 분쇄도 원장 필드 보조줄에 `레시피 22 클릭` / 그 글자가 **없다**
- **검증** 페이지 테스트

#### AC-BREWFIT-10 · 모바일 히어로 안에서 원두량·물량을 고친다

- **Given** 뷰포트 `390×844`, 레시피 `doseG=15.0`, `waterG=250.0`
- **When** 히어로 안의 `원두량`을 `16`으로 바꾼다
- **Then** `원두량`·`물량` 입력이 히어로 요소 안에 있고, 비율이 `1:15.6`이 된다. 히어로 아래 줄은 레시피 기준값 `15g → 250g`으로 시작한다(AC-BREWFORM-03 표기)
- **검증** 페이지 테스트 + e2e(히어로 포함 관계)

#### AC-BREWFIT-11 · 모바일 원장 행 순서와 「변경」

- **Given** 뷰포트 `390`px, 작성 화면
- **When** 원장 필드의 라벨을 위에서부터 읽는다
- **Then** `레시피`·`내린 시각`·`원두`·`온도·시간`·`장비`·`결과`·`평가`·`메모` 순이다. `레시피`를 뺀 7행에 `변경`(평가는 `맛 자세히`)이 있고 `레시피` 행은 버튼이 아니다
- **검증** 페이지 테스트

#### AC-BREWFIT-12 · 행을 누르면 그 묶음만 담은 시트가 뜬다

- **Given** 뷰포트 `390`px
- **When** `온도·시간` 행의 `변경`을 누르고 `물 온도 96`, `추출 시간 3:45`, `드로다운 시간 0:40`을 넣은 뒤 `완료`
- **Then** 이름이 `온도·시간`인 `dialog`에 입력이 정확히 그 3개다. 닫힌 뒤 행 값이 `96 °C · 3:45`, 보조줄이 `드로다운 0:40`
- **검증** 페이지 테스트

#### AC-BREWFIT-13 · 시트를 어떻게 닫아도 값이 남는다

- **Given** `결과` 시트를 열고 `음료 중량 225`를 넣었다
- **When** (a) `완료` / (b) `Escape` / (c) 딤 영역 클릭으로 닫는다
- **Then** 세 경우 모두 `dialog`가 사라지고 행 값이 `225 g · TDS —`이며, 저장 시 본문 `beverageWeightG`가 `225`
- **검증** 페이지 테스트

#### AC-BREWFIT-14 · 맛 도트는 고르고 같은 점을 다시 누르면 지운다

- **Given** 5축이 보인다(웹 또는 모바일 `맛 자세히` 시트)
- **When** `산미 4`를 누른다 / 한 번 더 누른다
- **Then** `산미 4` 버튼 `aria-pressed="true"`, `산미` 점 1~4에 `data-on`, 축 숫자 `4`, 저장 시 `acidity: 4` / 다섯 점 모두 `aria-pressed="false"`, 숫자 칸 비어 있음, 본문에 `acidity` 키가 없다
- **검증** 페이지 테스트

#### AC-BREWFIT-15 · 웹은 5축이 늘 펼쳐져 있고 모바일은 시트다

- **Given** 작성 화면
- **When** 뷰포트 `1280` / `390`에서 아무것도 누르지 않는다
- **Then** `1280`: 이름이 `산미 1`~`여운 5`인 버튼 25개가 보이고 `맛 자세히`가 없다 / `390`: 25개 모두 보이지 않고, `맛 자세히`를 누르면 이름이 `맛`인 `dialog` 안에 25개가 있다. 어느 쪽이든 고르지 않은 축은 본문에 키가 없다
- **검증** e2e

#### AC-BREWFIT-16 · 공개 범위 라벨은 폭과 상관없이 같다

- **Given** 작성·편집 화면
- **When** 뷰포트 `1280` / `390`
- **Then** 둘 다 `radio` 3개가 `나만 보기`·`맞팔로우 친구`·`전체`이고, 각 `radio`의 높이가 `40`px 미만이다(13.5px 글자가 두 줄로 꺾이면 넘는다)
- **검증** e2e

#### AC-BREWFIT-17 · 모바일은 상단 저장과 하단 기록하기가 같은 동작이다

- **Given** 뷰포트 `390×844`, 필수값 채움
- **When** 상단 `저장`을 누른다 / (새로 연 화면에서) 하단 `기록하기`를 누른다
- **Then** 각각 `POST /brew-logs`가 정확히 **1회**. 하단 `기록하기`의 bottom이 뷰포트 bottom에서 `24`px 이내(AC-BREWFORM-12 유지). 상단 줄에 `취소`·`새 기록`·`저장`이 있고 `뒤로` 링크는 **없다**
- **검증** e2e

#### AC-BREWFIT-18 · 편집 화면은 제목과 버튼 이름만 다르다

- **Given** `/brews/42/edit`
- **When** 뷰포트 `1280` / `390`
- **Then** 제목이 `기록 편집`. `1280`: 상단 바에 `취소`·`저장` / `390`: 상단 `저장`과 하단 `저장`. 이름이 `기록하기`인 버튼은 **0개**
- **검증** 편집 페이지 테스트 + e2e

### 엣지 (경계값)

#### AC-BREWFIT-19 · 빈 값은 대시다

- **Given** 뷰포트 `390`px, 온도·시간·결과를 아무것도 넣지 않았다
- **When** 원장을 읽는다
- **Then** `온도·시간` 행 값 `— · —`, 보조줄 `드로다운 —`, `결과` 행 값 `— · TDS —`, 보조줄 `수율 —`
- **검증** 페이지 테스트

#### AC-BREWFIT-20 · 원본 레시피가 없으면 기준 표시도 없다

- **Given** 편집 화면, `GET /recipes/{recipeId}`가 `404`
- **When** 뷰포트 `1280`으로 연다
- **Then** 히어로에 `레시피 `로 시작하는 기준 표시가 **0개**, 「레시피와 다른 점」 블록이 **없다**. 비율·수율은 그대로 보인다
- **검증** 편집 페이지 테스트

#### AC-BREWFIT-21 · 한 축만 골라도 그 축만 보낸다

- **Given** 뷰포트 `1280`
- **When** `여운 1`만 누르고 저장
- **Then** 본문에 `aftertaste: 1`이 있고 `acidity`·`sweetness`·`body`·`bitterness` 키가 없다
- **검증** 페이지 테스트

### 실패

#### AC-BREWFIT-22 · 모바일 필드 오류는 그 시트를 열고 포커스를 옮긴다

- **Given** 뷰포트 `390`px, `POST /brew-logs`가 HTTP `400`, `code: "INVALID_REQUEST"`, `fieldErrors: [{field:"actualWaterTempC", message:"100 이하여야 합니다"}]`
- **When** 저장한다
- **Then** `온도·시간` `dialog`가 열리고 `document.activeElement`가 `물 온도` 입력이며 그 `aria-describedby` 대상에 `100 이하여야 합니다`. 시트를 닫으면 `온도·시간` 행에 `data-invalid`가 있다
- **검증** 페이지 테스트

#### AC-BREWFIT-23 · 모바일 시간 형식 오류도 같은 길이다

- **Given** 뷰포트 `390`px, `추출 시간`에 `3:60`
- **When** 저장한다
- **Then** 요청이 **0회**, `온도·시간` `dialog`가 열리고 `추출 시간`에 포커스, 문구 `0:00 형식으로 입력해 주세요.`
- **검증** 페이지 테스트

#### AC-BREWFIT-24 · 모바일 묶음 경고는 해당 행 위에 붙는다

- **Given** 뷰포트 `390`px, `POST /brew-logs`가 HTTP `400`, `code: "GRIND_SETTING_OUT_OF_RANGE"`, `message: "이 그라인더에서 쓸 수 없는 설정값입니다."` / `code: "INVALID_BREW_MEASUREMENT"`, `message: "추출 측정값이 올바르지 않습니다."`
- **When** 저장한다
- **Then** 경고 블록이 각각 `장비` / `결과` 행 바로 위에 `message` 그대로 있고(경고 bottom ≤ 행 top) 입력값이 유지된다
- **검증** 페이지 테스트(순서) + e2e(위치)

### 비기능

#### AC-BREWFIT-25 · 누르는 영역 44×44

- **Given** 뷰포트 `390`px, `맛 자세히` 시트가 열려 있다 / 닫혀 있다
- **When** 맛 도트 25개, 별 5개, 공개 범위 3개, `변경` 7개, 히어로 입력 2개의 누르는 영역(박스와 `::before`/`::after` 중 큰 쪽)을 잰다
- **Then** 모두 너비·높이 `>= 44`px
- **검증** e2e(`e2e/touch-targets.spec.ts` 측정 함수 재사용)

#### AC-BREWFIT-26 · 가로 스크롤이 없다

- **Given** 작성·편집 화면
- **When** 폭 `390` / `1099` / `1100` / `1280`px
- **Then** `document.documentElement.scrollWidth <= innerWidth`
- **검증** e2e

#### AC-BREWFIT-27 · 새 부품은 색 토큰만 쓴다

- **Given** `SectionLabel`·`NumberCell`·`LedgerField`·`TasteDots` 소스
- **When** 검사한다
- **Then** `oklch(`·`#[0-9a-fA-F]{3,6}`·`rgb(` 리터럴이 **0건**
- **검증** 단위 테스트 `kit.test.tsx`

---

## 대체하는 이전 AC

스펙 전체가 아니라 일부 AC만 대체한다(frontmatter `supersedes`는 비운다). 구현하면서 해당 테스트를 새 AC로 옮기고
이전 스펙의 그 AC에 「(대체됨)」 표시를 단다.

- AC-BREWFORM-01(2026-09-27-brew-form-redesign.md) → AC-BREWFIT-04 — 전환 지점 1024 → 1100, 360px 구간 1024–1279 → 1100–1279
- AC-BREWFORM-03의 **웹** 부분 → AC-BREWFIT-06 — 웹은 기준값 한 줄 대신 열마다 기준 표시. 모바일은 AC-BREWFIT-10이 그대로 잇는다
- AC-BREWFORM-04의 **웹** 부분 → AC-BREWFIT-07 — 웹은 문장 대신 `수율 —`
- AC-BREWFORM-11 → AC-BREWFIT-14 — 1~5 숫자 버튼 → 맛 도트(접근 이름·`aria-pressed`·키 규칙은 같다)
- AC-BREWFORM-18 → AC-BREWFIT-15 — 웹은 늘 펼침
- AC-BREWFORM-25 → AC-BREWFIT-25 — 대상 목록 확장, 시각 크기와 누르는 영역 분리(ADR 0010)

나머지 BREWFORM·WEBBREW·WEBLOGEDIT·ERRFOCUS AC는 그대로 유효하다.

---

## 구현 순서

각 태스크는 TDD 사이클 하나다(실패 테스트 → 실패 확인 → 최소 구현 → 통과 확인 → 커밋).

- [ ] **Task 1: 키트 부품 4종** — Covers: AC-BREWFIT-01, 02, 27

  `src/components/kit/index.tsx`에 `SectionLabel`·`NumberCell`·`LedgerField`·`TasteDots`를 시안 CSS 값 그대로
  추가하고 `/dev/kit`에 하나씩 놓는다. 숫자 입력은 기존 `NumberField`의 파싱을 옮긴다(새로 짜지 않는다).

  ```tsx
  export function NumberCell({ label, accessibleName, unit, ...input }: {...}) {
    return (
      <label data-kit="number-cell" className="flex min-h-[52px] items-center justify-between gap-2 rounded-[7px] border border-border bg-paper px-[14px] py-[12px]">
        <span className="text-[13.5px] whitespace-nowrap text-ink-3">{label}</span>
        <span className="flex items-baseline">
          <input aria-label={accessibleName} inputMode="decimal" className="w-full bg-transparent text-right font-mono text-[16px] font-medium" {...input} />
          {unit && <span className="ml-1 font-mono text-[11px] text-ink-3">{unit}</span>}
        </span>
      </label>
    );
  }
  ```

- [ ] **Task 2: 웹 폼 2열 + 숫자 셀·원장 필드 적용** — Covers: AC-BREWFIT-04, 05, 09, 26

  `BrewLogFields`의 섹션 제목을 `SectionLabel`로, 숫자를 `NumberCell` 2열로, 원두·그라인더·분쇄도를 `LedgerField`로.
  `BrewFormLayout` 전환 지점을 `min-[1100px]`로. 분쇄도 기준 표시는 `useRecipeLabel`의 targets에 `grinderModelId`·
  `grindSettingValue`·`grindSettingUnit`을 더해 비교한다.

- [ ] **Task 3: 웹 히어로 3열 + 다른 점 블록** — Covers: AC-BREWFIT-06, 07, 08, 20

  `BrewHero`를 웹/모바일 두 모양으로. 다른 점은 `diffPhrase`를 그대로 부르고 폼 상태를 넘긴다(`RecipeComparison`의
  `buildRows`에서 문장 부분만 함수로 빼서 공유).

- [ ] **Task 4: 웹 상단 바 동작** — Covers: AC-BREWFIT-03, 18(웹)

  `WebTopBar`에 동작 자리(`#topbar-actions`)를 두고 폼이 `createPortal`로 `취소`·`기록하기`를 넣는다. ≥1100에서
  `FormActions`(하단 줄)를 그리지 않는다.

- [ ] **Task 5: 맛 도트** — Covers: AC-BREWFIT-14, 15(웹), 21

  `BrewLogFields`의 `TasteScale`을 `TasteDots`로 바꾸고 웹에서 접기를 없앤다. 별점 22px.

- [ ] **Task 6: 모바일 원장 + 히어로 칩** — Covers: AC-BREWFIT-10, 11, 16, 19

  <1100에서 히어로 안 `NumberCell`(칩 모양) 2개 + `LedgerField` 8행 + `Segmented`. 공개 범위 라벨은 3개 모두
  한 줄(`whitespace-nowrap`).

- [ ] **Task 7: 묶음 시트** — Covers: AC-BREWFIT-12, 13, 15(모바일)

  기존 `BottomSheet` + 딤. 시트는 폼 상태를 직접 바꾼다(되돌리기 없음). Esc·딤 클릭·`완료`가 같은 `close`.

- [ ] **Task 8: 모바일 상단 줄 + 하단 CTA** — Covers: AC-BREWFIT-17, 18(모바일)

  폼 라우트의 <1100에서 `WebTopBar`의 「뒤로」 대신 폼의 `취소 / 새 기록 / 저장` 줄. 두 버튼은 같은 `submit`.

- [ ] **Task 9: 모바일 오류 경로** — Covers: AC-BREWFIT-22, 23, 24

  첫 오류 필드 → 그 필드가 속한 시트 id 표(위 「묶음 시트 구성」)로 시트를 열고 포커스. ERRFOCUS의 포커스 함수를
  시트가 열린 뒤 부른다.

- [ ] **Task 10: 누르는 영역 스윕 + 대체 AC 정리** — Covers: AC-BREWFIT-25

  `e2e/touch-targets.spec.ts` 측정 함수로 대상 목록을 잰다. 「대체하는 이전 AC」의 테스트를 옮기고 BREWFORM 스펙에
  「(대체됨)」 표시.

---

## 수동 확인

- [ ] ★ `pnpm compare`로 `/brews/new`를 `390`·`1280`px에서 시안과 나란히 놓고 「큼」 격차 0건을 사람이 확인한다. 결과를 PR 본문에 첨부한다
- [ ] 실제 기기(모바일 PWA)에서 묶음 시트의 입력이 키보드에 가리지 않는지 본다

## 열어둔 결정

- 없음
