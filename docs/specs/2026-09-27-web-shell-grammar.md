---
id: GRAMMAR
title: 웹 셸·공통 문법 목업 정합 — 본문 폭·상단 바·수치 표기·탭 바·secondary·뒤로
status: 구현완료
milestone: M2
supersedes:
---

# 웹 셸·공통 문법 목업 정합 스펙

> 작성 규칙은 [`docs/specs/README.md`](README.md) 참조.
> **모든 인수 조건은 자동화된 테스트로 옮길 수 있어야 한다.**

## 시나리오

2026-09-28 목업 전수 조사(15화면 × 390/1280)에서 거의 모든 화면이 「멂」이었고, 격차의 상당수가 화면이 아니라
**셸과 공통 문법**에서 왔다(#164). 화면별 재배치(#161·#141·#143·#165·#166)를 하기 전에 그 기반을 한 번에 목업에
맞춘다.

- 웹(`≥1100px`)에서 목록 화면이 가운데 672px에 갇히지 않고 전폭(거터 48px)으로 펼쳐진다
- 웹 상단 바의 내비가 로고 옆 왼쪽에 붙고, CTA는 화면마다 그 화면의 일을 말한다
- 수치가 목업 표기(`16 g`, mono 500)로 보인다
- 모바일 탭 바의 활성 표시가 ink + 밑줄이다
- secondary 버튼이 배경 없이 테두리만 있다
- 모바일에서 상세·도구 화면은 탭 바가 없고 「뒤로」로 돌아간다

목업 정본: `docs/design/kaldi-note-design/` — 상단 바 `02 Recipes and Cups - Web`(RW1 헤더), 탭 바 README
「전역 내비게이션」, 뒤로 바 `08 Other Screens - Mobile`, 수치 표기 02·03·08 전체.

**백엔드 변경 없음.** 프론트 전용이다.

### 범위 밖 (Non-goals)

- 화면별 레이아웃 — 기록 상세 2컬럼(#141), 레시피 3열 그리드·상세 2단(#166), 기록 카드 틀(#143), 레시피 폼(#165)
- 상세 화면의 상단 바 CTA(RW3 `내 서랍에 담기`, W3 `수정`·`친구에게 공유`) — 데이터에 따라 달라지므로 #166·#141이 넣는다
- 모바일 CTA를 탭 바 위에 붙이는 배치
- 웹 아바타 메뉴·`/settings`(#169), 로그인(#175)·오프라인(#176) 화면
- 새 색 토큰(다크 포함). 목업의 secondary 테두리 `oklch(0.85 …)`는 기존 `border`(0.88)로 근사한다
- 활성 탭 재탭 시 맨 위로·탭별 스크롤 위치 유지(README 내비 규칙의 나머지)

### 목업 수치의 근사

간격 스케일(`4·8·12·16·24·48`, 임의값 금지 — AC-SPACE-03)·글자 토큰(AC-READ-10)·모서리 4종(AC-SPACE-04)이 잠겨 있어
목업 수치 일부를 가장 가까운 허용값으로 근사한다(구현 착수 시 확인, 2026-09-27).

| 자리 | 목업 | 이 스펙 |
|---|---|---|
| 웹 상단 바 세로 패딩 | 18px | 16px (`py-4`) |
| 상단 바 링크 간격 | 26px | 24px (`gap-6`) |
| 상단 바 링크 글자 | 14.5px | 15px (`text-body`) |
| 로고 → 내비 | 40px | 40px (`gap-6` + `ml-4`) — 정확 |
| 탭 밑줄 위 여백 · 모서리 | 7px · 2px | 8px (`mt-2`) · `rounded-tag` (rounded-full 6곳 상한, AC-SPACE-07) |
| 탭 바 세이프에어리어 | 58px + safe-area | 58px — `viewport-fit=cover`가 없어 `env()`가 늘 0이고 브라우저가 인디케이터 자리를 비운다 |

### 구현 중 정한 것

- **홈(`Shell grow`)은 웹 거터 24px를 유지한다** — 웹 두 컬럼이 각자 48px 패딩을 가져 바깥 거터를 올리면 달력이 900px로 눌린다(AC-HOMECAL-84)
- `UserProfile`은 로컬 `Shell`(`px-4`)을 쓰고 있어 공용 `Shell`(`wide`)을 감싸게 바꿨다
- 수치 유틸 `text-metric`·`text-metric-hero`·`text-card-metric`이 굵기 500을 갖는다. 크기를 상속하는 자리(표 셀·비교표·스텝 물량)는
  `font-num`(글꼴·굵기만)을 쓴다 — `text-` 접두어는 글자 크기 허용목록 검사(AC-VISUAL-05)에 걸린다
- 비교표에서 다른 실측값은 accent 색만 칠하고 굵게 하지 않는다(목업 W3 — 실측 열 mono 500)
- `formatCumulativeGrams`는 `formatGrams`와 같아져 지웠다. 뒤로 대상은 `navScreens.backHref`의 표 하나다
- 탭 바는 `h-[59px]`(테두리 1px 포함, 탭 자체 58px)

## 용어

| 용어 | 정의 |
|---|---|
| 웹 / 모바일 | `≥1100px` / `<1100px`. `WebTopBar`·`BottomNav`가 이미 이 경계를 쓴다(AC-WEBHDR-08·09) |
| 목록 화면 | `/recipes`·`/brews`·`/u/[id]`. 전폭을 쓴다 |
| 상세·도구 화면 | `/recipes/[id]`·`/brews/[id]`·`/u/[id]`·`/gear/grind-converter`. 모바일에서 탭 바 대신 「뒤로」 |
| 탭 화면 | `/`·`/recipes`·`/brews`·`/more`. 모바일에서 탭 바가 보인다 |
| 독립 값 | 값 하나가 한 칸을 차지하는 자리 — 히어로, 원장 행 값, 비교표 셀, 표 셀, 스텝 물량. `16 g` |
| 요약 줄 | 여러 값을 한 줄로 잇는 자리 — `16g → 250g · 92°C · 3:30`, 태그 배지. 붙여 쓴다 |

> `/u/[id]`는 목록 화면(웹 전폭)이면서 상세·도구 화면(모바일 뒤로)이다. 두 분류는 서로 다른 축이다.

---

## 인수 조건

> 스텁 id: 레시피 상세 `/recipes/12`, 기록 상세 `/brews/2`, 프로필 `/u/11`(본인, `e2e/stubs.ts`).
> 검증 파일: 순수 함수 `src/lib/format.test.ts`·`src/lib/navScreens.test.ts`·`src/features/brewlog/diffPhrase.test.ts`,
> 컴포넌트 `src/components/layout/*.test.tsx`, E2E `e2e/shell-grammar.spec.ts`(기존 `stubs.ts`로 390/1280).
> 픽셀 비교는 `e2e/tolerance.ts`의 허용 오차(±1px)를 쓴다.

### 기능

#### AC-GRAMMAR-01 · 웹 목록 화면은 전폭이고 거터가 48px다

- **Given** 뷰포트 `1280×900`
- **When** `/recipes`·`/brews`·`/u/11`을 각각 연다
- **Then** `<main>`의 폭이 `1280`px, computed `padding-left`·`padding-right`가 각각 `48px`다
- **검증** e2e

#### AC-GRAMMAR-02 · 웹 상세·폼·도구 화면은 672px 폭을 유지한다

- **Given** 뷰포트 `1280×900`
- **When** `/recipes/12`·`/brews/2`·`/gear/grind-converter`를 각각 연다
- **Then** `<main>`의 폭이 `672`px 이하다
- **검증** e2e

#### AC-GRAMMAR-03 · 웹 상단 바는 로고 옆에 내비를 둔다

- **Given** 뷰포트 `1280×900`, `/recipes`
- **When** 상단 바를 본다
- **Then** `<header>`의 computed `padding-left`·`padding-right`가 `48px`, `padding-top`·`padding-bottom`이 `16px`다.
  링크 `홈`의 left − 로고 링크의 right = `40`px, 링크 사이 간격이 `24`px, 링크 글자 크기가 `15px`(`text-body`)다.
  링크 `내 잔`의 right < CTA의 left이고, CTA의 right와 아바타 left 사이가 `16`px, 아바타가 `34×34`px다
- **검증** e2e

#### AC-GRAMMAR-04 · 웹 상단 바 링크는 ink 500으로 감전다

- **Given** 뷰포트 `1280×900`, `/recipes`
- **When** 링크 색과 굵기를 읽는다
- **Then** `레시피`의 color가 `--ink`, font-weight가 `500`이고, `홈`·`내 잔`은 color `--ink-3`, font-weight `400`이다
- **검증** e2e (`tokenColor.ts`)

#### AC-GRAMMAR-05 · 상단 바 CTA는 화면마다 다르다

- **Given** 뷰포트 `1280×900`
- **When** `/`·`/recipes`·`/brews`를 각각 연다
- **Then** 상단 바의 primary 링크가 정확히 1개이고, 순서대로 이름·`href`가
  `이 레시피로 내렸다`·`/recipes` / `새 레시피`·`/recipes/new` / `기록하기`·`/recipes`다
- **검증** 컴포넌트 테스트 `WebTopBar.test.tsx`

#### AC-GRAMMAR-06 · 독립 값은 띄우고 끝의 .0을 뗀다

- **Given** —
- **When** 형식 함수를 부른다
- **Then** `formatGrams(30)` → `"30 g"`, `formatGrams(30.0)` → `"30 g"`, `formatGrams(15.5)` → `"15.5 g"`,
  `formatTemperature(92)` → `"92 °C"`, `formatTemperature(92.5)` → `"92.5 °C"`다.
  `formatRatio(15.6)` → `"1:15.6"`, `formatDuration(210)` → `"3:30"`은 바뀌지 않는다
- **검증** 단위 테스트 `format.test.ts`

#### AC-GRAMMAR-07 · 요약 줄은 붙이고 끝의 .0을 뗀다

- **Given** —
- **When** 요약용 형식 함수를 부른다
- **Then** `formatGramsCompact(16)` → `"16g"`, `formatGramsCompact(15.5)` → `"15.5g"`, `formatTemperatureCompact(92)` → `"92°C"`다
- **검증** 단위 테스트 `format.test.ts`

#### AC-GRAMMAR-08 · 화면에서 두 표기가 제자리에 쓰인다

- **Given** 레시피 `doseG=30.0`, `waterG=500.0` / 기록 `actualDoseG=20.0`, `actualWaterG=300.0`, `actualWaterTempC=92.0` /
  기록 작성 화면의 레시피 `doseG=20.0`, `waterG=300.0`, `waterTempC=92.0`, `totalTimeSeconds=210`
- **When** 레시피 상세, 기록 상세, 기록 작성 화면(`/brews/new?recipeId=…`)을 연다
- **Then** 레시피 상세에 `30 g`·`500 g`이 보이고 본문 어디에도 `\d.0g` 형태가 없다. 기록 상세에 `20 g`·`300 g`·`92 °C`가
  보인다. 기록 작성 히어로 아래 줄은 `20g → 300g · 92°C · 3:30`이다
- **검증** 컴포넌트 테스트 `src/app/recipes/[id]/page.test.tsx`(AC-WEB-14와 함께)·`src/app/brews/[id]/page.test.tsx`(AC-WEBBREW-40과 함께)·`src/app/brews/new/page.test.tsx`(AC-BREWFORM-03과 함께)

#### AC-GRAMMAR-09 · 수치 유틸의 굵기는 500이다

- **Given** 뷰포트 `1280×900`
- **When** `/recipes`·`/recipes/12`·`/brews/2`에서 `text-metric`·`text-metric-hero`·`text-card-metric` 클래스를 가진 요소를 모두 모은다
- **Then** 모은 요소가 1개 이상이고, 전부 computed font-weight가 `500`이다
- **검증** e2e

#### AC-GRAMMAR-10 · 모바일 탭 바는 ink + 밑줄로 감전다

- **Given** 뷰포트 `390×844`, `/recipes`
- **When** 탭 바를 본다
- **Then** 탭 바의 높이가 border-top을 빼고 `58`px, `border-top`이 `1px` `--divider-strong`이다.
  활성 탭 `레시피`는 글자 `13px`/`600`/`--ink`이고 그 아래 `18×2`px `--ink` 막대(라벨 bottom과 막대 top 사이 `8`px)가 있다.
  나머지 탭은 `13px`/`400`/`--ink-3`이고 막대가 없다
- **검증** e2e

#### AC-GRAMMAR-11 · secondary 버튼은 배경이 없다

- **Given** 라이트 모드, `<Button variant="secondary">`와 `<ButtonLink variant="secondary">`
- **When** 계산 스타일을 읽는다
- **Then** background-color가 `rgba(0, 0, 0, 0)`, 테두리가 `1px` `--border`, 글자가 `--ink`다. hover 배경은 `--sunken`이다(AC-BTN-09 유지)
- **검증** e2e `button-color.spec.ts`

#### AC-GRAMMAR-12 · 모바일 상세·도구 화면은 탭 바 대신 뒤로를 둔다

- **Given** 뷰포트 `390×844`
- **When** `/recipes/12`·`/brews/2`·`/u/11`·`/gear/grind-converter`를 각각 연다
- **Then** `nav[aria-label="주요 화면"]`이 없고, 텍스트 `kaldi·note`가 없고, 이름이 `뒤로`인 링크가 있다.
  그 `href`는 순서대로 `/recipes`·`/brews`·`/`·`/more`다
- **검증** 단위 테스트 `navScreens.test.ts`(경로 → 뒤로 대상) + e2e

### 엣지 (경계값)

#### AC-GRAMMAR-13 · 1100px은 웹이고 1099px은 모바일이다

- **Given** `/recipes/12`
- **When** 뷰포트 폭을 `1100`px / `1099`px로 둔다
- **Then** `1100`: `뒤로` 링크가 없고 상단 바 링크 3개가 보인다 / `1099`: `뒤로` 링크가 있고 상단 바 링크가 보이지 않는다
- **검증** e2e

#### AC-GRAMMAR-14 · CTA가 없는 화면

- **Given** 뷰포트 `1280×900`
- **When** `/recipes/12`·`/brews/2`·`/more`·`/u/11`·`/gear/grind-converter`를 각각 연다
- **Then** 상단 바는 보이고, 그 안에 primary 링크가 `0`개다
- **검증** 컴포넌트 테스트 `WebTopBar.test.tsx`

#### AC-GRAMMAR-15 · 탭 화면은 그대로 탭 바를 쓴다

- **Given** 뷰포트 `390×844`
- **When** `/`·`/recipes`·`/brews`·`/more`를 각각 연다
- **Then** `nav[aria-label="주요 화면"]`이 있고 `뒤로` 링크가 없다
- **검증** 단위 테스트 `navScreens.test.ts` + e2e

#### AC-GRAMMAR-16 · 새 레시피·편집 경로는 상세로 오인하지 않는다

- **Given** —
- **When** `backHref("/recipes/new")`, `backHref("/recipes/1/edit")`, `backHref("/brews/1/edit")`를 부른다
- **Then** 전부 `null`이다(이 경로들은 `isHidden`이 이미 셸을 감춘다 — AC-WEBHDR-10 유지)
- **검증** 단위 테스트 `navScreens.test.ts`

#### AC-GRAMMAR-17 · 차이 문구는 띄우고 소수 1자리를 유지한다

- **Given** 레시피 원두량 `30.0`, 실측 `31.0` / 레시피 물량 `500.0`, 실측 `498.0` / 레시피 물 온도 `93`, 실측 `96`
- **When** 차이 문구를 만든다
- **Then** `원두를 1.0 g 더 썼습니다.` / `물을 2.0 g 덜 썼습니다.` / `3 °C 높게 내렸습니다.`다
  (목업 W3 `원두를 1.0 g 더 썼습니다.` — 차이는 작은 값이라 소수를 떼지 않는다)
- **검증** 단위 테스트 `diffPhrase.test.ts`

#### AC-GRAMMAR-18 · me 로딩 중에도 CTA는 보인다

- **Given** 뷰포트 `1280×900`, `/recipes`, `me` 요청이 응답 전이다
- **When** 상단 바를 본다
- **Then** `새 레시피` 링크가 있고, 아바타 자리는 비어 있다
- **검증** 컴포넌트 테스트 `WebTopBar.test.tsx`

### 실패

#### AC-GRAMMAR-19 · 매핑에 없는 경로에서 상단 바가 깨지지 않는다

- **Given** 뷰포트 `1280×900`
- **When** `/offline`을 연다
- **Then** 상단 바의 로고가 보이고 primary 링크는 `0`개이며, 콘솔 에러가 `0`건이다
- **검증** e2e

### 비기능

#### AC-GRAMMAR-20 · 뒤로 링크는 44×44px 이상이다

- **Given** 뷰포트 `390×844`, `/brews/2`
- **When** `뒤로` 링크의 박스를 잰다
- **Then** 너비와 높이가 각각 `44`px 이상이다
- **검증** e2e

#### AC-GRAMMAR-21 · 전폭이 되어도 가로 스크롤이 없다

- **Given** 뷰포트 `1280×900`
- **When** `/recipes`·`/brews`를 연다
- **Then** `document.documentElement.scrollWidth`가 `clientWidth` 이하다
- **검증** e2e

#### AC-GRAMMAR-22 · 표·비교표·스텝의 수치도 mono 500이다

> 2026-09-27 추가(사용자 승인). ★ 목업 대조에서 AC-09가 수치 유틸이 붙은 요소만 봐서, 유틸 없이 그려지는
> 독립 값 자리가 Sans로 남은 것을 놓쳤다(README 82행 「수치를 Sans로 쓰지 마세요」).

- **Given** 뷰포트 `1280×900`
- **When** `/brews` 표의 원두량 셀(`20 g`)·물 온도 셀(`92 °C`), `/brews/2` 비교표의 값 셀(`30 g`·`20 g`), `/recipes/12` 스텝 물량(`60 g`)을 읽는다
- **Then** 모두 computed `font-family`가 `IBM Plex Mono`로 시작하고 `font-weight`가 `500`이다
- **검증** e2e

---

## 대체하는 이전 AC

이전 스펙의 일부 AC만 대체한다(스펙 전체 대체가 아니라 frontmatter `supersedes`는 비워둔다). 구현하면서
해당 테스트를 새 AC로 옮기고, 이전 스펙의 그 AC에 「(대체됨)」 표시를 단다.

**동작이 바뀐 AC**(WEBSHELL-03·04, BTN-05)는 헤딩을 「(대체됨)」 문단으로 바꾸고 테스트 ID를 새 AC로 옮겼다.
**값만 바뀐 AC**(표기 리터럴·CTA·탭 크기)는 원래 AC의 값을 갱신하고 「표기 갱신」·「일부 대체」 노트를 달았다 —
테스트는 두 ID를 함께 단다(예: `AC-WEB-14 · AC-GRAMMAR-08`).

- AC-WEBHDR-01(docs/specs/2026-09-20-web-header-rollout.md)의 상세·도구 화면 부분 → AC-GRAMMAR-12 — 탭 화면에서는 유지
- AC-WEBSHELL-03·04(docs/specs/2026-09-01-web-shell.md) → AC-GRAMMAR-12 — 모바일 상세에서 탭 바가 사라진다. 웹 상단 바의 활성 표시는 AC-WEBHDR-04가 계속 지킨다
- AC-BTN-05(docs/specs/2026-09-21-button-color-fidelity.md) → AC-GRAMMAR-11 — `--surface` → 투명. 목업 README 컴포넌트 표(bg `surface`)와 화면 목업(배경 없음)이 어긋나 **화면 목업을 정본으로 정했다**(2026-09-27 사용자 결정)
- AC-WEB-14(docs/specs/2026-08-21-web-recipe-read.md)의 `30.0g`·`500.0g` → AC-GRAMMAR-08 — `30 g`·`500 g`
- AC-WEBBREW-40(docs/specs/2026-08-31-web-brew-log.md)의 `20.0g`·`300.0g`·`92°C` → AC-GRAMMAR-06 — `20 g`·`300 g`·`92 °C`
- AC-WEBEDIT-22·23(docs/specs/2026-08-30-web-recipe-write.md) → AC-GRAMMAR-06 — `240 g / 300 g`·`60 g 부족합니다`
- AC-RECIPESBREWS-69·76(docs/specs/2026-09-25-recipe-drawer-screens.md)의 `15.0g`·`16.0g` → AC-GRAMMAR-06 — `15 g`·`16 g`. AC-69가 「시각 보정 트랙에서 재검토」로 남겨둔 것이 이 스펙이다
- AC-BREWFORM-03(docs/specs/2026-09-27-brew-form-redesign.md)의 `16.0g → 250.0g · 92°C · 3:30` → AC-GRAMMAR-07·08 — `16g → 250g · 92°C · 3:30`
- AC-SMALL-01·02·04(docs/specs/2026-09-17-small-features.md)의 차이 문구 → AC-GRAMMAR-17 — `1.0g` → `1.0 g`, `3°C` → `3 °C`

- AC-WEBHDR-03(docs/specs/2026-09-20-web-header-rollout.md)의 CTA 부분 → AC-GRAMMAR-05 — `/recipes`의 CTA가 `새 레시피`(`/recipes/new`)(구현 중 발견해 추가)
- AC-WEB-16·AC-WEBLOGSTEP-01·AC-VISUAL-10·11·AC-CONSIST-10의 표기 리터럴(`60g`·`50g`·`92°C`) → AC-GRAMMAR-06 — 값만 갱신(구현 중 발견해 추가)
- AC-TOUCH-10(docs/specs/2026-09-09-touch-targets.md)의 탭 크기 `90×49.5` → AC-GRAMMAR-10 — `90×58`(구현 중 발견해 추가)

구현 중 이 목록 밖의 테스트가 표기 때문에 깨지면, 그 AC를 이 목록에 추가하고 같은 방식으로 옮긴다.

---

## 수동 확인

- [x] ★ mockup-checker로 `/`·`/recipes`·`/brews`·`/recipes/12`·`/brews/2`를 `390px`/`1280px`에서 캡처해 목업과 대조한다.
  상단 바·탭 바·secondary·수치 표기의 격차가 「큼」 0건이어야 한다. 결과를 PR 본문에 첨부한다
  (2026-09-27 완료 — 범위 내 「큼」 0건. 「중간」 1건(표·비교표·스텝 수치가 Sans)은 AC-GRAMMAR-22로 반영)
- [ ] 실제 기기(iOS PWA)에서 탭 바가 홈 인디케이터와 겹치지 않는지(세이프에어리어) 본다

## 열어둔 결정

없음.
