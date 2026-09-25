# 다크 모드 토글 구현 계획

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.

**Spec:** `docs/specs/2026-09-17-dark-mode-toggle.md`

**Goal:** 더보기 화면에서 라이트/다크를 직접 고르고, 그 선택이 새로고침 후에도 유지된다.

**Architecture:** `data-theme` 속성이 미디어쿼리보다 우선하도록 CSS를 3단으로 쌓는다
(artifact-capabilities 스킬이 쓰는 것과 같은 패턴) — 저장된 선택이 없으면 미디어쿼리가
그대로 이긴다. FOUC를 막기 위해 `<head>` 인라인 스크립트가 hydration 전에 속성을 심는다.

**작업 위치:** `frontend/`

**반드시 먼저 읽을 것:** `CLAUDE.md`(루트) → `frontend/CLAUDE.md` → `docs/conventions/frontend.md`

---

## AC 커버리지 매핑

| AC ID | 담당 태스크 | 검증 |
|---|---|---|
| AC-THEME-01 | Task 2 | 단위 (렌더) |
| AC-THEME-02 | Task 1 | 단위 (CSS 파싱) |
| AC-THEME-03 | Task 2 | 단위 (렌더 + 클릭) |
| AC-THEME-04 | Task 2 | 단위 |
| AC-THEME-05 | Task 1 | 단위 (인라인 스크립트 로직) |
| AC-THEME-06 | Task 2 | 단위 |
| AC-THEME-07 | Task 2 | 단위 (클래스) |

---

## Task 1: CSS 3단 구조 + 초기화 스크립트

**Files:**
- Modify: `src/app/globals.css`, `src/app/layout.tsx`
- Create: `src/lib/theme.ts`, `src/lib/theme.test.ts`

**Covers:** AC-THEME-02, 05

- [x] **Step 1: 실패하는 테스트**

```ts
// src/lib/theme.test.ts
import { describe, expect, it } from "vitest";
import { THEME_KEY, initThemeScript, readStoredTheme } from "./theme";

describe("테마 저장소", () => {
  it("AC-THEME-05 · 저장된 값이 light/dark가 아니면 무시한다", () => {
    localStorage.setItem(THEME_KEY, "sepia");
    expect(readStoredTheme()).toBeNull();
  });

  it("저장된 값이 dark면 그대로 읽는다", () => {
    localStorage.setItem(THEME_KEY, "dark");
    expect(readStoredTheme()).toBe("dark");
  });

  it("AC-THEME-02 · 저장된 값이 없으면 null이다", () => {
    localStorage.clear();
    expect(readStoredTheme()).toBeNull();
  });

  it("초기화 스크립트 문자열에 THEME_KEY가 들어있다", () => {
    // <head>에 그대로 박히는 문자열이라 오타가 나면 실행되지 않고 조용히 무시된다.
    expect(initThemeScript()).toContain(THEME_KEY);
  });
});
```

- [x] **Step 2: 실패 확인**
- [x] **Step 3: `src/lib/theme.ts` 구현.** `THEME_KEY = "kaldi-theme"`,
      `readStoredTheme(): "light" | "dark" | null`,
      `initThemeScript(): string` — `<head>`에 심을 순수 문자열 스크립트.
      hydration 전에 실행돼야 하므로 **React 밖**이다.
- [x] **Step 4: `globals.css` 재구성**

```css
:root { /* 라이트 값 그대로 */ }

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { /* 다크 값 */ }
}

:root[data-theme="dark"] { /* 다크 값 — 토글이 강제할 때 */ }
```

  다크 블록의 값을 두 곳에 중복 적지 않는다 — CSS 커스텀 프로퍼티 블록을 함수로 만들 수
  없으니 **주석으로 "이 블록을 고치면 저 블록도 고친다"를 남긴다.**

- [x] **Step 5: `layout.tsx`의 `<head>`에 `initThemeScript()`를 인라인 `<script>`로 삽입**
      (hydration 경고 방지: `dangerouslySetInnerHTML`, `suppressHydrationWarning` 불필요 —
      `<html>`은 이미 `suppressHydrationWarning`이 있다)
- [x] **Step 6: 통과 확인 + `pnpm build`로 인라인 스크립트가 실제로 나가는지 확인**

## Task 2: 토글 컴포넌트

**Files:**
- Create: `src/components/ThemeToggle.tsx`, `src/components/ThemeToggle.test.tsx`
- Modify: `src/app/more/page.tsx`

**Covers:** AC-THEME-01, 03, 04, 06, 07

- [x] **Step 1: 실패하는 테스트**

```tsx
// src/components/ThemeToggle.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { THEME_KEY } from "@/lib/theme";
import { ThemeToggle } from "./ThemeToggle";

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

describe("ThemeToggle", () => {
  it("AC-THEME-01 · AC-THEME-07 · 44px 이상의 버튼을 낸다", () => {
    render(<ThemeToggle />);
    const btn = screen.getByRole("button");
    expect(btn.className).toMatch(/\bmin-h-11\b/);
  });

  it("AC-THEME-03 · AC-THEME-04 · 누르면 dark로 바뀌고 저장된다", () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button"));

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem(THEME_KEY)).toBe("dark");
    expect(screen.getByRole("button").textContent).toBe("라이트 모드로 전환");
  });

  it("AC-THEME-06 · 다시 누르면 light로 되돌아간다", () => {
    render(<ThemeToggle />);
    const btn = screen.getByRole("button");
    fireEvent.click(btn);
    fireEvent.click(btn);

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem(THEME_KEY)).toBe("light");
  });
});
```

- [x] **Step 2: 실패 확인**
- [x] **Step 3: `ThemeToggle` 구현.** 마운트 시 `data-theme` 또는 `prefers-color-scheme`로
      현재 모드를 읽어 라벨을 정하고, 클릭 시 반대로 토글 + `localStorage` 갱신 +
      `document.documentElement.dataset.theme` 갱신. `Button` 프리미티브(`variant="secondary"`)를 쓴다
- [x] **Step 4: `/more`에 삽입** — 분쇄도 환산기 링크 아래
- [x] **Step 5: `pnpm test` 전체 초록**
- [x] **Step 6: 브라우저로 실제 확인** — 새로고침 후 유지되는지, 시스템 설정과 별개로 동작하는지
- [x] **Step 7: 커밋**
