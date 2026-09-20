---
id: ERRFOCUS
title: 폼 에러 필드로 포커스 이동
status: 구현완료
plan: docs/plans/2026-09-20-plan-error-focus.md
---

# 폼 에러 필드로 포커스 이동 스펙

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.
> **모든 인수 조건은 자동화된 테스트로 옮길 수 있어야 한다.**

## 무엇을

**기록 등록 화면에서 저장이 서버 검증(422)으로 실패하면, 틀린 입력칸으로 포커스를 옮긴다.** 여러 칸이 동시에 틀렸으면 화면에 보이는 순서상 첫 번째 칸으로 간다. 어떤 칸에도 붙지 않는 에러거나 네트워크·서버 오류라면, 하단의 일반 에러 문구로 포커스를 옮긴다.

각 입력칸은 이미 `aria-invalid`·`aria-describedby`를 갖고 있어 포커스가 그 칸에 닿으면 스크린리더가 라벨과 에러 이유를 함께 읽어준다 — 이 스펙은 **그 칸으로 포커스를 옮기는 동작만** 추가한다.

### 범위 밖 (Non-goals)

- **`BrewLogEditor`(기록 편집)와 `RecipeForm`(레시피 생성·편집)은 이번에 포함하지 않는다.** 특히 `RecipeForm`의 스텝 배열은 필드 단위가 아니라 스텝 단위로 에러가 붙어(`byStepIndex`) 별도 설계가 필요하다.
- **클라이언트 사전 검증(제출 전에 필수값을 막는 것)은 만들지 않는다.** 서버가 422로 거부했을 때만 반응한다.
- **전용 스크린리더 안내(`aria-live` 요약 문구, 예: "N건 확인 필요")는 추가하지 않는다.** 필드 포커스 이동만으로 이유가 낭독된다.
- **백엔드 변경 0건.** 기존 422 응답 포맷(`fieldErrors`)을 그대로 쓴다.

## 왜

지금은 저장이 422로 실패하면 각 입력칸 밑에 빨간 글자로 이유가 뜨지만, 포커스는 그대로 저장 버튼에 남는다. 폼이 길면(브루잉 로그 작성 화면은 10개 이상의 칸을 가진다) 사용자가 어느 칸이 틀렸는지 직접 스크롤해서 찾아야 한다. 특히 모바일에서는 화면이 좁아 틀린 칸이 뷰포트 밖에 있는 경우가 흔하다.

## 용어

| 용어 | 정의 |
|---|---|
| **필드 에러** | `mapFieldErrors()`의 `byField`에 담긴, 특정 입력칸에 붙는 에러 |
| **일반 에러 문구** | 필드에 붙지 않는 에러(서버의 최상위 `message`, 또는 `ApiError`가 아닌 네트워크 오류)를 보여주는 하단 `<p>` |
| **첫 번째 invalid 필드** | 화면에 렌더된 DOM 순서상 `aria-invalid="true"`인 첫 번째 입력칸·select |

## 데이터

없음. 백엔드 변경 없음.

## API

없음. 기존 `POST /brew-logs`, `POST /bean-products` 등의 422 응답을 그대로 소비한다.

---

## 어떻게 동작 — 인수 조건

> 모든 검증은 컴포넌트 테스트(Vitest + Testing Library)로 한다. jsdom이 `document.activeElement`를 실제로 추적하므로 e2e 없이도 기계적으로 판정 가능하다.

### 정상 동작

#### AC-ERRFOCUS-01 · BrewLogForm — 필드 에러가 있으면 첫 번째 invalid 필드로 포커스가 간다

- **Given** `BrewLogForm`을 렌더하고, 저장 요청이 `actualDoseG`와 `actualWaterG` 두 필드에 대한 422 `fieldErrors`로 실패하도록 스텁한다
- **When** 저장 버튼을 누른다
- **Then** DOM 순서상 `actualDoseG`(먼저 렌더되는 칸)가 `document.activeElement`다
- **검증** 컴포넌트 테스트 `BrewLogForm.test.tsx`

#### AC-ERRFOCUS-02 · BeanBatchDialog — 저장 실패 시 첫 번째 invalid 필드로 포커스가 간다

- **Given** `BeanBatchDialog`를 렌더하고, 생성 요청이 `name` 필드 422로 실패하도록 스텁한다
- **When** 등록 버튼을 누른다
- **Then** `name` 입력칸이 `document.activeElement`다
- **검증** 컴포넌트 테스트 `BeanBatchDialog.test.tsx`

#### AC-ERRFOCUS-03 · UserGrinderDialog — 저장 실패 시 첫 번째 invalid 필드로 포커스가 간다

- **Given** `UserGrinderDialog`를 렌더하고, 생성 요청이 `nickname` 필드 422로 실패하도록 스텁한다
- **When** 등록 버튼을 누른다
- **Then** `nickname` 입력칸이 `document.activeElement`다
- **검증** 컴포넌트 테스트 `UserGrinderDialog.test.tsx`

#### AC-ERRFOCUS-04 · BrewLogForm — 필드에 붙지 않는 에러는 하단 문구로 포커스가 간다

- **Given** `BrewLogForm`을 렌더하고, 저장 요청이 `KNOWN_FIELDS`에 없는 필드명의 422(즉 `mapFieldErrors`의 `unmapped`로만 떨어지는 에러)로 실패하도록 스텁한다
- **When** 저장 버튼을 누른다
- **Then** 하단 일반 에러 문구 요소가 `tabIndex={-1}`을 갖고, 그것이 `document.activeElement`다
- **검증** 컴포넌트 테스트 `BrewLogForm.test.tsx`

#### AC-ERRFOCUS-05 · BeanBatchDialog — 필드에 붙지 않는 에러는 하단 문구로 포커스가 간다

- **Given** `BeanBatchDialog`를 렌더하고, 생성 요청이 `ApiError`가 아닌 네트워크 오류로 실패하도록 스텁한다
- **When** 등록 버튼을 누른다
- **Then** 하단 일반 에러 문구가 `document.activeElement`다
- **검증** 컴포넌트 테스트 `BeanBatchDialog.test.tsx`

#### AC-ERRFOCUS-06 · UserGrinderDialog — 필드에 붙지 않는 에러는 하단 문구로 포커스가 간다

- **Given** `UserGrinderDialog`를 렌더하고, 생성 요청이 `ApiError`가 아닌 네트워크 오류로 실패하도록 스텁한다
- **When** 등록 버튼을 누른다
- **Then** 하단 일반 에러 문구가 `document.activeElement`다
- **검증** 컴포넌트 테스트 `UserGrinderDialog.test.tsx`

#### AC-ERRFOCUS-07 · BrewLogForm — 필드 에러와 일반 문구가 동시에 있으면 필드가 우선한다

- **Given** `BrewLogForm`을 렌더하고, 저장 요청이 최상위 `message`와 `actualDoseG` 필드 422를 함께 담아 실패하도록 스텁한다
- **When** 저장 버튼을 누른다
- **Then** 하단 일반 에러 문구는 화면에 보이지만 `document.activeElement`는 `actualDoseG` 입력칸이다
- **검증** 컴포넌트 테스트 `BrewLogForm.test.tsx`

#### AC-ERRFOCUS-08 · BrewLogForm — 재시도가 다른 필드에서 실패하면 포커스가 그 필드로 다시 이동한다

- **Given** `BrewLogForm`을 렌더하고, 첫 저장 시도는 `actualDoseG` 422로 실패시킨다
- **When** 저장 버튼을 눌러 `actualDoseG`로 포커스가 이동한 뒤, 두 번째 저장 시도가 `actualWaterG` 422로 실패하도록 스텁을 바꾸고 다시 저장 버튼을 누른다
- **Then** `document.activeElement`가 `actualWaterG`로 바뀐다
- **검증** 컴포넌트 테스트 `BrewLogForm.test.tsx`

### 경계값

해당 없음 — 이 스펙에는 숫자 범위나 반올림이 없다. 판정은 "필드 에러가 1개 이상인가"의 불리언 경계뿐이며, 이는 AC-ERRFOCUS-01(1개 이상)과 AC-ERRFOCUS-04(0개)가 각각 양쪽을 덮는다.

### 에러

없음. 이 스펙은 이미 발생한 422 응답을 화면에서 어떻게 처리하는지를 다룰 뿐, 새 에러 상황을 만들지 않는다.

---

## 수동 확인

- [ ] 실제 모바일 화면에서 포커스 이동 시 브라우저가 그 칸을 뷰포트로 스크롤해주는지 (비차단형 — 모든 주요 브라우저가 `focus()`에서 기본으로 스크롤하지만, 폰 키보드가 뜨는 타이밍과 겹쳐 어색하지 않은지 눈으로 확인)

## 열어둔 결정

- **`BrewLogEditor`·`RecipeForm`으로 확대할지** — 이번 범위 밖. 필요해지면 별도 인터뷰로 스텝 배열의 포커스 대상(스텝 카드 전체 vs 스텝 안의 개별 입력칸)부터 정한다
