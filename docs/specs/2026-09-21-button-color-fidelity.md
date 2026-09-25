---
id: BTN
title: 버튼 색 정합 — primary를 ink로 되돌린다
status: 구현완료
plan: docs/archive/plans/2026-09-21-plan-button-color-fidelity.md
---

# 버튼 색 정합 스펙

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.
> **모든 인수 조건은 자동화된 테스트로 옮길 수 있어야 한다.**

## 무엇을

`Button`과 `ButtonLink`의 네 가지 모습(primary·secondary·ghost·disabled)을 목업이 정한 색으로
되돌린다. primary 버튼 배경을 `accent`에서 `ink`로 바꾸고, secondary에 `surface` 배경을,
disabled에 `sunken` 배경을 준다. 네 모습 모두에 hover 색을 정의한다.

목업에만 있고 토큰에 없던 색 두 개(`--ink-hover`·`--ink-disabled`)를 팔레트에 더해 라이트·다크
양쪽 값을 잠근다. 검증은 클래스 이름이 아니라 **브라우저가 실제로 칠한 색을 재서** 토큰 값과
대조한다.

### 범위 밖 (Non-goals)

- **히어로+원장 패턴 적용은 하지 않는다.** 이 스펙은 버튼 프리미티브만 다룬다. 분쇄도 환산기와
  작성 폼에 `Hero`를 씌우는 일은 각 화면 스펙이 맡는다.
- **`Button`/`ButtonLink` 밖의 버튼류는 건드리지 않는다.** 삭제 다이얼로그의 `bg-danger` 버튼,
  `RecipeStepEditor`의 ± 버튼, `ThemeToggle`, 레시피 목록의 체크박스가 여기 해당한다.
  이들의 `disabled:opacity-40` / `disabled:opacity-50`은 **그대로 둔다.**
- **`focus-visible`과 `active`(눌림) 상태는 정의하지 않는다.** 목업에 값이 없다. 값이 생기면
  별도 스펙으로 연다.
- **버튼의 크기·간격·모서리·글자 크기는 바꾸지 않는다.** 색만 건드린다. `min-h-11`·`px-3 py-2`·
  `rounded-control`·`text-body`는 현행 유지다.

## 왜

지금 화면의 주 액션 버튼은 에스프레소색(`accent`)으로 칠해져 있다. 목업과 `design-system-v2`
스펙은 둘 다 **먹색(`ink`)**을 지정한다(`docs/specs/2026-09-17-design-system-v2.md` 82행,
"`ink` | 제목·값·primary 버튼 배경"). 즉 이건 뒤집힌 결정이 아니라 **구현이 스펙을 벗어난
것**이다. 커밋 `0a97f62`가 `bg-accent`를 넣었고, 계획 문서는 색을 지정하지 않았으며,
`AC-DS2-19`는 "네 변형의 클래스 문자열이 서로 다르다"만 보기 때문에 이 어긋남을 잡지 못했다.

결과로 화면에서 두 가지가 무너진다. 첫째, `accent`는 이 시스템의 유일한 유채색이라 "여기를
봐라"는 신호인데, 모든 화면의 저장 버튼이 그 색을 먹어버려 신호가 희석된다. 둘째, 링크형
버튼(`ButtonLink`)과 버튼(`Button`)이 같은 VARIANT 테이블을 각자 복붙해 갖고 있어, 한쪽만
고치면 같은 화면에서 두 색이 섞인다.

hover를 함께 정의하는 이유는 지금 앱 전체에 hover가 세 곳밖에 없고 버튼에는 아예 없어서,
웹에서 눌리는 요소인지 구분이 되지 않기 때문이다.

## 용어

| 용어 | 정의 |
|---|---|
| 변형(variant) | `primary` / `secondary` / `ghost` — 버튼이 맡은 역할. `ButtonVariant` 타입 |
| 상태 | `disabled` / `:hover` — 변형 위에 얹히는 것. 어느 변형에든 붙는다 |
| 토큰 값 | `globals.css`의 `:root`(라이트) 또는 `prefers-color-scheme: dark` 블록에 선언된 `oklch(...)` 문자열 |

## 데이터

스키마 변경은 없다. 바뀌는 것은 CSS 커스텀 프로퍼티다.

| 토큰 | 라이트 | 다크 | 쓰임 |
|---|---|---|---|
| `--ink-hover` | `oklch(0.15 0.015 60)` | `oklch(0.88 0.005 85)` | primary 버튼 hover 배경 |
| `--ink-disabled` | `oklch(0.65 0.015 65)` | `oklch(0.46 0.01 65)` | disabled 버튼 글자 |

다크에서 `--ink-hover`가 `--ink`(0.95)보다 **어두운** 이유는, 라이트의 "더 어둡게"(0.22→0.15)를
그대로 대칭시키면 0.95+0.07 = 1.02가 되어 표현 범위를 벗어나기 때문이다. 밝은 면을 누르면
어두워지는 쪽을 택했다. 0.95→0.99로 잡으면 차이가 0.04라 사실상 보이지 않는다.

이 두 개를 더하면 색 토큰은 16개에서 **18개**가 된다. `AC-DS2-01`이 개수를 16으로 못박고
있으므로 그 조건을 정정한다 — `signal-record`를 더할 때와 같은 방식이다.

## API

없음. 프론트엔드 전용이다.

---

## 어떻게 동작 — 인수 조건

> 각 조건은 리터럴 값을 쓴다.
> 「토큰 값과 같다」는 조건은 **하드코딩한 문자열이 아니라** 같은 문서에서 읽은 커스텀
> 프로퍼티 값과 대조한다. 브라우저마다 `getComputedStyle`이 `oklch(...)`를 그대로 주기도 하고
> `rgb(...)`로 바꾸기도 하는데, 양쪽을 같은 방식으로 읽으면 형식이 일치한다.

### 토큰

#### AC-BTN-01 · `--ink-hover`가 라이트·다크 값을 갖는다

- **Given** `frontend/src/app/globals.css`
- **When** `:root`와 `@media (prefers-color-scheme: dark)` 블록에서 `--ink-hover`를 읽는다
- **Then** 라이트가 `oklch(0.15 0.015 60)`, 다크가 `oklch(0.88 0.005 85)`다
- **검증** 단위 테스트 `designTokens.test.ts`

#### AC-BTN-02 · `--ink-disabled`가 라이트·다크 값을 갖는다

- **Given** 위와 같음
- **When** 양쪽 블록에서 `--ink-disabled`를 읽는다
- **Then** 라이트가 `oklch(0.65 0.015 65)`, 다크가 `oklch(0.46 0.01 65)`다
- **검증** 단위 테스트 `designTokens.test.ts`

#### AC-BTN-03 · 색 토큰이 양쪽 팔레트에 18개씩 있다

- **Given** 위와 같음
- **When** 두 블록의 색 토큰 이름을 모은다
- **Then** 각각 **18개**이고 두 이름 집합이 같다
- **And** `AC-DS2-01`의 개수 정정이 스펙 문서에 기록돼 있다
- **검증** 단위 테스트 `designTokens.test.ts`

### 렌더된 색 — 라이트

네 조건 모두 라이트 모드에서 `Button`을 화면에 띄우고 `getComputedStyle`로 잰다.

#### AC-BTN-04 · primary가 먹색으로 칠해진다

- **Given** 라이트 모드, `<Button variant="primary">`
- **When** 배경색과 글자색을 잰다
- **Then** 배경이 `--ink` 값과 같고, 글자가 `--on-ink` 값과 같다
- **And** 배경이 `--accent` 값과 **다르다**
- **검증** e2e `button-color.spec.ts`

#### AC-BTN-05 · secondary가 표면색 + 1px 테두리다

- **Given** 라이트 모드, `<Button variant="secondary">`
- **When** 배경색·테두리·글자색을 잰다
- **Then** 배경이 `--surface`, 테두리가 `1px` 두께에 `--border` 색, 글자가 `--ink`다
- **검증** e2e `button-color.spec.ts`

#### AC-BTN-06 · ghost는 배경이 없다

- **Given** 라이트 모드, `<Button variant="ghost">`
- **When** 배경색과 글자색을 잰다
- **Then** 배경이 `rgba(0, 0, 0, 0)`이고 글자가 `--accent`다
- **검증** e2e `button-color.spec.ts`

#### AC-BTN-07 · disabled가 가라앉은 면으로 칠해진다

- **Given** 라이트 모드, `<Button disabled>`
- **When** 배경색·글자색·`opacity`를 잰다
- **Then** 배경이 `--sunken`, 글자가 `--ink-disabled`, `opacity`가 `1`이다
- **검증** e2e `button-color.spec.ts`

> `opacity`를 `1`로 못박는 이유는 현행 `disabled:opacity-50`이 남아 있으면 두 방식이 겹쳐
> 목업보다 흐려지기 때문이다. 이 조건이 그 잔재를 잡는다.

### hover

네 조건 모두 해당 버튼에 실제로 포인터를 올린 뒤 잰다.

#### AC-BTN-08 · primary hover가 `--ink-hover`다

- **Given** 라이트 모드, `<Button variant="primary">`
- **When** 버튼 위에 포인터를 올리고 배경색을 잰다
- **Then** `--ink-hover` 값과 같다
- **검증** e2e `button-color.spec.ts`

#### AC-BTN-09 · secondary hover가 `--sunken`이다

- **Given** 라이트 모드, `<Button variant="secondary">`
- **When** 위와 같음
- **Then** `--sunken` 값과 같다
- **검증** e2e `button-color.spec.ts`

#### AC-BTN-10 · ghost hover가 `--accent-wash`다

- **Given** 라이트 모드, `<Button variant="ghost">`
- **When** 위와 같음
- **Then** `--accent-wash` 값과 같다
- **검증** e2e `button-color.spec.ts`

#### AC-BTN-11 · disabled는 hover해도 변하지 않는다

- **Given** 라이트 모드, `<Button disabled>`
- **When** 버튼 위에 포인터를 올리고 배경색을 잰다
- **Then** `--sunken` 값 그대로다 — hover 전과 같다
- **검증** e2e `button-color.spec.ts`

### 다크

#### AC-BTN-12 · 다크에서 primary가 저절로 반전된다

- **Given** 다크 모드, `<Button variant="primary">`
- **When** 배경색과 글자색을 잰다
- **Then** 배경이 다크 `--ink`, 글자가 다크 `--on-ink`와 같다
- **And** 이를 위해 `dark:` 접두 클래스를 쓰지 않는다 (`AC-VISUAL-03` 유지)
- **검증** e2e `button-color.spec.ts`

#### AC-BTN-13 · 다크에서 primary hover가 `--ink-hover`다

- **Given** 다크 모드, `<Button variant="primary">`
- **When** 포인터를 올리고 배경색을 잰다
- **Then** 다크 `--ink-hover` 값과 같다 — 즉 hover하면 **어두워진다**
- **검증** e2e `button-color.spec.ts`

### 단일 출처

#### AC-BTN-14 · `ButtonLink`가 `Button`과 같은 색으로 칠해진다

- **Given** 라이트 모드, 같은 변형의 `<Button>`과 `<ButtonLink>`
- **When** `primary`·`secondary`·`ghost` 각각에서 배경색과 글자색을 잰다
- **Then** 세 변형 모두 두 컴포넌트의 배경색이 같고 글자색도 같다
- **검증** e2e `button-color.spec.ts`

#### AC-BTN-15 · 변형 색 테이블이 한 곳에만 있다

- **Given** `frontend/src/components/ui/ButtonLink.tsx`
- **When** 파일에서 변형별 색 클래스 선언을 찾는다
- **Then** 자체 선언이 없고 `Button.tsx`가 내보낸 것을 가져다 쓴다
- **검증** 단위 테스트 `primitives.test.tsx`

---

## 수동 확인

- [ ] 폰(라이트)에서 저장 버튼이 먹색으로 보이고, 화면에서 유일한 유채색이 `accent`로 남는지 눈으로 확인
- [ ] 폰(다크)에서 primary 버튼이 밝은 면으로 반전돼 읽히는지 확인
- [ ] 데스크톱 브라우저에서 세 변형에 마우스를 올려 hover가 지각되는지 확인 — 특히 다크의 0.95→0.88

## 열어둔 결정

- **`focus-visible`과 `active` 색.** 목업에 값이 없다. 키보드 접근성 점검을 할 때 함께 정한다.
- **`Button`/`ButtonLink` 밖 버튼들의 disabled 처리.** 지금은 `opacity-40`/`opacity-50`로
  남는다. 삭제 다이얼로그와 스텝 에디터를 손대는 스펙이 열릴 때 같은 규칙으로 맞출지 정한다.
