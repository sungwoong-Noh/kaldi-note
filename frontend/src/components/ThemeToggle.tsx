"use client";

import { useState } from "react";
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
 *
 * <p><b>설정 행 + 스위치다, 액션 버튼이 아니다.</b> 처음엔 "다크 모드로 전환"이라는 텍스트
 * 버튼으로 만들었는데 — 라벨이 행위(누르면 될 것)를 말하지 현재 상태를 안 보여줬고,
 * `role="switch"`도 없어 스크린리더가 "켜짐/꺼짐"을 전달하지 못했다. 라벨을 설정 이름
 * ("다크 모드")으로 고정하고 상태는 `aria-checked`와 스위치 위치로만 전달한다.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => currentTheme());
  const on = theme === "dark";

  function toggle() {
    const next: Theme = on ? "light" : "dark";
    setTheme(next);
    writeStoredTheme(next);
    document.documentElement.dataset.theme = next;
  }

  return (
    // 스위치 트랙 자체는 24px지만, 행 전체(min-h-11)가 누르는 영역이다 —
    // 손가락으로 정확히 작은 트랙만 노려 누르게 하지 않는다.
    <div
      data-theme-row
      className="flex min-h-11 w-full items-center justify-between gap-3 py-2 text-body"
    >
      <span id="theme-toggle-label">다크 모드</span>
      {/*
        버튼 자체가 44×44 히트 영역이다 — 눈에 보이는 트랙(24px)만 44px로 키우면
        거대한 알약 모양이 된다(RecipesPage의 체크박스와 같은 이유,
        docs/specs/2026-09-15-structure.md). 트랙·손잡이는 안쪽 장식용 span이다.
      */}
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby="theme-toggle-label"
        onClick={toggle}
        className="flex h-11 w-11 shrink-0 items-center justify-center"
      >
        <span
          aria-hidden
          className={`relative inline-flex h-6 w-11 items-center rounded-full border border-border transition-colors ${on ? "bg-accent" : "bg-sunken"}`}
        >
          <span
            className={`inline-block size-5 rounded-full bg-paper transition-transform ${on ? "translate-x-5" : "translate-x-0.5"}`}
          />
        </span>
      </button>
    </div>
  );
}
