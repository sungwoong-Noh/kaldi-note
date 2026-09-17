import { afterEach, describe, expect, it } from "vitest";
import { THEME_KEY, initThemeScript, readStoredTheme } from "./theme";

afterEach(() => localStorage.clear());

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
    expect(readStoredTheme()).toBeNull();
  });

  it("초기화 스크립트 문자열에 THEME_KEY가 들어있다", () => {
    // <head>에 그대로 박히는 문자열이라 오타가 나면 실행되지 않고 조용히 무시된다.
    expect(initThemeScript()).toContain(THEME_KEY);
  });
});
