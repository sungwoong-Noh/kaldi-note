# Handoff: kaldi-note — 브랜드 시스템 & 앱 화면

## 읽는 순서

이 폴더에는 문서가 4개 있습니다. **위에서 아래로** 읽으세요.

| # | 문서 | 내용 |
|---|---|---|
| 1 | **README.md** (이 문서) | 제품 원칙, 디자인 토큰, 컴포넌트, 보이스, 전역 내비게이션 |
| 2 | **DECISIONS.md** | 열려 있던 결정 4건의 확정값 — 다른 문서와 어긋나면 **이 문서가 우선** |
| 3 | **RECIPES-AND-BREWS.md** | 레시피/잔 구조 개편 — README의 M2–M5 · W2 절을 **대체** |
| 4 | **HOME-CALENDAR.md** | 달력 홈(모바일 + 웹) — README의 M1 · W1 절을 **대체** |

README의 대체된 절에는 `(구)` 표시가 붙어 있습니다. 구현은 2·3·4 문서를 따르고, README는 **토큰과 컴포넌트 사전**으로 쓰세요.

## Overview

kaldi-note는 핸드드립 커피의 **추출 변수를 기록하고 가까운 사람과 공유하는** 앱입니다. 이 번들은 브랜드 방향(Clean Ledger / Editorial), 디자인 시스템(색·타입·간격·컴포넌트·보이스), 그리고 모바일·웹 화면의 하이파이 목업을 담고 있습니다.

핵심 제품 원칙 3가지 — 구현 시 판단 기준으로 쓰세요:

1. **기록이 1순위**, 친구 공유는 그 결과를 내보내는 두 번째 층.
2. **화면마다 대표 수치 하나**를 36px 모노스페이스로 크게 둡니다(원두량 · 수율 · 별점 · 환산값 중 하나).
3. 앱은 커피가 맛있었는지 **판단하지 않습니다.** 사실과 수치만 돌려주고, 제안은 관찰형 문장으로("지난 세 번 모두 92°C였습니다").

## About the Design Files

이 번들의 `*.dc.html` 파일은 **HTML로 만든 디자인 레퍼런스**입니다 — 의도한 룩앤필과 동작을 보여주는 프로토타입이며, 그대로 가져다 쓸 프로덕션 코드가 아닙니다. 할 일은 이 디자인을 **대상 코드베이스의 기존 환경(React/Next, Vue, SwiftUI, native 등)과 확립된 패턴·라이브러리로 재현**하는 것입니다. 아직 환경이 없다면 프로젝트에 가장 적합한 프레임워크를 골라 구현하세요.

파일을 브라우저로 직접 열어 볼 수 있습니다. 가로로 여러 화면이 나열된 캔버스 문서이므로 스크롤·축소해서 전체를 보세요.

## Fidelity

**High-fidelity (hifi).** 색·타입·간격·카피가 모두 최종 값입니다. 아래 Design Tokens와 각 화면 명세의 수치를 그대로 쓰세요. 단, 프레임(390×844, 1440×900)은 디자인 캔버스 크기일 뿐이고 실제 구현은 **반응형**이어야 합니다 — 모바일은 세로 스크롤, 웹은 좌측 원장 컬럼 + 우측 420px 사이드 컬럼이 1100px 이하에서 한 컬럼으로 접히게 하세요.

## Design Tokens

색은 모두 **oklch**로 정의되어 있습니다. 중립색은 아주 옅은 따뜻한 기미(hue 60–85, chroma ≤ 0.015)만 갖고, 유채색은 에스프레소 계열 하나뿐입니다. **그라디언트와 그림자는 쓰지 않습니다** — 층은 1px 보더와 surface 명도 차이로만 만듭니다.

### Color — Light

| Token | oklch | 용도 |
|---|---|---|
| `paper` | `oklch(0.99 0.004 85)` | 기본 배경, 카드 |
| `surface` | `oklch(0.97 0.006 85)` | 한 단 들어간 면, 인용 블록 |
| `sunken` | `oklch(0.93 0.008 80)` | 세그먼티드 트랙, 프로그레스 트랙 |
| `border` | `oklch(0.88 0.008 75)` | 컨테이너 보더 |
| `divider` | `oklch(0.92 0.008 78)` | 원장 행 구분선 |
| `divider-strong` | `oklch(0.89 0.008 78)` | 리스트 시작/끝 선 |
| `ink` | `oklch(0.22 0.015 60)` | 제목, 값, primary 버튼 배경 |
| `ink-2` | `oklch(0.38 0.015 60)` | 본문 |
| `ink-3` | `oklch(0.55 0.02 70)` | 보조 텍스트, 라벨 |
| `accent` | `oklch(0.42 0.06 45)` | 강조, 링크, 차이 문구, 저장 액션 텍스트 |
| `accent-soft` | `oklch(0.62 0.05 50)` | 로고 가운뎃점, 상태 도트 |
| `accent-wash` | `oklch(0.95 0.02 50)` | CURATED 배지 배경, 비율 강조 칩 |

### Color — Dark

| Token | oklch |
|---|---|
| `paper` | `oklch(0.17 0.008 60)` (타이머 화면은 `oklch(0.19 0.012 60)`) |
| `surface` | `oklch(0.21 0.009 60)` |
| `raised` | `oklch(0.23 0.014 60)` (활성 행) |
| `border` | `oklch(0.29 0.01 60)` |
| `divider` | `oklch(0.26 0.012 60)` |
| `ink` | `oklch(0.95 0.005 85)` |
| `ink-2` | `oklch(0.82 0.008 78)` |
| `ink-3` | `oklch(0.68 0.01 70)` |
| `accent` | `oklch(0.72 0.07 55)` / 히어로 위 텍스트 `oklch(0.85 0.06 60)` |

### 히어로 카드 (다크 블록, 라이트 화면 안에서도 사용)

배경 `oklch(0.22 0.015 60)`, radius 14px, padding 20–26px. 안쪽:
- 아이브로우: mono 9.5px / letter-spacing 0.16em / uppercase / `oklch(0.72 0.05 55)`
- 대표 수치: mono 36–44px / weight 500 / letter-spacing −0.04em / line-height 1 / `oklch(0.97 0.004 85)`
- 구분선: 1px `oklch(0.34 0.015 60)`, 위 padding 13–16px
- 서브 메트릭 라벨: mono 9px / 0.1em / uppercase / `oklch(0.65 0.015 70)`, 값 mono 14–15px `oklch(0.96 0.005 85)`
- 인용 문구: 13.5–17px / line-height 1.65 / italic / `oklch(0.82 0.01 78)`

### Typography

폰트: **IBM Plex Sans KR** (서술) + **IBM Plex Mono** (계측되는 모든 값). 숫자가 늘 같은 폭이라 기록끼리 비교가 쉬워지는 것이 이 선택의 이유입니다 — 수치를 Sans로 쓰지 마세요.

| Role | Font / Size / Weight / LS |
|---|---|
| display | Sans 36–44 / 600 / −2.5% / lh 1.15 |
| page title (mobile) | Sans 27 / 600 / −3% / lh 1.1 |
| title | Sans 22–24 / 600 / −2.5% / lh 1.25 |
| card title | Sans 18 / 600 / −1.5% |
| subtitle | Sans 17 / 500 / lh 1.5 |
| body | Sans 15 / 400 / lh 1.7 |
| body-sm | Sans 13–13.5 / 400 / lh 1.6 |
| caption | Sans 11.5–12.5 / 400 / `ink-3` |
| **metric-hero** | **Mono 36 / 500 / −4% / lh 1** |
| metric-xl (타이머) | Mono 76–84 / 500 / −5% / lh 1 |
| metric | Mono 14–16 / 500 |
| label | Mono 9–11 / 500 / +10~16% / uppercase / `ink-3` |

최소 크기: 모바일 본문 13px 이상, 히트 타깃 44px 이상(버튼 padding 15px + font 15px = 48px).

### Spacing · Shape

- 간격 스케일 4pt: **4 · 8 · 12 · 16 · 24 · 32 · 48**
- 화면 좌우 거터: 모바일 24px, 웹 48px
- radius: **3** (태그·배지) · **7–8** (버튼·입력) · **10–14** (카드·히어로) · **999** (아바타·토글·프로그레스)
- 원장 행: 세로 padding 14px + 상단 1px divider. 리스트의 마지막 행에만 하단 보더 추가.
- 그림자 없음. `box-shadow`는 입력 포커스 링에만: `0 0 0 3px oklch(0.42 0.06 45 / 0.12)`

## Components

### Button
- **Primary**: bg `ink`, text `oklch(0.97 0.004 85)`, radius 7–8, padding 15px(모바일 풀폭) / 11px 18px(웹). hover `oklch(0.15 0.015 60)`
- **Secondary**: bg `surface`, 1px `border`, text `ink`. hover bg `sunken`
- **Ghost**: text `accent`. hover bg `accent-wash`
- **Disabled**: bg `sunken`, text `oklch(0.65 0.015 65)`
- 다크 화면 위 primary는 반전: bg `oklch(0.93 0.01 80)`, text `oklch(0.2 0.015 60)`

### Input
1px `border` / radius 7 / padding 12–13px 14px / font 14.5–15px. 단위는 오른쪽 정렬 `ink-3` mono 11px. 숫자 입력은 mono 15px. 포커스: border `accent` + 포커스 링(위 참조). 스테퍼 버튼은 34×34 / 1px border / radius 7.

### Metric row (기록의 기본 단위)
2열 그리드(gap 12/16) 또는 라벨-값 원장 행. 라벨 mono 9–10px uppercase `ink-3`, 값 mono 14–16px weight 500 `ink`.

### Tag / Badge
mono 11.5px / padding 5px 9px / radius 3. 기본 bg `sunken` + text `oklch(0.35 0.015 60)`. 강조(예: 드리퍼, CURATED) bg `accent-wash` + text `oklch(0.4 0.06 45)`. CURATED는 mono 9px / +12% / uppercase.

### Segmented control
트랙 bg `sunken` / radius 8 / padding 3 / gap 3. 활성 탭 bg `paper` + 1px `oklch(0.87 0.008 75)` + radius 6 + weight 500. 각 탭 세로 padding 9px.

### Avatar
radius 999. 36px(헤더) / 48px(더보기) / 60px(프로필). 이니셜 텍스트 weight 600. 배경은 톤만 다른 warm 뉴트럴 3종: `oklch(0.88 0.02 60)`, `oklch(0.88 0.008 80)`, `oklch(0.88 0.015 70)`. **사진 없이도 성립해야 합니다.**

### Taste scale (2가지 표현)
- **바** — 트랙 6px `sunken` radius 3, 채움 `accent`. 5점 척도를 20%씩.
- **도트** — 8–9px 원 5개 gap 3. 채운 것 `accent`(다크 위에서는 `oklch(0.85 0.06 60)`), 빈 것 `oklch(0.91 0.008 78)`.

### Observation / warning block
`surface` 배경 + 왼쪽 2px `accent` 보더 + radius `0 8px 8px 0`. 라벨 mono 9.5px uppercase `oklch(0.45 0.05 48)`, 본문 13.5px lh 1.65. **서버가 준 경고·관계 문구는 가공하지 않고 그대로 렌더**합니다. 범위 밖 경고는 1px `oklch(0.86 0.02 60)` 보더 + bg `oklch(0.97 0.012 70)`.

### Roast dot
9–11px 원. 로스팅 강도를 명도로 표현: light `oklch(0.72 0.05 60)` → medium `oklch(0.62 0.06 55)` / `oklch(0.55 0.07 55)` → medium-dark `oklch(0.5 0.07 50)` → dark `oklch(0.4 0.05 45)`. 채도·색상은 고정하고 **명도만** 바꿉니다.

### Skeleton
`oklch(0.93~0.96 0.008 80)` 블록, radius 3. 카드 구조와 같은 높이(제목 17px, 대표 수치 34px, 캡션 13px)로 배치.

## Voice (카피 규칙)

담백한 존댓말. 감탄사·이모지 없음. 평가하지 않기.

| 이렇게 | 이렇게 말고 |
|---|---|
| “오늘 기록을 저장했습니다.” | “기록 저장 완료! 잘하셨어요 ☕” |
| “아직 기록이 없습니다. 첫 잔부터 남겨보세요.” | “텅 비었네요! 어서 커피를 내려주세요~” |
| “지난 세 번 모두 92°C였습니다.” | “온도를 낮춰보세요!” |

## Brand / Logo

워드마크 `kaldi·note` — 소문자 고정, 가운뎃점은 항상 `accent-soft`. Sans 600 / letter-spacing −3%. 심볼은 드리퍼 위에서 본 물의 중심: 2px 링 원 + 중앙 점(원 지름의 약 1/3). 최소 높이 20px, 심볼 주위 여백은 심볼 지름의 50%.

금지: 그라디언트 · 그림자 · 기울임 · 대문자 KALDI · 사진 위 직접 배치(반드시 단색 판 위에).

## Screens / Views

프레임 상단의 `9:41 ▮▮▮` 상태바는 **목업 장식**입니다 — 구현하지 마세요. 각 화면 하단의 120×4 바도 iOS 홈 인디케이터 표현입니다.

### 전역 내비게이션

모바일은 **하단 탭 4개 + 화면별 CTA**입니다.

- 탭: **홈 · 레시피 · 기록 · 더보기** (텍스트 라벨만, 아이콘·배지 없음)
- 탭 바: 높이 58px + 하단 세이프에어리어, 상단 1px `divider-strong`, 배경 `paper`. 각 탭 히트 영역 44px 이상
- 활성: 13px weight 600 `ink` + 18×2px 밑줄(`ink`, radius 2, 위 margin 7px). 비활성: 13px weight 400 `ink-3`
- 다크: 배경 `paper(dark)`, 활성 `oklch(0.95 0.005 85)`, 비활성 `oklch(0.68 0.01 70)`
- **탭이 있는 화면**: 홈 · 레시피 목록 · 기록 목록 · 더보기. **없는 화면**: 상세 · 작성/편집 · 타이머 · 로그인 · 오프라인(뒤로/닫기만)
- 활성 탭 재탭 → 목록 맨 위로. 탭 전환 시 각 탭의 스크롤 위치는 유지
- CTA(「이 레시피로 내렸다」·「새 레시피」)는 탭 바 **위**에 붙는 화면별 액션입니다. **탭 바에 + 버튼을 넣지 마세요** — 기록은 항상 레시피를 고른 뒤 시작됩니다
- 프로필 `/u/[id]`과 분쇄도 환산기는 탭이 아니라 더보기·피드에서 진입합니다

웹은 상단 바(로고 + 홈·레시피·기록 3링크 + primary CTA 1개 + 아바타), 하단 탭 없음.

### M1 · 홈 `/` — 달력

> **이 섹션은 `HOME-CALENDAR.md`로 대체되었습니다.** 홈은 달력 + 팔로우 레일 + 날짜별 목록 구조입니다. 구현 전에 그 문서를 먼저 읽으세요. 아래는 이전(최근 기록 리스트) 버전으로, 히어로 카드·원장 행 패턴의 레퍼런스로만 참고하세요.

#### (구) 홈 — 최근 기록
- 목적: 오늘 내린 커피를 확인하고, 바로 다음 기록을 시작한다.
- 레이아웃: 헤더(로고 + 아바타) → "최근 기록" 21px + 전체 보기 링크 → 히어로 카드 → 원장 행 3개 → 하단 고정 primary CTA "이 레시피로 내렸다".
- 히어로: 아이브로우 `Today · 08:20`, 레시피명 19px 2줄, roast dot 30px, 대표 수치 = **수율 36px** + "수율 · ★ 4", 구분선 아래 한 줄 감상(italic).
- 원장 행: 좌측 레시피명 14.5px + 날짜·별점 캡션, 우측 비율 mono 14px.
- 빈 상태: 점선 보더 카드 — "아직 기록이 없습니다." + secondary "레시피 보러 가기".

> **아래 M2–M5 · W2 는 `RECIPES-AND-BREWS.md`로 대체되었습니다.** 용어(「기록」→「잔」), 포크→「내 서랍에 담기」, 내 서랍/둘러보기 분리, 검색·필터, 카드 항목(원두량·Hot/Ice·추천 배전도)이 모두 바뀌었습니다. 구현은 그 문서를 따르고, 아래는 이전 버전 기록으로만 참고하세요.

#### (구) M2 · 레시피 목록 `/recipes`
- 헤더 "레시피" 27px + 아바타 → 「내 레시피만」 토글(46×27) → RecipeCard 세로 스택 → "더 보기" 텍스트 링크 → 하단 CTA "새 레시피".
- **RecipeCard**: 1px border / radius 12 / padding 17px 18px / gap 12. 제목 18px 600, CURATED 배지 우상단, **대표 수치 = 비율 mono 36px**, 하단 mono 14px `ink-3` 한 줄 `15g → 250g · 92°C · 3:30`.
- 빈 상태: "레시피가 없습니다." + 설명 + primary "새 레시피".

#### (구) M3 · 레시피 상세 `/recipes/[id]`
- 뒤로 / CURATED 배지 → 제목 24px + 작성자·기구 캡션 → 히어로(대표 = 비율 36px, 하단 4개 dl: 원두량 / 물량 / 물 온도 / 총 시간) → 분쇄도 원장 행(그라인더 + 값 + 단위 "클릭"/"눈금") → Steps 리스트 → 액션 2개.
- **스텝 행**: 번호 mono 12px(14px 폭) · 타입 배지(블룸·푸어·대기·스월·스터·배출) · 물량 mono 13.5px(flex) · 소요 초 mono 12px. 메모 있으면 물량 아래 12px 캡션.
- 남의 레시피: roast dot + "포크한 뒤 기록할 수 있습니다." 안내, 액션은 `포크` + `이 레시피로 내리기`. 내 레시피면 `편집` · `삭제` · `포크`.

> **(구) M4는 `docs/design/screens-v3/RecipeEdit.dc.html`로 대체되었습니다.**

#### (구) M4 · 레시피 작성/편집 `/recipes/new`, `/[id]/edit`
- 상단 바: 취소 / `NEW RECIPE` / 저장(accent 텍스트).
- 히어로(편집 가능): 비율 36px가 원두량·물량 입력에 따라 **실시간 재계산**. 입력 2개는 히어로 안쪽 `oklch(0.28 0.015 60)` 칩.
- 원장 입력 행: 제목 · 온도/시간 · 기구(드리퍼+필터) · 분쇄도.
- 공개 범위: 3분할 `PRIVATE` / `FRIENDS` / `PUBLIC`, mono 11px, 활성만 채움.
- **스텝 에디터**: 행 = 번호 · 타입 드롭다운 · 물량 · 초 · 삭제(×). 헤더 우측에 **물량 합계 `합계 250 / 250 g`**(총 물량과 불일치면 accent로 경고). 맨 아래 점선 "+ 스텝 추가".

#### (구) M5 · 기록 목록 `/brews`
- 헤더 "기록" 27px → BrewLogCard 스택 → "더 보기" → 하단 CTA "이 레시피로 내렸다".
- **BrewLogCard**: 레시피명 16px 600 + 날짜 우측 mono 11px / **대표 수치 = 수율 36px + "% 수율"**, TDS 없으면 `★ 4`를 대표로 / 하단 mono 13.5px 요약 `16g → 250g · 92°C · 2:45 · ★ 4` (TDS 없으면 `· TDS 없음`).
- 빈 상태: "아직 기록이 없습니다." + "레시피를 골라 내리면 첫 기록이 만들어집니다."

### M6 · 기록 상세 `/brews/[id]`
- 뒤로 / 수정 → 날짜 mono 라벨 + 제목 22px → 히어로(대표 = **수율 36px**, 하단 dl: TDS / 음료 중량 / SCA 존). TDS가 없으면 수율 대신 "TDS가 없으면 수율을 계산할 수 없습니다." 문구.
- **비교표(레시피/실제)**: 헤더 행(bg `oklch(0.96 0.006 82)`) + 항목/레시피/실제 3열. 차이가 있는 항목은 행 아래 **차이 문구를 accent 11.5px 우측 정렬로 반드시 표시** ("원두를 1.0 g 더 썼습니다.", "45초 빨리 끝났습니다."). 차이 없으면 문구 생략(웹은 별도 「차이」 열에 "같습니다.").
- 이어서 원장 행: 원두(로스터·제품·로스팅일·중량) / 분쇄도 / 평가(★ + 5축 한 줄) → 메모 italic.
- 액션: `다시 내리기` + `친구에게 공유`.

### M7 · 푸어 타이머 (전체 다크)
- 닫기 / `BREWING`(accent) → 레시피명 + `V60 · 1:15.6 · 92°C` → **경과 시간 mono 84px** + `3RD POUR` → 누적 물량 24px + "목표 250 g" + 10px 프로그레스 → 스텝 원장(완료·현재·예정). 현재 행은 `raised` 배경 + radius 8로 강조, 예정 행은 `oklch(0.58 0.01 65)`로 흐리게 → 하단 `일시정지` + `다음 푸어`.
- 동작: 1초 tick, 다음 푸어 누르면 현재 스텝 확정 후 다음 행 활성. 종료 시 M6 작성 플로우로 실측값을 넘깁니다.

### M8 · 분쇄도 환산기 `/gear/grind-converter`
> 그라인더 선택 목록은 screens-v3 `Gear.dc.html`의 내 그라인더를 씁니다. `convertible=false` 모델은 제외.

- 제목 25px → 히어로(대표 = **대상 설정값 36px** + 단위, 하단에 대상 그라인더명) → 원장 행: 원본 그라인더 / 설정값(+스테퍼) / 대상 그라인더 → **서버 경고 블록** + **범위 밖 블록**(둘 다 서버 문구 그대로) → CTA "이 값으로 기록하기".

> **M9는 `docs/design/screens-v3/Profile.dc.html`로 대체되었습니다.**

#### (구) M9 · 프로필 `/u/[id]`
- 아바타 60px + 닉네임 22px + `기록 42 · 레시피 7` mono → 팔로우/팔로우 취소 primary 풀폭 → **관계 문구 3종** 중 현재 상태 하나만 렌더(목업에는 3종을 다 보여주고 있음): 맞팔로우(accent 보더) / 나를 팔로우(중간 톤) / 아직 아님(연한 톤) → 공개된 기록 원장 리스트.

> **M10은 `docs/design/screens-v3/More.dc.html`로 대체되었습니다.** 신규 `Gear.dc.html`(내 기구 관리)도 함께 보세요.

#### (구) M10 · 더보기 `/more`
- 제목 "더보기" 27px → 아바타 48px + 닉네임·이메일 → 원장 dl: 닉네임 / 가입일 / 내 링크(+복사 버튼) → 복사 토스트 → 메뉴 행 3개(분쇄도 환산기 / 내 기구 관리 / 다크 모드 토글) → 로그아웃 텍스트 링크.

### M11 · 로그인 `/login` (전체 다크)
- 중앙 정렬: 심볼 30px + 워드마크 30px → "오늘 내린 커피의 변수를 남기고, 가까운 사람과 나눕니다." 16.5px → 하단 버튼 3개: 카카오(`oklch(0.9 0.14 100)` / text `oklch(0.25 0.03 80)`) · 구글(흰 배경) · `TEST LOGIN`(1px 보더) → 약관 캡션 12px.

### M12 · 오프라인 `/offline`
- "연결 없음" 27px + 설명 → 대기 배너(1px border, accent-soft 도트, "저장 대기 중인 기록 1건") → 캐시된 레시피 원장 리스트 → secondary "다시 시도".

### 부가 상태 (목업 R0 프레임)
- **로딩**: 카드 스켈레톤 2개.
- **성공 토스트**: bg `ink` / radius 9 / 13.5px + 우측 "보기" 액션(accent 계열 `oklch(0.8 0.05 60)`).
- **에러 토스트**: bg `surface` + 1px border + `ink` 텍스트 — "저장하지 못했습니다. 다시 시도해 주세요."

### W1 · 웹 홈 (1440×900)

> **이 섹션은 `HOME-CALENDAR.md`의 「웹」 절로 대체되었습니다.** 웹 홈도 달력입니다. 아래는 이전(최근 기록 리스트) 버전으로, 원장 행의 웹 컬럼 배분 레퍼런스로만 참고하세요.

#### (구) 웹 홈 — 최근 기록
상단 바 → 좌측 컬럼(flex:1, padding 44px 48px, 우측 1px divider): "최근 기록" 30px + 전체 보기 / 원장 행(도트 · 제목+원두·기구·시각 · 요약 mono 150px · **수율 16px 86px** · 별점 44px, 모두 우측 정렬) / 빈 상태 카드 → 우측 컬럼(420px, bg `surface`): 오늘의 한 잔 히어로(수율 44px) + 주간 요약 2칸(잔 / 평균 비율) + Observation 블록.

#### (구) W2 · 웹 레시피 목록
상단 바(CTA "새 레시피") → 헤더 + 「내 레시피만」 토글 → **3열 그리드 `repeat(3, minmax(0,1fr))` gap 20**, RecipeCard padding 24 / gap 16 / 비율 36px 유지 → 마지막 셀에 빈 상태 카드 → "더 보기".

### W3 · 웹 기록 상세
상단 바(`수정` secondary + `친구에게 공유` primary) → 좌측: 날짜 라벨 + 제목 32px + 원두 캡션 / **비교표 4열**(항목 · 레시피 110px · 실제 110px · **차이 230px**) / 푸어 스텝 4칸 카드 → 우측 420px: 수율 히어로 44px + 평가 카드(★ 22px + 5축 바) + 메모 카드(italic 14px).

## Interactions & Behavior

- **비율 자동 계산**: 원두량·물량 입력 시 `물량 / 원두량`을 소수 첫째 자리로 표시(`1:15.6`). 히어로 수치가 즉시 갱신됩니다.
- **수율**: `TDS(%) × 음료 중량(g) / 원두량(g)`. TDS가 없으면 계산하지 않고 안내 문구를 노출합니다(0이나 `-`로 채우지 마세요). SCA 존은 서버 판정값(`under` / `ideal` / `over`)을 그대로 씁니다.
- **비교표**: 레시피 값과 실측값의 차이를 서버 또는 클라이언트에서 계산해 **자연어 문구**로 렌더합니다. 숫자만 덜렁 보여주지 않는 것이 이 화면의 요점입니다.
- **스텝 합계 검증**: 스텝 물량 합계 ≠ 총 물량이면 합계 텍스트를 accent로 바꿔 경고하되, 저장은 막지 않습니다(실제 추출은 어긋날 수 있음).
- **타이머**: 1초 tick, 현재 스텝 하이라이트, 「다음 푸어」로 진행. 백그라운드 복귀 시 경과 시간은 시작 타임스탬프 기준으로 재계산하세요.
- **토글·탭**: 상태 전환만, 애니메이션은 150–200ms ease 정도로 최소한.
- **공개 범위**: `PRIVATE`(나만) / `FRIENDS`(맞팔로우한 사람) / `PUBLIC`. 프로필의 관계 문구는 이 규칙의 결과를 설명하는 문장이므로 서버 판정을 그대로 노출합니다.
- **포크**: 남의 레시피는 편집 불가 — 포크해 내 레시피로 복제한 뒤 기록합니다.
- **오프라인**: 캐시된 레시피는 열람 가능, 새 기록은 큐에 저장하고 온라인 복귀 시 자동 전송. 대기 건수를 배너로 표시합니다.
- **다크 모드**: 필요 기능입니다. 위 Dark 토큰으로 전체 대응하고, 타이머·로그인은 라이트 모드에서도 다크로 고정합니다.

## State Management

화면별 최소 상태:

- 레시피 폼: `title, description, dose, water, temp, totalTime, dripper, filter, visibility, grinder, grindValue, steps[{type, water, seconds, note}]` + 파생값 `ratio`, `stepWaterSum`
- 기록 폼: `recipeId, brewedAt, dose, water, temp, brewTime, drawdownTime, grinder, grindValue, beverageWeight, tds, rating, taste{acidity,sweetness,body,bitterness,finish}, memo, bean{roaster, product, roastedOn, weight}` + 파생값 `yield`, `strength`, `scaZone`, `diffs[]`
- 타이머: `startedAt, elapsed, currentStepIndex, pouredWeight, paused`
- 목록: 커서 기반 페이지네이션(`더 보기`), `onlyMine` 필터, 낙관적 업데이트 후 실패 시 에러 토스트
- 프로필: `relation`(4상태) + 팔로우 낙관적 토글

## Assets

`assets/` 폴더에 로고·아이콘 SVG가 들어 있습니다. 미리보기와 사용 규칙은 `Kaldi Note Assets.dc.html`을 열어 보세요.

| 파일 | 용도 |
|---|---|
| `logo-symbol.svg` | 심볼 — `currentColor` 상속판(UI에서 이걸 쓰세요) |
| `logo-symbol-ink.svg` / `-paper.svg` | 색 고정판(라이트 / 다크 배경용) |
| `logo-lockup-ink.svg` / `-paper.svg` | 심볼 + 워드마크 가로 락업 |
| `app-icon.svg` / `-accent.svg` | 앱 아이콘 1024, radius 225 |
| `favicon.svg` | 32 기준 — 작은 크기용으로 stroke를 2.6으로 두께게 조정한 별도 버전 |
| `roast-dots.svg` | 로스팅 단계 색 참고 시트(구현은 CSS로) |

주의사항:
- **워드마크는 `<text>`로 조판돼 있습니다.** 배포용은 반드시 벡터 편집기에서 아웃라인(패스 변환) 후 사용. 앱 내부에서는 SVG 락업 대신 **심볼 + HTML 텍스트** 조합을 권합니다.
- 파비콘을 앱 아이콘 축소로 대체하지 마세요 — 16px에서 링이 사라집니다.
- SVG 내부 색은 oklch 미지원 툴(스토어 업로드 등)을 고려해 hex로 하드코딩돼 있습니다: `ink #302c28` / `paper #f7f4f0` / `accent #a06a4f`. **UI 코드에서는 항상 oklch 토큰을 쓰세요.**

그 외 그래픽은 없습니다 — 모두 CSS 도형(원, 사각형, 바)으로 만들어졌습니다.

폰트는 Google Fonts:
```html
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```
프로덕션에서는 self-host를 권합니다. 한국어 글리프가 무거우니 서브셋을 고려하세요.

## 구현 순서 권장

한 번에 전체를 만들지 말고 이 순서로 나눠 진행하세요.

1. **디자인 토큰** — 색(라이트/다크) · 타입 스케일 · 간격 · radius
2. **공통 컴포넌트** — 버튼 4종 · 입력 · 스테퍼 · 배지/태그 · roast dot · 원장 행 · 세그먼티드 · 아바타 · Observation 블록 · 히어로 카드
3. **셸** — 하단 탭 4개(모바일) / 상단 바(웹) + 라우팅
4. **홈 달력** — `HOME-CALENDAR.md`
5. **레시피 둘러보기 / 내 서랍** — `RECIPES-AND-BREWS.md` RW1 · RW2 · RM1 · RM2 · RM3
6. **레시피 상세 → 담기 → 편집** — RW3 · RM4 · RM5
7. **내 잔 목록 → 상세** — BW1 · BM1 + README M6
8. **푸어 타이머** — README M7
9. **나머지** — 분쇄도 환산기 · 프로필 · 더보기 · 로그인 · 오프라인

각 단계에서 해당 문서의 절 이름(`RW1`, `M7` 등)을 짚어 주면 정확도가 올라갑니다.

## Files

| 파일 | 내용 |
|---|---|
| `DECISIONS.md` | 확정된 결정 4건 — 충돌 시 우선 |
| `RECIPES-AND-BREWS.md` | 레시피/잔 구조 개편 (README M2–M5 · W2 대체) |
| `HOME-CALENDAR.md` | 달력 홈 규격 (README M1 · W1 대체) |
| `Kaldi Note Design System.dc.html` | 로고 락업·금지사항, 라이트/다크 색 토큰, 타입 스케일, 간격·radius, 컴포넌트, 보이스 가이드 |
| `Kaldi Note Screens - Mobile.dc.html` | 모바일 11화면 + 빈 상태·로딩·토스트 (390×844) |
| `Kaldi Note Screens - Web.dc.html` | 웹 3화면 — 홈 · 레시피 목록 · 기록 상세 (1440×900) |
| `Kaldi Note Mockups v2.dc.html` | 초기 핵심 흐름 5화면(홈 → 작성 → 타이머 → 상세 → 친구 피드). **푸어 타이머와 친구 피드는 이 파일에만 있습니다** |
| `Kaldi Note Home - Calendar.dc.html` | **현행 홈** — 달력 2상태(내 기록 / 팔로우 선택) + 규격 패널 |
| `Kaldi Note Home - Calendar Web.dc.html` | **현행 웹 홈** — 달력 2상태 + 웹에서 달라지는 점 |
| `Kaldi Note Recipes vs Brews - Web.dc.html` | **현행 웹 레시피/잔** — 결정 패널 4개 + 4화면 |
| `Kaldi Note Recipes vs Brews - Mobile.dc.html` | **현행 모바일 레시피/잔** — 6화면 |
| `Kaldi Note Navigation.dc.html` | 하단 탭 바 규격(라이트/다크) + 적용 예 2화면, CTA와의 관계 규칙 |
| `Kaldi Note Assets.dc.html` | 로고·아이콘 에셋 미리보기 + 사용 규칙 + hex 대응표 |
| `assets/` | SVG 원본 9개 |

### Screenshots

`screenshots/` 폴더에 각 디자인 파일의 전체 캡처가 있습니다. HTML 파일을 브라우저로 여는 것이 가장 정확하지만, 빠르게 확인할 때 쓰세요.

| 파일 | 내용 |
|---|---|
| `screenshots/screens-mobile.png` | 모바일 11화면 + 부가 상태 |
| `screenshots/screens-web.png` | 웹 3화면 |
| `screenshots/recipes-brews-web.png` | 레시피/잔 개편 — 결정 패널 + 웹 4화면 |
| `screenshots/recipes-brews-mobile.png` | 레시피/잔 개편 — 모바일 6화면 |
| `screenshots/design-system.png` | 디자인 시스템 문서 |
| `screenshots/navigation.png` | 탭 바 규격 + 적용 예 |
| `screenshots/home-calendar.png` | 달력 홈 2상태 + 규격 |
| `screenshots/home-calendar-web.png` | 웹 달력 홈 2상태 |
| `screenshots/core-flow-v2.png` | 핵심 흐름 5화면(타이머·친구 피드 포함) |

미구현(디자인 미완): 기록 작성 화면 `/brews/new`와 원두 선택 다이얼로그. 기록 작성은 M4 레시피 작성 폼의 원장 입력 패턴 + M6의 평가 5축 컴포넌트를 조합해 만드세요.
