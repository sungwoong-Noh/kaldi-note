/**
 * 다크 모드 토글 — docs/specs/2026-09-17-dark-mode-toggle.md
 *
 * <p>저장된 선택이 없으면 시스템(`prefers-color-scheme`)이 그대로 이긴다. 저장된 선택이
 * 있으면 `<html data-theme>`가 CSS에서 미디어쿼리보다 우선한다(`globals.css` 참조).
 */
export const THEME_KEY = "kaldi-theme";

export type Theme = "light" | "dark";

/** localStorage에 남은 값이 손상됐거나(다른 값) 없으면 "시스템을 따른다"는 뜻의 null이다. */
export function readStoredTheme(): Theme | null {
  const value = localStorage.getItem(THEME_KEY);
  return value === "light" || value === "dark" ? value : null;
}

export function writeStoredTheme(theme: Theme): void {
  localStorage.setItem(THEME_KEY, theme);
}

/**
 * `<head>`에 인라인으로 박는 스크립트 본문.
 *
 * <p>React 하이드레이션 전에 실행돼야 한다 — 그러지 않으면 다크를 저장해둔 사용자가
 * 페이지를 열 때마다 라이트가 한 프레임 번쩍인다(FOUC). 그래서 React 컴포넌트가 아니라
 * 순수 문자열이고, `THEME_KEY`가 리터럴로 다시 박힌다 — 이름이 어긋나면 조용히 무시되므로
 * 테스트가 그 문자열이 실제로 들어있는지 확인한다.
 */
export function initThemeScript(): string {
  return `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}`;
}
