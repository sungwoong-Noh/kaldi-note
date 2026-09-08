---
id: VISUAL
title: 시각 위계 정비 — 색 토큰과 글자 크기 단계
status: 구현완료
plan: docs/plans/2026-09-07-plan-visual-hierarchy.md
---

# 시각 위계 정비 스펙

> 2026-09-07 `/interview`로 확정. 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md).
> **모든 인수 조건은 자동화된 테스트로 옮길 수 있어야 한다.**

## 무엇을

**화면에 위계를 만든다.** 지금 글자 크기 지정 176곳 중 131곳(74%)이 `text-sm` 하나이고, 강조에 쓸
색이 **0곳**이다. 위계를 만들 수단이 굵기 하나뿐이다.

색을 **CSS 변수 토큰 8개**로 정의하고, 글자 크기를 **역할 5단계**로 잠근다. 그 둘을 프론트 31개
파일(테스트 제외) 전부에 입힌다. 허용목록 밖의 색·크기 클래스가 소스에 남아 있으면 테스트가 깨진다.

**백엔드를 건드리지 않는다.** API·스키마·HTTP 응답 변경이 0건이므로 **이 스펙에는 에러 인수 조건이
없다.**

### 범위 밖 (Non-goals)

- **간격·레이아웃 조정.** `2026-09-05-polish.md`가 「폰트가 바뀌면 인상이 달라지므로 그 뒤에
  판단한다」며 미룬 것 중, 이 스펙은 **색과 타이포만** 가져간다. 간격은 다음으로 넘긴다.
- **화면별 스켈레톤.** 공통 `LoadingState` 하나를 유지한다. `polish`가 미룬 그대로다.
- **SCA 구간에 색 부여.** `strengthZone`·`extractionZone`은 텍스트로 둔다. 색을 주면 의미색이
  4개가 되고, 「좋다/나쁘다」 판정을 색으로 단언하게 된다 — 「환산 결과는 언제나 추정치」와 같은
  이유로 신중해야 한다.
- **웹폰트 도입.** `polish`의 「부엌·느린 회선이 주 환경이라 0바이트가 실질 이득」 결정을 유지한다.
- **터치 타깃 44×44px 검사.** `docs/conventions/frontend.md:179`가 규약으로 정해놓고 아무도
  검사하지 않고 있으나, 이번 범위가 아니다. **별도 스펙으로 분리한다.**
- **백엔드 변경.** 0건.
- **아이콘·일러스트 추가.** 별 아이콘(`RatingInput`) 외에 새 그래픽을 만들지 않는다.

## 왜

**「무색무취하다」가 이 스펙의 출발점이다.** 실측한 상태는 이렇다.

| 관측 | 값 |
|---|---|
| 글자 크기 지정 176곳 중 `text-sm` | **131곳 (74%)** |
| `text-lg` | 2곳 |
| 브랜드 색 사용 | **0곳** |
| 주 액션 버튼 색 | `bg-neutral-900`(검정) 19곳 |
| 중립 단계 | **8단계로 흩어짐** (`neutral-50`부터 `900`까지) |
| `dark:` 클래스 | **98개**를 손으로 짝 맞춰 유지 |

화면의 글자 4분의 3이 같은 크기다. **무엇이 중요한지 화면이 말하지 않는다.** 이 앱은 숫자가
주인공인데(`20.0g → 300.0g`, `1:15.0`, `92°C`) 그 숫자가 라벨과 같은 크기로 놓여 있다.

그리고 **색 쌍을 손으로 관리하는 구조가 사고를 부른다.** `dark:` 클래스 98개는 한쪽만 고치면
다크모드가 깨지는데, 자동 테스트가 그것을 잡지 못한다.

**기존 앰버 3곳은 브랜드 브라운과 색상각 차이가 1~7°다.** 브라운을 강조색으로 들이면 「경고」와
「강조」가 작은 글씨에서 구분되지 않는다. 그래서 앰버를 없앤다.

## 용어

| 용어 | 정의 |
|---|---|
| 의미색 | 무엇을 뜻하는지가 정해진 색. 강조·조치 필요·보조 정보 셋 |
| 표면색 | 배경·테두리·면처럼 의미를 갖지 않는 색 |
| 토큰 | `globals.css`에 정의한 CSS 변수. 라이트·다크 값을 한 쌍으로 갖는다 |
| 대표 수치 | 목록 카드에서 18px semibold를 받는 **정확히 하나의** 값 |
| 허용목록 | 소스에 존재해도 되는 색·크기 클래스의 전체 집합. 밖의 것은 테스트가 잡는다 |

## 색 — 토큰 8개

`@theme inline`에 정의하고 `prefers-color-scheme`으로 값만 바꾼다. **본문에서 `dark:` 색 클래스를
쓰지 않는다.** 기존 `--background`·`--foreground`가 이미 그 패턴이므로 그것을 확장한다.

| 토큰 | 라이트 | 다크 | 용도 |
|---|---|---|---|
| `--color-brand` | `#6F4E37` | `#C9A98A` | 주 액션 버튼·링크·활성 탭 |
| `--color-on-accent` | `#ffffff` | `#171717` | brand·danger **위에 얹는 글자** |
| `--color-danger` | `#DC2626` | `#F87171` | 오류·삭제·조치가 필요한 경고 |
| `--color-muted` | `#737373` | `#A1A1A1` | 라벨·보조 정보 |
| `--color-line` | `#D4D4D4` | `#404040` | 테두리 |
| `--color-surface` | `#F5F5F5` | `#262626` | 칩·비활성 면 |
| `--background` (기존) | `#ffffff` | `#0a0a0a` | 배경 |
| `--foreground` (기존) | `#171717` | `#ededed` | 본문 |

**표면색의 hex는 현재 쓰이는 Tailwind 중립 단계와 같은 색이다.** Tailwind v4가 팔레트를 oklch로
정의하므로(`neutral-300` = `oklch(87% 0 none)`) sRGB로 환산해 박았다. `--color-muted`의 다크값
`#A1A1A1`은 **v4의 `neutral-400`이다** — v3의 `#A3A3A3`가 아니다.

**글자로 쓰이는 토큰은 전부 WCAG AA(4.5:1)를 넘긴다. 최저는 `--color-muted` 라이트값의 4.74:1이다.**

| 조합 | 대비 |
|---|---|
| brand / 배경 | 7.44:1 · 8.98:1 |
| brand + on-accent | 7.44:1 · 8.13:1 |
| danger / 배경 | 4.83:1 · 7.16:1 |
| danger + on-accent | 4.83:1 · 6.48:1 |
| **muted / 배경** | **4.74:1** · 7.66:1 |
| foreground / 배경 | 17.93:1 · 16.91:1 |

**카카오 로그인 버튼은 카카오 브랜드 색을 쓴다.** `bg-[#FEE500]`·`text-[#191600]`은 카카오
디자인 가이드가 정한 값이라 브랜드 브라운으로 바꿀 수 없다. 구글 버튼은 테두리만 있는 중립
버튼이라 `border-line`으로 옮긴다.

**다이얼로그 배경막 `bg-black/40`은 토큰으로 빼지 않는다.** 4곳(`BeanBatchDialog`·
`UserGrinderDialog`·`DeleteRecipeDialog`·`DeleteBrewLogDialog`)에서 쓰이는데, 라이트·다크가 같은
스크림이라 쌍이 필요 없다. 알파가 붙은 오버레이만 이 예외에 해당한다.

**표면색 둘(`--color-line`·`--color-surface`)은 대비 기준에서 제외한다.** 글자가 아니라 구분선과
면이기 때문이다. 실제 값은 `line` 1.48:1·1.91:1, `surface` 1.09:1·1.31:1이며, **지금 쓰이는
`neutral-300`·`neutral-100`과 같은 색이라 이번 변경으로 나빠지는 것은 없다.** 이 둘에 4.5를
요구하면 테두리가 본문만큼 진해져 위계가 다시 무너진다.

### 앰버 3곳의 처리

기존 `text-amber-600`은 **성격이 다른 둘이 한 색을 쓰고 있었다.** 성격별로 나눈다.

| 자리 | 문구 | 성격 | 새 색 |
|---|---|---|---|
| `RecipeStepEditor.tsx:206·211` | 「12.5g 부족합니다」·「초과합니다」 | 사용자가 고쳐야 함 | `danger` |
| `GrindSettingField.tsx:152` | 「이 그라인더는 환산 정보가 없습니다」 | 사용자가 조치할 수 없음 | `muted` |

`amber-600 #D97706`은 흰 배경 위 **3.19:1로 AA 미달**이기도 했다.

## 글자 크기 — 5단계

| 역할 | 크기 | 굵기 | 색 |
|---|---|---|---|
| 화면 제목 | 20px (`text-xl`) | semibold | foreground |
| **주요 수치** | 18px (`text-lg`) | semibold · tabular-nums | foreground |
| 카드 제목 | 16px (`text-base`) | medium | foreground |
| 본문 | 14px (`text-sm`) | normal | foreground |
| 라벨·보조 | 12px (`text-xs`) | normal | muted |

**색은 액션에만 쓴다.** 수치는 크기와 굵기로 올리고 브라운을 칠하지 않는다 — 목록에 카드가 쌓였을 때
갈색이 많아지면 주 액션 버튼이 묻힌다.

**`h1` 14곳을 전부 `text-xl semibold`로 통일한다.** 10곳은 이미 그 형태이고, **넷이 갈려 있다** —
`/login`(`text-2xl font-semibold`), `/login/test`·`/offline`·`UserProfile`(`text-2xl font-bold`).

**별 아이콘은 글자가 아니다.** `RatingInput.tsx:30`의 `text-xl`을 `text-[22px]`로 바꿔 크기
허용목록 검사에서 제외한다.

## 「주요 수치」가 무엇인가

| 자리 | 18px semibold를 받는 값 |
|---|---|
| 레시피 카드 | `도즈 → 물` (`20.0g → 300.0g`) |
| 로그 카드 | `brewRatio`. **없으면 `actualWaterTempC`로 승격** |
| 레시피 상세 | 도즈·물·비율·온도·시간 |
| 로그 상세 | 위와 같음 + TDS·수율 |

`RecipeSummary`의 `doseG`·`waterG`·`ratio`는 **셋 다 필수**라 레시피 카드의 대표 수치는 항상 있다.
`BrewLogSummary`는 프론트 스키마에서 `brewRatio`가 **옵션**이라, 타입상 대표 수치 자리가 빌 수
있다. 그래서 승격 규칙을 둔다.

**승격된 값은 보조줄에서 뺀다.** 같은 값을 두 번 그리지 않는다.

> ### ⚠ 승격 규칙은 방어 분기다 — 지금 백엔드로는 도달할 수 없다
>
> `brew_log.actual_dose_g`와 `actual_water_g`가 둘 다 `nullable = false`이고,
> `ExtractionAnalyzer.analyze`는 `brewRatio`를 그 둘로 **분기 없이** 계산한다. **실제 API
> 응답에서 `brewRatio`가 비는 경우는 없다.** 기존 픽스처 둘(`brewLogPage.content[0]`,
> `brewLogWithoutTds`)이 모두 `brewRatio: 15.0`을 갖고 있는 것이 그 방증이다.
>
> 그래도 분기를 둔다. **프론트 스키마가 `z.number().optional()`로 선언하는 한 TypeScript가
> 분기를 요구하고**, 지금 `BrewLogCard`도 이미 `log.brewRatio && ...`로 방어하고 있다. 분기를
> 두면서 그 안을 검사하지 않으면 대표 수치 자리가 조용히 비는 길이 열린다.
>
> **따라서 AC-VISUAL-10·11·12는 「백엔드가 만들 수 있는 상태」가 아니라 「프론트 스키마가
> 허용하는 상태」를 검사한다.** 픽스처는 실제 응답에서 `brewRatio`만 덜어내 만든다 — 지어내지
> 않는다(`docs/conventions/frontend.md`「픽스처는 실제 응답에서 뜬다」).
>
> 스키마를 `z.number()`로 조이면 이 분기와 AC 셋이 통째로 사라진다. **이 스펙의 범위(색·타이포)
> 밖이라 하지 않는다** — 「열어둔 결정」에 남긴다.

---

## 어떻게 동작 — 인수 조건

> **소스 검사와 컴포넌트 판정은 vitest, 실제 렌더값은 Playwright가 맡는다.** jsdom은 CSS를 로드하지
> 않아 `getComputedStyle`로 색과 크기를 확인할 수 없다. 이 분담은 `2026-09-05-polish.md`가 폰트에서
> 쓴 것과 같다.

### 정상 동작 — 소스 검사

#### AC-VISUAL-01 · 앰버 클래스가 하나도 없다

- **Given** `frontend/src` 아래의 모든 `.ts`·`.tsx` 파일
- **When** `amber`를 포함한 Tailwind 클래스를 찾는다
- **Then** **0곳**이다
- **검증** 단위 테스트 `designTokens.test.ts`

#### AC-VISUAL-02 · Tailwind 팔레트 색 클래스가 하나도 없다

- **Given** `frontend/src` 아래의 모든 `.ts`·`.tsx` 파일 (테스트 파일 포함)
- **When** `neutral-`·`red-`·`amber-`와 **불투명** `white`·`black`을 색으로 쓰는 클래스(`text-`·`bg-`·`border-`·`ring-` 접두)를 찾는다
- **Then** **0곳**이다. 색은 토큰 유틸리티(`bg-brand`·`text-on-accent`·`text-danger`·`text-muted`·`border-line`·`bg-surface`·`bg-background`·`text-foreground`)로만 표현된다
- **예외** 알파가 붙은 **배경** `bg-black/` (다이얼로그 배경막 4곳)만 허용한다. 양쪽 테마에서 같은 스크림이라 토큰으로 나눌 이유가 없다. **`border-black/10`처럼 테두리에 쓴 것은 예외가 아니다** — `border-line`으로 옮긴다
- **검증** 단위 테스트 `designTokens.test.ts`

#### AC-VISUAL-03 · dark: 색 클래스가 하나도 없다

- **Given** `frontend/src` 아래의 모든 `.ts`·`.tsx` 파일
- **When** `dark:`로 시작하면서 색을 지정하는 클래스를 찾는다
- **Then** **0곳**이다 (변경 전 98개)
- **검증** 단위 테스트 `designTokens.test.ts`

#### AC-VISUAL-04 · 임의값 색이 하나도 없다

- **Given** `frontend/src` 아래의 모든 `.ts`·`.tsx` 파일
- **When** `text-[#`·`bg-[#`·`border-[#` 패턴을 찾는다
- **Then** **0곳**이다
- **예외** 카카오 로그인 버튼의 `bg-[#FEE500]`·`text-[#191600]` **두 리터럴만** 면제한다. 카카오 디자인 가이드가 강제하는 브랜드 색이라 우리 토큰으로 칠할 수 없다. **파일이 아니라 그 두 값만 면제한다** — 파일째 빼면 로그인 화면에 아무 색이나 새로 들어온다
- **검증** 단위 테스트 `designTokens.test.ts`

#### AC-VISUAL-05 · 허용된 글자 크기 5개 밖이 없다

- **Given** `frontend/src` 아래의 모든 `.ts`·`.tsx` 파일
- **When** `text-` 뒤에 크기가 오는 클래스를 찾는다
- **Then** `text-xs`·`text-sm`·`text-base`·`text-lg`·`text-xl` **다섯 개만** 나온다. 예외는 `RatingInput.tsx`의 `text-[22px]` **한 곳**이다
- **검증** 단위 테스트 `designTokens.test.ts`

#### AC-VISUAL-06 · 토큰 8개가 라이트·다크 값을 모두 갖는다

- **Given** `frontend/src/app/globals.css`
- **When** 토큰 정의를 읽는다
- **Then** `--color-brand`·`--color-on-accent`·`--color-danger`·`--color-muted`·`--color-line`·`--color-surface`·`--background`·`--foreground` **8개**가 `:root`와 `@media (prefers-color-scheme: dark)` 양쪽에 정의돼 있다
- **검증** 단위 테스트 `designTokens.test.ts`

#### AC-VISUAL-07 · 모든 토큰 조합의 대비가 4.5:1 이상이다

- **Given** `globals.css`에서 읽어낸 8개 토큰의 라이트·다크 hex 값
- **When** WCAG 상대 휘도로 **글자로 쓰이는 조합만** 대비를 계산한다 — `brand`·`danger`·`muted`·`foreground`는 각 `background` 위에서, `on-accent`는 `brand`와 `danger` 위에서. **`line`과 `surface`는 글자가 아니므로 계산 대상이 아니다**
- **Then** 라이트 6 + 다크 6 = **12개 조합이 전부 4.5 이상**이다(**4.5를 포함한다**). 최저값은 `--color-muted` 라이트의 **4.74**다
- **검증** 단위 테스트 `contrast.test.ts`. **값은 표에서 베끼지 않고 `globals.css`를 파싱해 읽는다** — 베끼면 토큰을 고쳐도 테스트가 옛 값을 검사한다

### 정상 동작 — 컴포넌트

#### AC-VISUAL-08 · 레시피 카드의 대표 수치는 도즈와 물이다

- **Given** `doseG: 20`, `waterG: 300`, `ratio: 15`인 `RecipeSummary`
- **When** `RecipeCard`를 렌더한다
- **Then** `20.0g → 300.0g`를 담은 요소가 `text-lg`와 `font-semibold`를 갖는다
- **검증** 단위 테스트 `RecipeCard.test.tsx`

#### AC-VISUAL-09 · 로그 카드는 브루 비율을 대표 수치로 쓴다

- **Given** `brewRatio: 15`, `actualWaterTempC: 92`인 `BrewLogSummary`
- **When** `BrewLogCard`를 렌더한다
- **Then** `1:15.0`을 담은 요소가 `text-lg`와 `font-semibold`를 갖는다
- **검증** 단위 테스트 `BrewLogCard.test.tsx`

#### AC-VISUAL-10 · 비율이 없으면 물 온도가 승격된다

- **Given** 실제 응답 `brewLogPage.content[0]`에서 `brewRatio`만 덜어낸 `BrewLogSummary` (`actualWaterTempC: 92`). **프론트 스키마가 허용하는 상태이며, 지금 백엔드로는 도달할 수 없다**
- **When** `BrewLogCard`를 렌더한다
- **Then** `92°C`를 담은 요소가 `text-lg`와 `font-semibold`를 갖는다
- **검증** 단위 테스트 `BrewLogCard.test.tsx`

#### AC-VISUAL-11 · 승격된 값은 보조줄에 다시 나오지 않는다

- **Given** AC-VISUAL-10과 같은 `BrewLogSummary` (`brewRatio`만 덜어낸 것)
- **When** `BrewLogCard`를 렌더한다
- **Then** `92°C`가 화면 전체에 **정확히 1번** 나타난다
- **검증** 단위 테스트 `BrewLogCard.test.tsx`

#### AC-VISUAL-12 · 대표 수치는 언제나 정확히 하나다

- **Given** `brewLogPage.content[0]`(비율 있음)과 거기서 `brewRatio`만 덜어낸 것(비율 없음) **두 가지**
- **When** 각각 `BrewLogCard`를 렌더한다
- **Then** 두 경우 모두 `text-lg font-semibold`를 가진 요소가 **정확히 1개**다
- **검증** 단위 테스트 `BrewLogCard.test.tsx`

#### AC-VISUAL-13 · 화면 제목 14곳이 같은 단계를 쓴다

- **Given** `frontend/src` 아래에서 `<h1`을 그리는 곳 **14곳**
- **When** 각 `<h1`의 `className`을 읽는다
- **Then** 14곳 모두 `text-xl`과 `font-semibold`를 갖는다. `text-2xl`·`font-bold`는 **0곳**이다
- **검증** 단위 테스트 `headings.test.ts` (소스 검사). **실제로 20px로 렌더되는지는 `AC-VISUAL-15`가 브라우저에서 잰다** — 클래스가 맞아도 화면이 다를 수 있으므로 둘 다 필요하다

### 정상 동작 — 실제 렌더값 (Playwright)

> 뷰포트 **360 × 800**, 대상 서버는 `next start`, 허용 오차 **0**(색·크기는 정확히 일치해야 한다).
> API는 `2026-09-02-web-e2e-layout.md`와 같은 방식으로 전부 가로챈다.

#### AC-VISUAL-14 · 주 액션 버튼이 브랜드 색으로 칠해진다

- **Given** `/recipes/new`를 라이트 모드로 연다
- **When** 주 액션 버튼의 `background-color`를 읽는다
- **Then** `rgb(111, 78, 55)`이다
- **검증** e2e `visual.spec.ts`

#### AC-VISUAL-15 · 화면 제목이 20px로 렌더된다

- **Given** `/recipes`를 연다
- **When** `h1`의 `font-size`를 읽는다
- **Then** `20px`다
- **검증** e2e `visual.spec.ts`

#### AC-VISUAL-16 · 대표 수치가 18px로 렌더된다

- **Given** `/recipes`를 연다 (픽스처 레시피 1건)
- **When** 카드 대표 수치의 `font-size`를 읽는다
- **Then** `18px`다
- **검증** e2e `visual.spec.ts`

#### AC-VISUAL-17 · 라벨이 보조색으로 렌더된다

- **Given** `/recipes`를 라이트 모드로 연다
- **When** 카드 보조줄의 `color`를 읽는다
- **Then** `rgb(115, 115, 115)`이다
- **검증** e2e `visual.spec.ts`

#### AC-VISUAL-18 · 다크 모드에서 토큰 쌍이 바뀐다

- **Given** `colorScheme: "dark"`로 `/recipes/new`를 연다
- **When** 주 액션 버튼의 `background-color`와 `color`를 읽는다
- **Then** `background-color`가 `rgb(201, 169, 138)`이고 `color`가 `rgb(23, 23, 23)`이다
- **검증** e2e `visual.spec.ts`

### 경계값

WCAG 판정 외에 범위 경계가 없다. **AC-VISUAL-07의 `4.5`는 포함이다** — 정확히 `4.5:1`인 조합은
`4.49`로 반올림되지 않는 한 통과다. 현재 최저는 `4.74`라 여유가 있다.

### 에러

**없다.** 이 스펙은 백엔드를 건드리지 않으므로 HTTP 상태와 `code`를 정의하지 않는다.

---

## 수동 확인

> **3개가 남아 있고 전부 비차단형이다**(2026-09-08 `구현완료`로 올림). 폰 실물과 실제 조명이
> 있어야 판단할 수 있는 것들이라 `status`를 막지 않는다(`docs/conventions/verification.md`).
>
> 자동 검사가 덮은 것은 소스 잠금 5개·토큰 정의 1개·대비 12쌍·컴포넌트 5개·브라우저 실측 5개다.

- [ ] 폰에서 목록을 훑을 때 대표 수치가 실제로 먼저 읽히는지 본다
- [ ] 다크모드에서 브라운(`#C9A98A`)이 탁하거나 누렇게 보이지 않는지 본다
- [ ] 부엌 조명(따뜻한 색온도) 아래에서 브라운과 배경이 충분히 구분되는지 본다

## 열어둔 결정

- **간격·레이아웃 조정.** 이번에 색과 타이포만 바꾼다. 인상이 달라진 뒤에 간격을 판단한다 —
  `polish`가 폰트에 대해 쓴 것과 같은 이유다.
- **터치 타깃 44×44px 검사.** `docs/conventions/frontend.md:179`가 규약으로 정해뒀으나 검사가
  없다. `2026-09-02-web-e2e-layout.md`도 「이번 분량에 넣지 않는다」고 미뤘다. **별도 스펙으로
  분리한다.**
- **SCA 구간에 색을 줄지.** 의미색이 4개가 되고 「좋다/나쁘다」를 색으로 단언하게 된다. 추출 분석
  화면을 손볼 때 다시 본다.
- **`brewRatio` 스키마를 필수로 조일지.** 백엔드가 `nullable = false`인 두 컬럼으로 분기 없이
  계산하므로 실제로는 절대 비지 않는다. 조이면 승격 분기와 AC 셋이 사라지지만, 이 스펙의
  범위(색·타이포) 밖이라 하지 않는다. 브루잉 로그 계약을 손볼 때 다시 본다.
- **브랜드 색의 농도 변형.** 지금은 `brand` 하나뿐이라 hover·pressed 상태를 따로 두지 않는다.
  필요해지면 그때 `--color-brand-strong`을 더한다.
