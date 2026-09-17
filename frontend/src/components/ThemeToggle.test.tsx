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
