"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { readStoredTheme, writeStoredTheme, type Theme } from "@/lib/theme";

/**
 * 저장된 선택 → 시스템 설정 → 기본값(라이트) 순으로 "지금 보이는 모드"를 정한다.
 *
 * <p>`useState`의 lazy initializer로만 부른다. `useEffect` 안에서 `setState`를 부르면
 * "처음 렌더에 필요한 값을 다음 프레임에야 반영한다"는 신호라 `react-hooks/set-state-in-effect`가
 * 잡는다 — 이 컴포넌트는 `/more`가 로그인 확인을 마친 뒤에만 마운트되므로(그 전엔
 * `LoadingState`) SSR 출력과 겹칠 일이 없어 초기화 시점에 읽어도 하이드레이션 불일치가 없다.
 */
function currentTheme(): Theme {
  if (typeof document === "undefined") return "light";

  const stored = readStoredTheme();
  if (stored !== null) return stored;

  // jsdom(테스트 환경)에는 matchMedia가 없다. 없으면 시스템 판정을 건너뛴다.
  if (typeof window.matchMedia === "function") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return "light";
}

/**
 * 라이트/다크 2단 토글 — docs/specs/2026-09-17-dark-mode-toggle.md
 *
 * <p>3번째 상태("시스템 따르기")는 없다. 저장된 선택이 없는 것 자체가 "아직 고르지 않음"이고,
 * 그동안은 미디어쿼리가 그대로 이긴다(`globals.css`).
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => currentTheme());

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    writeStoredTheme(next);
    document.documentElement.dataset.theme = next;
  }

  return (
    <Button
      variant="secondary"
      block
      onClick={toggle}
      className="justify-start"
    >
      {theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"}
    </Button>
  );
}
