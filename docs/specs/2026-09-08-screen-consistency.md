---
id: CONSIST
title: 화면 간 일관성 정비 — 라벨·구분자·대표 수치
status: 승인
plan: docs/plans/2026-09-08-plan-screen-consistency.md
---

# 화면 간 일관성 정비 스펙

> 2026-09-08 `/interview`로 확정. 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md).
> **모든 인수 조건은 자동화된 테스트로 옮길 수 있어야 한다.**

## 무엇을

**같은 값을 두 화면이 다르게 부르는 것을 멈춘다.** 목록 카드 둘과 상세 화면 둘이 같은 데이터를
보여주면서 구분자·라벨·글자 크기가 제각각이다. 넷을 한 규칙으로 맞춘다.

1. **카드 보조줄의 구분자를 없앤다** — `BrewLogCard`만 `·`를 쓴다. 간격 `gap-x-3`(12px)으로 통일한다.
2. **상세의 메타줄 라벨을 보이게 한다** — `RecipeDetail`만 `dt`를 `sr-only`로 숨긴다.
3. **라벨 어휘를 폼 `<label>`에 맞춘다** — 입력할 때와 읽을 때가 같은 단어가 된다.
4. **상세에 대표 수치를 세운다** — 목록 카드엔 18px 대표 수치가 있는데 상세는 전부 `text-sm`이라
   **들어갈수록 위계가 사라진다.**
5. **`BrewDetail`에 `<h1>`을 준다** — `h1` 14곳 중 브루로그 상세만 없다.

**백엔드를 건드리지 않는다.** API·스키마·HTTP 응답 변경이 0건이므로 **이 스펙에는 에러 인수 조건이
없다.**

### 범위 밖 (Non-goals)

- **터치 타깃 44×44px 검사.** `docs/conventions/frontend.md:179`가 규약으로 정해놓고 아무도 검사하지
  않는다. 실측하니 대상이 상호작용 요소 **74개**(`<button>` 34 · `<Link>` 13 · `<input>`류 27)이고
  명시적 크기 지정이 **0곳**이다. `2026-09-07-visual-hierarchy.md`가 「별도 스펙으로 분리한다」고
  쓴 결정을 그대로 따른다. **성격이 「일관성」이 아니라 「접근성」이라 한 스펙에 섞지 않는다.**
- **간격·모서리·그림자 체계.** 지금 간격 12단계·모서리 3종·그림자 0곳이다. 다음 스펙으로 넘긴다.
  이 스펙이 건드리는 간격은 **메타줄 4곳의 `gap-x`뿐**이며, 그것은 항목 구분자를 없앤 결과이지
  간격 체계를 정하는 일이 아니다.
- **새 글자 크기 단계.** `visual-hierarchy`가 잠근 **5단계를 깨지 않는다.** 상세의 대표 수치도
  카드와 같은 18px(`text-lg`)를 쓴다.
- **백엔드 변경.** 0건.
- **대표 수치에 색을 주는 것.** `visual-hierarchy`의 「색은 액션에만 쓴다」를 유지한다.

## 왜

**들어갈수록 위계가 사라진다.** 목록에서는 `20.0g → 300.0g`이 18px로 눈에 들어오는데, 그 카드를
눌러 상세로 들어가면 같은 값이 14px로 다른 값들과 섞인다. **더 자세히 보려고 들어갔는데 화면이
말해주는 것은 더 적다.**

**같은 값을 두 단어로 부른다.** 브루로그를 쓸 때 폼은 `원두량`이라 묻고, 저장하고 나면 상세는
`원두량`, 레시피 상세는 `원두`, 스크린리더는 카드에서 `원두`라고 읽는다. 하나의 값에 이름이 셋이다.

**브루로그 상세에는 `h1`이 없다.** 나머지 14곳은 전부 `<h1 className="text-xl font-semibold">`인데
여기만 `<Link className="text-lg font-medium">`이다. 화면 제목이 없으므로 스크린리더 사용자가
「지금 무엇을 보고 있는가」를 제목 탐색으로 알 수 없다.

## 용어

| 용어 | 정의 |
|---|---|
| **대표 수치** | 한 카드·한 화면에서 정확히 하나만 18px semibold로 뜨는 숫자. `visual-hierarchy`의 「주요 수치」 단계 |
| **보조줄** | 목록 카드에서 대표 수치 아래 오는 12px muted 줄 |
| **메타줄** | 상세 화면에서 제목·대표 수치 아래 오는 14px 줄. 라벨은 12px muted |
| **승격** | 대표 수치로 쓸 값이 없을 때 다음 값이 그 자리로 올라오는 것 |

## 표시 규칙

### 라벨 어휘 — 폼 `<label>`과 문자 단위로 같다

| 값 | **확정 라벨** | 현행 | 근거 |
|---|---|---|---|
| `doseG` / `actualDoseG` | `원두량` | 원두 / 원두량 | 폼 `<label>원두량</label>` |
| `waterG` / `actualWaterG` | `물량` | 물 / 물 | 폼 `<label>물량</label>` |
| `waterTempC` / `actualWaterTempC` | `물 온도` | 물 온도 / 온도 | 폼 `<label>물 온도</label>` |
| `totalTimeSeconds` (레시피) | `총 시간` | 총 시간 | 폼 `<label>총 시간</label>` |
| `actualTotalTimeSeconds` (로그) | `추출 시간` | 추출 시간 / 시간 | 폼 `<label>추출 시간</label>` |
| `ratio` / `brewRatio` | `비율` | 비율 / 브루 비율 | 폼에 없는 계산값 — `BrewDetail` 현행을 채택 |
| `grindSettingValue` | `분쇄도` | 분쇄도 | 폼은 `분쇄도 값`(입력칸이 둘이라 구분이 필요). 표시는 하나라 `분쇄도` |
| `extractionYieldPercent` | `추출 수율` | 추출 수율 | 폼에 없는 계산값 — 현행 유지 |
| `brewedAt` (카드) | `내린 날` | 내린 날 | 폼은 `내린 시각`이나 카드는 **날짜만** 표시한다(`slice(0, 10)`) |
| 원두 **이름** | `원두` | 원두 | 도즈의 `원두량`과 구분한다. `BrewDetail` 현행 유지 |

**이 표는 카드의 `sr-only` 라벨에도 적용된다.** 보이든 숨겨지든 같은 값은 같은 단어로 부른다.

### 무엇이 대표 수치인가

| 화면 | 대표 수치 | 승격 |
|---|---|---|
| `RecipeCard` | `원두량 → 물량` (예: `20.0g → 300.0g`) | 없음 — 둘 다 필수 |
| `RecipeDetail` | `원두량 → 물량` | 없음 |
| `BrewLogCard` | `비율` (`1:15.0`) | 없으면 `물 온도` |
| `BrewDetail` | `비율` | 없으면 `물 온도` |

**`brewRatio` 승격 분기는 백엔드 상태가 아니라 프론트 계약을 방어한다.** 백엔드에서는 실제로 비지
않는다(`actual_dose_g`·`actual_water_g`가 둘 다 `nullable = false`이고 `ExtractionAnalyzer`가 분기
없이 나눈다). **프론트 스키마가 `optional`인 한** 타입상 빌 수 있으므로 분기를 유지한다.

**대표로 올린 항목은 아래 메타줄·보조줄에서 뺀다.** 「복사」가 아니라 「이동」이다. `BrewLogCard`가
이미 쓰는 규칙(`taken`)을 상세에도 적용한다.

**★ 대표 수치 줄에는 라벨을 보이지 않는다.** 18px 숫자 옆에 12px 라벨을 붙이면 대표 수치가 깎인다.
대표 줄의 `dt`는 `sr-only`로 남고, **라벨을 보이게 하는 결정은 아래 메타줄·「실측값」에만 적용된다.**

### 간격

메타줄·보조줄 **4곳 전부** 가로 간격이 `gap-x-3`(12px)이다.

| 위치 | 현행 | 확정 |
|---|---|---|
| `RecipeCard` 보조줄 | `gap-x-3` | `gap-x-3` (그대로) |
| `BrewLogCard` 보조줄 | `gap-x-1` + `·` | `gap-x-3`, 구분자 없음 |
| `RecipeDetail` 메타줄 | `gap-x-3` | `gap-x-3` (그대로) |
| `BrewDetail` 실측값 | `gap-x-4` | `gap-x-3` |

라벨과 값 사이는 `gap-1`(4px)로 둔다 — 항목 사이(12px)의 3분의 1이라 묶음이 읽힌다.

## ★ 갱신하는 기존 인수 조건

**`visual-hierarchy`의 「화면 제목 14곳」 조건(VISUAL‑13)을 15곳으로 갱신한다.**
`src/test/headings.test.ts`가 `expect(found).toHaveLength(14)`로 못박고 있어서, `BrewDetail`에
`h1`을 더하면 그 테스트가 깨진다. **갱신 이유를 `2026-09-07-visual-hierarchy.md`의 그 AC 자리에
남긴다.**

그 조건이 요구하는 「모든 `h1`이 `text-xl font-semibold`」는 그대로 유지된다 — 새 `h1`도 같은
클래스를 쓴다.

> **다른 스펙의 AC ID를 `AC-` 접두어까지 붙여 쓰지 않는다.** `check-spec-coverage.sh`가
> `AC-[A-Z]+-[0-9]+`를 파일 전체에서 뽑아 **이 스펙의 것으로 집계**하므로, 인용만으로 개수가
> 부풀고 남의 AC가 이 스펙에 딸려 붙는다. 앞 세션이 두 번 걸린 함정이다
> (`docs/JOURNAL.md` 2026-09-07).

---

## 어떻게 동작 — 인수 조건

### 정상 동작

#### AC-CONSIST-01 · `BrewLogCard`에 구분자 `·`가 없다

- **Given** `frontend/src/features/brewlog/components/BrewLogCard.tsx`
- **When** **주석을 지운** 소스 문자열에서 `·`(U+00B7)를 센다
- **Then** 0개다
- **검증** 소스 검사 `src/test/consistency.test.ts`

> **주석을 지우고 센다.** 이 저장소는 주석에서 `·`를 한국어 연결 부호로 정상적으로 쓴다
> (`dt·dd`, `actual_dose_g`·`actual_water_g`). 원본 그대로 세면 구분자가 아니라 설명 문장을
> 금지하게 된다. **검사하려는 것은 화면에 그려지는 것이다.**

#### AC-CONSIST-02 · `RecipeDetail`에 구분자 `·`가 없다

- **Given** `frontend/src/features/recipe/components/RecipeDetail.tsx` — 기구 줄이
  `<span aria-hidden> · </span>`으로 브루어와 필터를 잇고 있다
- **When** **주석을 지운** 소스 문자열에서 `·`(U+00B7)를 센다
- **Then** 0개다
- **검증** 소스 검사 `src/test/consistency.test.ts`

#### AC-CONSIST-03 · 메타줄 4곳의 가로 간격 클래스가 `gap-x-3`이다

- **Given** `RecipeCard.tsx` · `BrewLogCard.tsx` · `RecipeDetail.tsx` · `BrewDetail.tsx`
- **When** 각 파일의 보조줄·메타줄 `<dl>`/`<div>` 클래스를 읽는다
- **Then** 넷 다 `gap-x-3`을 포함하고, `gap-x-1`·`gap-x-2`·`gap-x-4`를 포함하지 않는다
- **검증** 소스 검사 `src/test/consistency.test.ts`

#### AC-CONSIST-04 · 브라우저에서 잰 메타줄의 `column-gap`이 12px이다

- **Given** 360×800 뷰포트에서 `/recipes` · `/brews` · `/recipes/12` · `/brews/2`을 연다
- **When** 각 화면의 보조줄·메타줄 요소에서 `getComputedStyle(el).columnGap`을 읽는다
- **Then** 네 값이 전부 `12px`다
- **검증** e2e `e2e/consistency.spec.ts`

#### AC-CONSIST-05 · `RecipeDetail`의 메타줄 라벨이 화면에 보인다

- **Given** `ratio: 15`, `waterTempC: 92`, `totalTimeSeconds: 210`인 레시피 상세
- **When** `screen.getByText("비율")` · `getByText("물 온도")` · `getByText("총 시간")`을 부른다
- **Then** 셋 다 존재하고, 각 요소에 `sr-only` 클래스가 없다
- **검증** 컴포넌트 테스트 `src/app/recipes/[id]/page.test.tsx`

#### AC-CONSIST-06 · 라벨 어휘표 10줄이 그대로 렌더된다

- **Given** 라벨 어휘표의 값이 전부 채워진 레시피·브루로그 픽스처
- **When** `RecipeCard` · `BrewLogCard` · `RecipeDetail` · `BrewDetail`을 렌더한다
- **Then** 각 항목의 `dt` 텍스트가 표의 「확정 라벨」과 **문자 단위로 같다** —
  `원두량` · `물량` · `물 온도` · `총 시간`(레시피) · `추출 시간`(로그) · `비율` · `분쇄도` ·
  `추출 수율` · `내린 날` · `원두`. `원두`·`물`·`온도`·`시간`·`브루 비율`은 `dt`로 존재하지 않는다
- **검증** 컴포넌트 테스트 `RecipeCard.test.tsx` · `BrewLogCard.test.tsx` ·
  `src/app/recipes/[id]/page.test.tsx` · `src/app/brews/[id]/page.test.tsx`

#### AC-CONSIST-07 · 상세 메타줄 라벨의 렌더 크기가 12px, 색이 `--color-muted`다

- **Given** 360×800 뷰포트에서 `/recipes/12` · `/brews/2`을 연다
- **When** 메타줄의 `dt` 요소에서 `getComputedStyle`의 `fontSize`와 `color`를 읽는다
- **Then** `fontSize`가 `12px`이고 `color`가 `--color-muted`의 계산값과 같다
- **검증** e2e `e2e/consistency.spec.ts`

#### AC-CONSIST-08 · `RecipeDetail`의 대표 수치가 정확히 하나이고 `30.0g → 500.0g`이다

- **Given** `doseG: 30`, `waterG: 500`인 레시피 상세 — `src/test/fixtures.ts`의 `hoffmann`이다
- **When** `text-lg`·`font-semibold`·`tabular-nums`를 모두 가진 요소를 센다
- **Then** 정확히 1개이고, 그 텍스트가 `30.0g → 500.0g`이며, 그 안의 `dt`는 `sr-only`다
- **검증** 컴포넌트 테스트 `src/app/recipes/[id]/page.test.tsx`

#### AC-CONSIST-09 · `BrewDetail`의 대표 수치가 정확히 하나이고 `1:15.0`이다

- **Given** `brewRatio: 15`인 브루로그 상세
- **When** `text-lg`·`font-semibold`·`tabular-nums`를 모두 가진 요소를 센다
- **Then** 정확히 1개이고, 그 텍스트가 `1:15.0`이며, 그 안의 `dt`는 `sr-only`다
- **검증** 컴포넌트 테스트 `src/app/brews/[id]/page.test.tsx`

#### AC-CONSIST-12 · `/brews/{id}`에 `h1`이 정확히 하나다

- **Given** `recipe.isReady`가 `true`이고 레시피 이름이 `에티오피아 예가체프`인 브루로그 상세
- **When** `screen.getAllByRole("heading", { level: 1 })`을 부른다
- **Then** 길이가 1이고, 텍스트가 `에티오피아 예가체프`이며,
  `className`이 `text-xl`과 `font-semibold`를 포함한다
- **검증** 컴포넌트 테스트 `src/app/brews/[id]/page.test.tsx`

#### AC-CONSIST-14 · 대표 수치 4곳의 `font-variant-numeric`이 `tabular-nums`다

- **Given** 360×800 뷰포트에서 `/recipes` · `/brews` · `/recipes/12` · `/brews/2`을 연다
- **When** 각 화면의 대표 수치 요소에서 `getComputedStyle(el).fontVariantNumeric`을 읽는다
- **Then** 네 값이 전부 `tabular-nums`다
- **검증** e2e `e2e/consistency.spec.ts`

### 경계값

#### AC-CONSIST-10 · `brewRatio`가 없으면 `BrewDetail`의 대표 수치가 물 온도로 승격한다

- **Given** `brewRatio`가 `undefined`이고 `actualWaterTempC: 92`인 브루로그 상세
- **When** 대표 수치 요소를 읽는다
- **Then** 정확히 1개이고, 그 텍스트가 `92°C`다
- **검증** 컴포넌트 테스트 `src/app/brews/[id]/page.test.tsx`

#### AC-CONSIST-11 · 대표로 올린 항목은 아래 「실측값」에 없다

- **Given (가)** `brewRatio: 15`인 브루로그 상세
- **Then (가)** 「실측값」 `<dl>` 안에 `dt` 텍스트 `비율`이 **없고**, `물 온도`는 **있다**
- **Given (나)** `brewRatio`가 `undefined`이고 `actualWaterTempC: 92`인 브루로그 상세
- **Then (나)** 「실측값」 `<dl>` 안에 `dt` 텍스트 `물 온도`가 **없다**
- **검증** 컴포넌트 테스트 `src/app/brews/[id]/page.test.tsx`

#### AC-CONSIST-13 · 레시피를 못 읽을 때도 `h1`이 정확히 하나다

- **Given** 레시피 조회가 403 또는 404로 실패해 `recipe.isReady`가 `false`이고
  `recipe.label`이 `비공개 레시피`인 브루로그 상세
- **When** `screen.getAllByRole("heading", { level: 1 })`을 부른다
- **Then** 길이가 1이고, 텍스트가 `비공개 레시피`이며, `className`이 `text-xl`과 `font-semibold`를
  포함하고, **링크가 아니다**(`<a>`가 아니다)
- **검증** 컴포넌트 테스트 `src/app/brews/[id]/page.test.tsx`

### 에러

**없다.** 백엔드 변경이 0건이고 새 HTTP 응답 경로가 없다.

---

## 수동 확인

- [ ] 폰 실물에서 `/recipes` → 레시피 상세로 들어갔을 때 대표 수치가 목록과 같은 자리에서 이어지는
      느낌인지 (비차단형)
- [ ] 12px 라벨이 부엌 조명에서 값과 구분되는지 (비차단형)

## 열어둔 결정

- **터치 타깃 44×44px** — 별도 스펙. 대상 74개, 명시적 크기 지정 0곳
- **간격·모서리·그림자 체계** — 별도 스펙. 간격 12단계·모서리 3종·그림자 0곳
