---
id: DS2
title: 디자인 시스템 교체 — Clean Ledger
status: 구현완료
plan: docs/plans/2026-09-17-plan-design-system-v2.md
---

# 디자인 시스템 교체 — Clean Ledger 스펙

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.
> **모든 인수 조건은 자동화된 테스트로 옮길 수 있어야 한다.**

## 무엇을

**`globals.css`의 토큰 체계를 hex 8개에서 oklch 15개로 갈아끼우고, 웹폰트 두 벌을 들인다.**
그리고 지금 문자열로 복붙돼 있는 버튼·입력·카드 스타일을 `src/components/ui`의 컴포넌트로 모은다.

채택한 디자인은 `docs/design/design_handoff_kaldi_note/README.md`다. **그 파일이 값의 원천이고
이 스펙은 그것을 검증 가능한 형태로 옮긴 것이다.** 값이 어긋나면 핸드오프가 옳다.

화면을 새로 그리는 일은 하지 않는다. **이 스펙이 끝나면 화면은 거의 그대로 보이되,
색과 글자가 새 토큰에서 나오고 버튼을 한 곳에서 고칠 수 있게 된다.**

### 범위 밖 (Non-goals)

- **화면 리스킨.** M1~M12의 레이아웃을 새 디자인으로 바꾸는 것은 다음 스펙(`screen-reskin`)이다.
  이 스펙은 **토큰과 프리미티브까지**다. 기존 화면은 새 토큰으로 칠해지기만 한다.
- **신규 화면.** 랜딩·오늘의 레시피·장비 카탈로그·관리자 화면은 각자의 스펙에서 만든다.
- **신규 기능.** 푸어 타이머·친구 피드·다크 모드 토글·기구 관리는 이 스펙에 없다.
- **데스크톱 반응형.** 브레이크포인트 도입은 `web-desktop` 스펙이다. 이 스펙은
  **프리미티브가 반응형을 받을 수 있는 형태인지까지만** 본다.
- **기존 시각 스펙의 폐기.** 아래 「기존 AC 갱신」대로 **값만 고쳐 쓰고 AC ID는 유지한다.**
  `check-spec-coverage.sh`가 `구현완료` 스펙의 AC를 테스트에서 찾으므로, ID를 지우면 CI가 깨진다.

## 왜

**지금 버튼 하나를 고치려면 수십 곳을 동시에 고쳐야 한다.**

```
8곳  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-line px-3 py-2 text-base"
7곳  "min-w-0 appearance-none select-chevron pr-12 w-full rounded-md border border-line px-2 py-1 min-h-11"
6곳  "mx-auto w-full max-w-2xl px-4 py-6"
```

`src/components/ui`가 없어서 스타일이 문자열로 흩어져 있다. 그래서 디자인 변경 요청이 와도
**안전하게 만질 수 있는 범위만 건드리고 끝나고, 결과는 항상 미세 조정이다.**
이 상태로 화면 11개를 리스킨하면 같은 값을 수십 곳에 반복해 넣게 되고, 그다음 신규 화면 7개에서
또 반복한다. **프리미티브를 먼저 세우지 않으면 이후 모든 화면 작업이 두 배가 된다.**

그리고 `docs/design/2026-09-16-product-direction.md`의 결정 15가 디자인 채택을 확정했다.
토큰을 바꾸지 않은 채 신규 화면을 만들면 그 화면들을 두 번 만든다.

## 용어

| 용어 | 정의 |
|---|---|
| 핸드오프 | `docs/design/design_handoff_kaldi_note/`. `README.md`가 값의 원천 |
| 프리미티브 | `src/components/ui`의 컴포넌트. 스타일을 소유하는 유일한 곳 |
| 수치(metric) | 계측된 값 — 비율·수율·중량·온도·시간·별점. **Mono로 쓴다** |
| 서술 | 제목·본문·라벨 등 계측되지 않는 글자. **Sans로 쓴다** |
| 대표 수치 | 화면마다 정확히 하나인 36px 수치. `data-lead`가 표시한다 |

## 데이터

스키마 변경 없음. `frontend/src/app/globals.css`만 바뀐다.

### 색 토큰 15개

**값은 핸드오프 README의 Design Tokens 표에서 가져온다.** 아래는 이름과 역할의 목록이다 —
**리터럴 oklch 값을 이 스펙에 옮겨 적지 않는다.** 옮겨 적는 순간 두 곳이 되고 한쪽만 고쳐진다
(`docs/design/2026-09-08-brand.md`가 같은 이유로 hex를 옮겨 적지 말라고 적어뒀다).

| 토큰 | 역할 | 기존 토큰 |
|---|---|---|
| `paper` | 기본 배경, 카드 | `background` |
| `surface` | 한 단 들어간 면 | `surface` |
| `sunken` | 세그먼티드 트랙, 프로그레스 트랙 | — |
| `raised` | 활성 행. **라이트에서는 `paper`와 같은 값** | — |
| `border` | 컨테이너 보더 | `line` |
| `divider` | 원장 행 구분선 | — |
| `divider-strong` | 리스트 시작/끝 선 | — |
| `ink` | 제목·값·primary 버튼 배경 | `foreground` |
| `ink-2` | 본문 | — |
| `ink-3` | 보조 텍스트·라벨 | `muted` |
| `on-ink` | `ink` 배경 위 글자 | `on-accent` |
| `accent` | 강조·링크·차이 문구 | `brand` |
| `accent-soft` | 로고 가운뎃점·상태 도트 | — |
| `accent-wash` | CURATED 배지 배경 | — |
| **`danger`** | **오류. 핸드오프에 없어 새로 정한다** | `danger` |

#### `danger`를 되살리는 이유

**핸드오프에 오류 색이 없다.** 에러 토스트조차 `ink`다. 그러나 현재 `text-danger`가 24곳,
`bg-danger`·`border-danger`가 각 2곳 쓰이고, `docs/specs/2026-09-15-readability.md`가 이렇게 못박았다:

> `danger`가 `muted`보다 흐리면 **「고쳐야 할 것」이 「안 읽어도 되는 것」보다 안 보인다.**

**폼 검증 에러를 `ink-3`로 칠하면 그 결론이 뒤집힌다.** 2026-09-17에 값을 계산으로 확정했다.

| 모드 | 값 | `paper` 대비 | `ink-3` 대비 | 참고: 기존 hex |
|---|---|---|---|---|
| 라이트 | `oklch(0.50 0.18 28)` | **6.40:1** | 4.73 (+1.67) | `#b91c1c` = 6.47:1 |
| 다크 | `oklch(0.72 0.15 28)` | **7.24:1** | 6.63 (+0.61) | `#f87171` = 6.92:1 |

**기존 오류색과 거의 같은 색이 나왔다** — 인상이 바뀌지 않는다.
`accent`(hue 45 · C 0.06)와는 **chroma 2~3배, hue 17~27도** 차이로 구분된다.

### 타입 스케일

**핸드오프 파일에 실제로 쓰인 글자 크기는 34개였다**(8.5px~44px, 0.5px 단위 포함).
그대로 허용하면 `AC-DS2-12`가 아무것도 막지 못한다. 인접값을 역할별로 묶는다.

**이번에 도입하는 것은 6단계다** — 서술 4 + 수치 2.

| 이름 | 폰트 | px | 지금 쓰는 자리 | 디자인이 쓴 값 |
|---|---|---|---|---|
| `page-title` | Sans | **27** | `h1` 화면 제목 (17곳) | 25 · 26 · 27 · 28 |
| `card-title` | Sans | **18** | `h2` · 카드 제목 (19곳) | 17 · 18 · 19 |
| `body` | Sans | **15** | 본문 (130곳) | 15 · 15.5 |
| `body-sm` | Sans | **13** | 보조·라벨 (23곳) | 13 · 13.5 |
| `metric-hero` | **Mono** | **36** | 대표 수치 `data-lead` (10곳) | 36 |
| `metric` | **Mono** | **14** | 카드 메타줄·`dd` 수치 | 14 · 14.5 · 15 · 16 |

**★ 지금 화면이 쓰는 것만 둔다.** 핸드오프의 `display`(36 서술) · `title`(24) ·
`caption`(12) · `label`(10 Mono)은 이 앱의 현재 화면에 자리가 없다. 웹 전용 크기
(W1의 수율 44px·제목 32px)와 타이머의 76–84px도 마찬가지다.
**미리 넣지 않는다** — 쓰이지 않는 단계는 `AC-DS2-13`에 죽은 단계로 걸린다.
각 스펙(`screen-reskin`·`web-desktop`·`pour-timer`)이 실제로 쓸 때 추가한다.

### 수치는 글꼴까지 묶는다

`metric-hero`·`metric`은 Tailwind의 `@utility`로 정의해 **`font-family`를 포함**한다.
`text-metric`과 `font-mono`를 따로 붙이게 두면 한쪽을 빠뜨린 화면이 생기고,
**자릿수가 어긋나면 목록에서 값이 흔들린다** — 그것이 Mono를 쓰는 유일한 이유다.

### 서체

| 역할 | 폰트 | 한글 |
|---|---|---|
| 서술 | IBM Plex Sans KR | **필요** |
| 수치 | IBM Plex Mono | **불필요 — 서브셋에서 제외한다** |

**self-host한다.** Google Fonts 링크는 쓰지 않는다 — 렌더 블로킹과 서드파티 의존이 늘고,
`web-seo` 스펙이 다룰 LCP에 직접 영향을 준다.

#### 실측 (2026-09-17, `@fontsource` 5.3.0)

| 파일 | 크기 |
|---|---|
| `ibm-plex-sans-kr-korean-400-normal.woff2` (통짜) | **505.5 KB** |
| 한글 조각 서브셋 94개 | 각 **~15 KB** |
| `ibm-plex-sans-kr-latin-*` | 14.8 ~ 16.2 KB |
| `ibm-plex-mono-latin-*` | 14.4 KB |

**`korean` 통짜 서브셋을 받으면 안 된다.** 조각 방식이면 브라우저가 페이지에 실제로 쓰인
글자가 있는 조각만 받는다 — 한국어 화면은 보통 5개 안팎이라 웨이트당 ~75 KB다.

**쓸 웨이트를 제한한다.** 핸드오프는 `300;400;500;600;700`을 링크했지만 타입 스케일이
실제로 요구하는 것은 셋뿐이다.

| 폰트 | 웨이트 | 근거 |
|---|---|---|
| Sans KR | **400 · 600** | body·body-sm·caption 400 · 제목류(display~card-title) 600 |
| Mono | **400 · 500** | metric·label 500, 일부 400 |

기존은 **0 바이트**였다. 웨이트 하나가 늘 때마다 한글 조각 전체가 한 벌 더 붙는다.

> **갱신(2026-09-17): Sans 500을 뺐다.** 처음에는 핸드오프의 `subtitle 17/500`을 보고 셋을
> 넣으려 했으나, **확정한 타입 스케일 10단계에 Sans 500을 쓰는 단계가 없다** — 17px이
> `card-title`(18px/600)로 흡수됐기 때문이다. 실측으로 웨이트당 크기를 재보고 결정했다.
>
> | 웨이트 | 조각 | 크기 |
> |---|---|---|
> | Sans 400 | 94개 | 1,292 KB |
> | Sans 500 | 94개 | 1,356 KB ← **뺀다** |
> | Sans 600 | 94개 | 1,356 KB |
> | Mono latin 400+500 | 4개 | 32 KB |
>
> 쓰지 않는 굵기 하나가 **1.36 MB**다.

## 기존 AC 갱신

**AC ID를 유지하고 값만 바꾼다.** `AC-VISUAL-05`가 2026-09-15에 같은 방식으로 갱신된 선례다.

| AC | 현재 | 갱신 후 |
|---|---|---|
| `AC-VISUAL-06` · `AC-READ-04` | 토큰 **8개** | 토큰 **15개** |
| `AC-VISUAL-07` · `AC-READ-06` | hex 대비 AA | **oklch** 대비 AA |
| `AC-VISUAL-05` | 크기 5개 `36/24/18/16/14` | **Sans 8단계 + Mono 5단계** |
| `AC-READ-01` | `muted` = `#545454`, 7.57:1 | `ink-3` = 핸드오프 값 |
| `AC-READ-02` | `line` = `#b8b8b8` | `border` = 핸드오프 값 |
| `AC-READ-03` | `danger` = `#b91c1c`, 6.47:1 | `danger` = 새로 정한 값 |
| `AC-READ-05` | 다크 **8개** | 다크 **15개** |
| `AC-SPACE-01` · `02` | 6단계 `1·2·3·4·6·12` | **7단계** (`8`=32px 추가) |
| `AC-SPACE-04` · `05` · `06` | 면 `rounded-lg`, 컨트롤 `rounded-md` | **4종** (아래 `AC-DS2-16`) |
| `AC-SPACE-08` | `shadow` 클래스 **0곳** | **포커스 링만 예외** |

### 파서를 함께 고친다

`src/test/tokens.ts`의 `hexes()`는 `--name: #rrggbb;`만 긁는다. **oklch를 읽지 못한다.**
`src/test/contrast.ts`도 hex 기반이다. **두 파일을 oklch로 옮기지 않으면 갱신된 AC가 전부 거짓 통과한다.**

## 인수 조건

### 색 토큰

#### AC-DS2-01 · 색 토큰 15개가 라이트·다크 값을 모두 갖는다

> **2026-09-19 정정:** `docs/specs/2026-09-19-home-calendar.md`가 달력의 기록 점 전용 토큰
> `signal-record`를 하나 더한다 — **16개**가 된다. 이 스펙이 정한 "토큰은 새로 늘리지 않는다"는
> 원칙과 별개로, 그 스펙은 "이 시스템에 유채색이 에스프레소 한 색뿐"이라는 원래 전제에 신호색
> 하나를 예외로 추가하는 것을 명시적으로 인터뷰로 확정했다.

- **Given** `frontend/src/app/globals.css`
- **When** `:root`와 `@media (prefers-color-scheme: dark)` 블록의 색 토큰 이름을 모은다
- **Then** 양쪽 모두 같은 개수(현재 **16개**)이고 이름이 같다

#### AC-DS2-02 · 모든 색 토큰이 oklch로 정의된다

- **Given** 위와 같음
- **When** 각 색 토큰의 값을 읽는다
- **Then** 전부 `oklch(` 로 시작한다. **hex(`#rrggbb`)가 하나도 없다**

#### AC-DS2-03 · `danger`가 `ink-3`보다 대비가 높다

- **Given** 라이트·다크 각 팔레트
- **When** `danger`와 `ink-3`의 `paper` 대비 배경 대비를 각각 계산한다
- **Then** 두 모드 모두 `danger`의 대비가 `ink-3`보다 **크다**

> 「고쳐야 할 것」이 「안 읽어도 되는 것」보다 잘 보여야 한다. 절대값이 아니라 **둘의 순서**를 고정한다.

#### AC-DS2-04 · 글자 토큰이 배경 위에서 4.5:1 이상이다

- **Given** 라이트·다크 각 팔레트
- **When** `ink`·`ink-2`·`ink-3`·`accent`·`danger`의 `paper` 위 대비를 계산한다
- **Then** 전부 **4.5 이상**이다
- **And** `on-ink`가 `ink` 위에서 **4.5 이상**이다

#### AC-DS2-05 · oklch 대비 계산기가 경계값을 바르게 판정한다

- **Given** 대비 계산 함수
- **When** 검증된 oklch 쌍 하나로 계산한다
- **Then** 4.50을 통과로, 4.49를 미달로 준다

> `AC-READ-16`과 같은 이유다. **계산기 자신을 검사하지 않으면 나머지 대비 AC가 전부 거짓 통과한다.**

### 서체

#### AC-DS2-06 · Sans와 Mono가 self-host `@font-face`로 정의된다

- **Given** `globals.css`
- **When** `@font-face` 선언을 읽는다
- **Then** `IBM Plex Sans KR`과 `IBM Plex Mono`가 각각 존재한다
- **And** `src`가 `fonts.googleapis.com`·`fonts.gstatic.com`을 가리키지 않는다

#### AC-DS2-07 · 모든 `@font-face`에 `font-display: swap`이 있다

- **Given** `globals.css`의 `@font-face` 선언 전부
- **When** 각 선언의 `font-display`를 읽는다
- **Then** 전부 `swap`이다

> 한글 글리프는 무겁다. `swap`이 없으면 폰트가 도착할 때까지 글자가 보이지 않는다.

#### AC-DS2-08 · Mono에 한글 `unicode-range`가 없다

- **Given** `IBM Plex Mono`의 `@font-face` 선언
- **When** `unicode-range`를 읽는다
- **Then** 한글 음절 영역(`U+AC00-D7A3`)을 포함하지 않는다

> 수치만 쓰는 폰트에 한글을 실으면 받을 이유가 없는 바이트를 받는다.

#### AC-DS2-09 · `--font-sans`에서 `system-ui`가 첫 자리가 아니다

- **Given** `globals.css`의 `--font-sans`
- **When** 폰트 스택을 읽는다
- **Then** 첫 항목이 `"IBM Plex Sans KR"`이다
- **And** 스택의 마지막에 `sans-serif`가 남아 있다

#### AC-DS2-10 · 단일 폰트 파일이 100KB를 넘지 않는다

- **Given** 앱이 실제로 서빙하는 `.woff2` 파일 전부
- **When** 각 파일의 바이트 크기를 읽는다
- **Then** 전부 **102,400 바이트 미만**이다

> `korean` 통짜 서브셋 하나가 505KB다. **실수로 그것을 링크하면 이 AC가 잡는다.**

#### AC-DS2-11 · 웨이트가 정해진 것 밖에 없다

- **Given** `globals.css`의 `@font-face` 선언 전부
- **When** `font-family`와 `font-weight` 쌍을 모은다
- **Then** Sans KR은 **400·600**, Mono는 **400·500**뿐이다

> 웨이트 하나가 늘면 한글 조각 전체가 한 벌 더 붙는다. 쓰지 않는 굵기를 실어 나르지 않는다.

### 타이포그래피

#### AC-DS2-12 · 글자 크기가 정해진 단계 밖을 쓰지 않는다

- **Given** `frontend/src` 아래의 모든 `.ts`·`.tsx` (이 검사 파일 자신은 제외)
- **When** `text-` 뒤에 크기가 오는 Tailwind 클래스를 모은다
- **Then** `page-title` · `card-title` · `body` · `body-sm` · `metric-hero` · `metric`
  밖이 하나도 없다
- **And** 임의값(`text-[...px]`)이 **별 아이콘 1곳**을 빼고 없다

#### AC-DS2-13 · 각 단계가 쓰인다

- **Given** 위와 같음
- **When** 실제로 쓰인 크기 이름을 모은다
- **Then** 6개 전부가 **1곳 이상** 쓰인다

> `AC-SPACE-02`와 같은 이유다. **쓰이지 않는 단계는 체계가 아니라 장식이다.**

#### AC-DS2-14 · 대표 수치가 Mono다

- **Given** `data-lead`를 가진 요소를 렌더한 결과
- **When** 계산된 `font-family`를 읽는다
- **Then** `IBM Plex Mono`가 첫 자리다

#### AC-DS2-15 · 수치 요소에 Sans가 강제되지 않는다

- **Given** `frontend/src` 아래의 모든 `.tsx`
- **When** `data-lead`·`data-metric`을 가진 요소의 클래스를 읽는다
- **Then** `font-sans`가 없다

### 간격·모서리

#### AC-DS2-16 · 모서리가 4종 밖을 쓰지 않는다

- **Given** `frontend/src` 아래의 모든 `.tsx`
- **When** `rounded` 계열 클래스를 모은다
- **Then** **태그(3px) · 컨트롤(7–8px) · 면(10–14px) · 원형** 4종에 대응하는 클래스 밖이 없다

#### AC-DS2-17 · `shadow`가 포커스 링 외에 없다

- **Given** `frontend/src` 아래의 모든 `.ts`·`.tsx`와 `globals.css`
- **When** `shadow` 클래스와 `box-shadow` 선언을 모은다
- **Then** 포커스 링 하나를 제외하고 **0곳**이다

### UI 프리미티브

#### AC-DS2-18 · `src/components/ui`에 프리미티브 6종이 있다

- **Given** `frontend/src/components/ui`
- **When** 내보내는 컴포넌트를 읽는다
- **Then** `Button`·`Input`·`Select`·`Card`·`Badge`·`MetricRow`가 전부 존재한다

#### AC-DS2-19 · `Button`이 변형 4종을 가진다

- **Given** `Button` 컴포넌트
- **When** `variant`에 `primary`·`secondary`·`ghost`를 주고, `disabled`를 준다
- **Then** 네 경우의 클래스가 서로 다르다

#### AC-DS2-20 · 프리미티브 밖에서 컨트롤 스타일을 직접 쓰지 않는다

- **Given** `frontend/src` 아래의 `.tsx` 중 `src/components/ui`가 아닌 것
- **When** `<button`·`<input`·`<select` 엘리먼트에 붙은 `className`을 모은다
- **Then** `rounded`·`border-`·`px-`·`py-`를 함께 가진 문자열이 **0곳**이다

> 지금 이 문자열이 8곳·7곳에 복붙돼 있다. **이 AC가 그 상태로 돌아가는 것을 막는다.**

#### AC-DS2-21 · 프리미티브가 터치 타깃 44px을 보장한다

- **Given** `Button`·`Input`·`Select`를 기본값으로 렌더한 결과
- **When** 계산된 높이를 읽는다
- **Then** 전부 **44px 이상**이다

> `docs/specs/2026-09-09-touch-targets.md`의 규칙을 프리미티브가 떠안는다.
> 개별 화면이 `min-h-11`을 기억할 필요가 없어진다.

### 폼 검증 에러

#### AC-DS2-22 · 오류 상태 입력의 보더가 `danger`다

- **Given** `Input`·`Select`에 `error` 메시지를 준다
- **When** 계산된 테두리 색을 읽는다
- **Then** `--danger` 토큰 값이다

> **지금은 입력칸이 그대로고 문구만 아래에 뜬다.** 그래서 무엇이 틀렸는지 눈으로 찾게 된다.

#### AC-DS2-23 · 오류 상태 입력에 `aria-invalid="true"`가 붙는다

- **Given** 위와 같음
- **When** 렌더된 엘리먼트의 속성을 읽는다
- **Then** `aria-invalid`가 `"true"`다
- **And** `aria-describedby`가 오류 문구 요소의 `id`를 가리킨다

> 색만 바꾸면 스크린리더 사용자와 색각 이상 사용자에게는 아무 변화가 없다.

#### AC-DS2-24 · 오류가 없으면 `aria-invalid`가 붙지 않는다

- **Given** `Input`에 `error`를 주지 않는다
- **When** 렌더된 엘리먼트의 속성을 읽는다
- **Then** `aria-invalid` 속성이 **없다**(`"false"`가 아니라 부재)

### 회귀

#### AC-DS2-25 · 기존 `data-*` 훅이 남아 있다

- **Given** `frontend/src` 전체
- **When** `data-lead`·`data-compare`·`data-diff`·`data-empty`를 센다
- **Then** 각각 **1곳 이상** 존재한다

> 테스트가 이 훅으로 화면을 잡는다. 리스킨 중 지우면 AC 여러 개가 조용히 깨진다.

#### AC-DS2-26 · 팔레트 색 클래스와 임의값 색이 없다

- **Given** `frontend/src` 아래의 모든 `.ts`·`.tsx`
- **When** `text-`·`bg-`·`border-`·`ring-` 뒤에 Tailwind 팔레트 이름이나 `[#`가 오는 것을 찾는다
- **Then** 카카오 브랜드 색 2개를 제외하고 **0곳**이다

> `AC-VISUAL-01`~`04`가 지키던 것을 새 체계에서도 유지한다.

## 열어둔 결정

**2026-09-17에 셋 다 닫혔다.**

| 결정 | 결과 |
|---|---|
| `danger`의 oklch 값 | 계산으로 확정 — 위 「`danger`를 되살리는 이유」 |
| 타입 스케일 | 34개 → **10단계**로 통합 — 위 「타입 스케일 10단계」 |
| 폼 에러의 시각 형태 | **입력 보더 + `aria-invalid` + 문구** — `AC-DS2-22`~`24` |

남은 것은 구현 단계의 판단이다.

- **`danger-wash`가 필요한지.** 오류 블록에 배경이 필요해지면 그때 추가한다. 지금은 `danger` 하나로 간다.
- **Tailwind 4 `@theme`에서 타입 스케일을 어떻게 선언할지.** `--text-<이름>` 형태가 유력하나
  `text-metric` 같은 클래스가 실제로 생성되는지 확인하고 정한다.
