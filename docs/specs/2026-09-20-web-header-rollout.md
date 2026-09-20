---
id: WEBHDR
title: 웹 헤더를 홈 밖 화면에도 적용
status: 구현완료
plan: docs/plans/2026-09-20-plan-web-header-rollout.md
---

# 웹 헤더를 홈 밖 화면에도 적용 스펙

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.
> **모든 인수 조건은 자동화된 테스트로 옮길 수 있어야 한다.**

## 무엇을

**홈 화면에만 있던 로고 헤더(`WebTopBar`)를, 하단 탭바가 보이는 나머지 화면에도 똑같이 적용한다.** `/recipes`·`/brews`·`/recipes/[id]`·`/brews/[id]`·`/more`·`/gear/grind-converter`에서 `<1100px`이면 로고+워드마크만, `≥1100px`이면 네비·CTA·아바타까지 포함한 전체 헤더가 보인다. 네비게이션은 현재 보고 있는 화면을 감전다. `≥1100px`에서는 하단 탭바가 모든 대상 화면에서 숨는다 — 상단 네비와 중복되기 때문이다.

### 범위 밖 (Non-goals)

- **레시피 목록의 3열 카드 그리드 같은, 화면별 전체 웹 레이아웃 재설계.** 목업(`Kaldi Note Screens - Web.dc.html`)에 있지만 이번에는 상단 헤더만 다룬다.
- **로그인·작성·편집 화면에 헤더를 넣는 것.** `/login`·`/auth/*`·`/recipes/new`·`/brews/new`·`*/edit`은 제외한다 — `BottomNav`가 이미 이 화면들에서 숨는 것과 같은 기준이다.
- **화면마다 다른 CTA 문구.** 목업은 화면마다 다르지만(`새 레시피`, `이 레시피로 내렸다`), 이번에는 전부 `기록하기` → `/recipes`로 통일한다. 홈의 기존 「구현 중 정정」과 같은 이유다.
- **백엔드 변경.** 0건.

## 왜

홈에만 있던 브랜드 헤더가 다른 화면으로 넘어가면 사라진다. 사용자가 직접 지적했다 — "홈화면을 제외한 화면에서는 로고가 안보이는데". `<1100px`에서 로고만 보이는 규칙은 이미 홈에 있으므로, 그 규칙을 넓히는 것이 가장 적은 변화로 일관성을 회복하는 길이다.

## 용어

| 용어 | 정의 |
|---|---|
| **대상 화면** | `BottomNav`가 보이는 화면 전부 — `/`, `/recipes`, `/recipes/[id]`, `/brews`, `/brews/[id]`, `/more`, `/gear/grind-converter` |
| **제외 화면** | `BottomNav`의 `HIDDEN_PREFIXES`와 `*/edit` — `/login`, `/auth/*`, `/recipes/new`, `/brews/new`, `/recipes/[id]/edit`, `/brews/[id]/edit` |

## 데이터

없음. 백엔드 변경 없음.

## API

없음.

---

## 어떻게 동작 — 인수 조건

### 정상 동작

#### AC-WEBHDR-01 · 대상 화면 전부에서 `<1100px`에도 로고 헤더가 보인다

- **Given** 뷰포트 폭 `390px`
- **When** `/recipes`·`/brews`·`/recipes/[id]`·`/brews/[id]`·`/more`·`/gear/grind-converter`를 각각 연다
- **Then** 각 화면 상단에 `svg` 요소와 텍스트 `kaldi·note`가 있다
- **검증** e2e `web-header-rollout.spec.ts`

#### AC-WEBHDR-02 · 그 헤더에는 네비·CTA·아바타가 없다

- **Given** 뷰포트 폭 `390px`, `/recipes`를 연다
- **When** 상단 헤더를 본다
- **Then** `홈`·`레시피`·`기록` 링크, `기록하기` 버튼, 아바타 링크가 전부 안 보인다
- **검증** e2e `web-header-rollout.spec.ts`

#### AC-WEBHDR-03 · `≥1100px`에서는 네비·CTA·아바타가 모두 보인다

- **Given** 뷰포트 폭 `1440px`, `/recipes`를 연다
- **When** 상단 헤더를 본다
- **Then** `홈`·`레시피`·`기록` 링크, `기록하기` 버튼(목적지 `/recipes`), 아바타 링크가 모두 보인다
- **검증** e2e `web-header-rollout.spec.ts`

#### AC-WEBHDR-04 · 현재 화면의 네비 링크가 감전다

- **Given** 뷰포트 폭 `1440px`, `/recipes`를 연다
- **When** 상단 헤더의 네비 링크들을 본다
- **Then** `레시피` 링크만 `aria-current="page"`이고 `홈`·`기록`은 아니다
- **검증** e2e `web-header-rollout.spec.ts`

#### AC-WEBHDR-05 · `/brews`를 열면 `기록` 링크가 감전다

- **Given** 뷰포트 폭 `1440px`, `/brews`를 연다
- **When** 상단 헤더의 네비 링크들을 본다
- **Then** `기록` 링크만 `aria-current="page"`다
- **검증** e2e `web-header-rollout.spec.ts`

#### AC-WEBHDR-06 · `me`가 로딩 중이어도 헤더는 보이고 아바타 자리만 비어 있다

- **Given** `GET /api/v1/users/me` 응답을 지연시킨 상태, 뷰포트 폭 `1440px`
- **When** `/recipes`를 연다
- **Then** 로고와 네비는 즉시 보이고, 아바타 이미지·이니셜 요소는 아직 없다
- **검증** e2e `web-header-rollout.spec.ts`

#### AC-WEBHDR-07 · `≥1100px`에서는 대상 화면 전부에서 하단 탭바가 숨는다

- **Given** 뷰포트 폭 `1440px`
- **When** `/recipes`·`/brews`·`/more`를 각각 연다
- **Then** `nav[aria-label="주요 화면"]`이 안 보인다
- **검증** e2e `web-header-rollout.spec.ts`

### 경계값

#### AC-WEBHDR-08 · `1100px`은 전체 헤더 쪽에 포함된다

- **Given** 뷰포트 폭 정확히 `1100px`, `/recipes`를 연다
- **When** 상단 헤더를 본다
- **Then** 네비·CTA·아바타가 모두 보인다
- **검증** e2e `web-header-rollout.spec.ts`

#### AC-WEBHDR-09 · `1099px`은 로고만 보이는 쪽이다

- **Given** 뷰포트 폭 정확히 `1099px`, `/recipes`를 연다
- **When** 상단 헤더를 본다
- **Then** 로고는 보이고 네비·CTA·아바타는 안 보인다
- **검증** e2e `web-header-rollout.spec.ts`

### 제외 화면

#### AC-WEBHDR-10 · 로그인·작성·편집 화면에는 헤더가 없다

- **Given** 뷰포트 폭 `1440px`
- **When** `/login`·`/recipes/new`·`/brews/new?recipeId=12`·`/recipes/12/edit`·`/brews/2/edit`를 각각 연다
- **Then** 각 화면에 `header` 요소가 없다
- **검증** e2e `web-header-rollout.spec.ts`

### 에러

없음. 백엔드 변경이 없고 새 HTTP 응답 경로가 없다.

---

## 수동 확인

없음. 전부 자동화 가능하다.

## 열어둔 결정

- **화면별 전체 웹 레이아웃 재설계(3열 카드 그리드 등).** 이번 범위 밖. 목업(`Kaldi Note Screens - Web.dc.html`)에 W2(레시피 3열)·W3(기록 상세 분석) 디자인이 있으니, 필요해지면 그걸 기반으로 별도 인터뷰를 연다.
