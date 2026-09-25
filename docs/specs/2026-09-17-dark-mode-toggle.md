---
id: THEME
title: 다크 모드 토글
status: 구현완료
plan: docs/archive/plans/2026-09-17-plan-dark-mode-toggle.md
---

# 다크 모드 토글 스펙

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.
> **모든 인수 조건은 자동화된 테스트로 옮길 수 있어야 한다.**

## 무엇을

**사용자가 시스템 설정과 무관하게 라이트/다크를 직접 고른다.** 더보기 화면에 토글 하나를 두고,
누르면 즉시 반대 모드로 바뀌며 그 선택을 기억한다.

지금은 `@media (prefers-color-scheme: dark)`만 있어 **OS 설정을 따라갈 뿐 앱 안에서 바꿀 방법이
없다.** 디자인 핸드오프(`docs/design/design_handoff_kaldi_note/README.md`)의 더보기 화면(M10)에
이미 "다크 모드 토글" 메뉴 행이 있고, 방향 문서(`2026-09-16-product-direction.md`)의 3단계
"작은 기능"으로 예고돼 있었다.

### 범위 밖 (Non-goals)

- **3단계(시스템/라이트/다크).** 2단계만 만든다. 저장된 선택이 없으면 시스템을 따른다 —
  이건 3번째 상태가 아니라 "아직 고르지 않음"이다.
- **서버 저장.** 계정을 옮기거나 기기를 바꾸면 선택이 초기화된다. `localStorage`만 쓴다.
- **로그인·타이머 화면의 강제 다크 고정.** 핸드오프가 예고한 항목이지만 로그인은 이미
  `bg-ink`류로 실질적으로 다크이고, 타이머는 아직 없는 화면(`pour-timer` 스펙)이다.
- **토글의 시각 디자인(스위치 모양).** 지금은 텍스트 버튼으로 만든다. 리스킨에서 스위치
  컴포넌트가 생기면 그것으로 바꾼다.

## 왜

사용자가 더보기 화면에서 다크 모드로 바꿀 방법을 찾다가 없다는 것을 발견했다
(2026-09-17). 디자인에는 이미 있던 항목이 구현 순서상 뒤로 밀려 있었을 뿐이다.

## 용어

| 용어 | 정의 |
|---|---|
| 저장된 선택 | `localStorage`의 `kaldi-theme` 키. 값은 `"light"` \| `"dark"` |
| 시스템 기본값 | 저장된 선택이 없을 때 `prefers-color-scheme`가 정하는 값 |

## 데이터

새 테이블·API 없음. 클라이언트 로컬 상태(`localStorage`)만 쓴다.

## 어떻게 동작 — 인수 조건

#### AC-THEME-01 · 더보기 화면에 스위치가 있다

- **Given** `/more` 화면
- **When** 렌더한다
- **Then** `role="switch"`를 가진 요소가 있고, 접근 가능한 이름이 "다크 모드"다

> **갱신(2026-09-17).** 처음엔 라벨이 "다크 모드로 전환"인 텍스트 버튼이었다 —
> 행위(누르면 될 것)를 말하지 현재 상태를 안 보여줬고 `role="switch"`도 없어
> 스크린리더가 켜짐/꺼짐을 전달하지 못했다. 라벨은 **설정 이름**으로 고정하고,
> 상태는 `aria-checked`로만 전달한다.

#### AC-THEME-02 · 저장된 선택이 없으면 시스템 설정을 따른다

- **Given** `localStorage`에 `kaldi-theme`가 없고, 시스템이 다크다
- **When** 페이지를 연다
- **Then** `<html>`의 `data-theme` 속성이 없다 (미디어쿼리가 그대로 다크를 적용한다)

#### AC-THEME-03 · 토글을 누르면 즉시 반대 모드로 바뀐다

- **Given** 시스템이 라이트고 저장된 선택이 없다 (현재 표시 = 라이트, `aria-checked="false"`)
- **When** 스위치를 누른다
- **Then** `<html data-theme="dark">`가 되고, `aria-checked="true"`가 된다

#### AC-THEME-04 · 선택이 localStorage에 저장된다

- **Given** 토글을 눌러 다크로 바꿨다
- **When** `localStorage.getItem("kaldi-theme")`를 읽는다
- **Then** `"dark"`다

#### AC-THEME-05 · 저장된 선택이 새로고침 후에도 유지된다

- **Given** `localStorage`에 `kaldi-theme = "dark"`가 저장돼 있고 시스템은 라이트다
- **When** 페이지를 새로 연다 (첫 렌더 전)
- **Then** `<html data-theme="dark">`다 — **시스템보다 저장된 선택이 우선**한다

#### AC-THEME-06 · 다시 누르면 저장된 선택이 지워지지 않고 반대로 바뀐다

- **Given** 저장된 선택이 `"dark"`다 (`aria-checked="true"`)
- **When** 스위치를 다시 누른다
- **Then** `localStorage`의 값이 `"light"`로 바뀌고 `<html data-theme="light">`이며 `aria-checked="false"`다

#### AC-THEME-07 · 토글의 터치 영역이 44×44 이상이다

- **Given** `/more` 화면의 토글
- **When** 렌더된 행 전체의 높이를 잰다
- **Then** 44px 이상이다 — **스위치 트랙 자체(24px)가 아니라 누르는 행 전체**다
