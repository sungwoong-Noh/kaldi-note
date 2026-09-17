import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { THEME_KEY } from "@/lib/theme";
import { ThemeToggle } from "./ThemeToggle";

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

describe("ThemeToggle", () => {
  it("AC-THEME-01 · role=switch로 노출된다", () => {
    render(<ThemeToggle />);
    // role=button이 아니라 role=switch다 — 스크린리더가 "설정 스위치"로 읽어야
    // 지금 상태(켜짐/꺼짐)가 함께 전달된다.
    expect(screen.getByRole("switch")).toBeDefined();
  });

  it("AC-THEME-07 · 터치 영역이 44px 이상이다", () => {
    render(<ThemeToggle />);
    // 스위치 트랙 자체는 시각적으로 작아도(24px), 누르는 영역은 행 전체(44px)다.
    const row = screen.getByRole("switch").closest("[data-theme-row]");
    expect(row?.className).toMatch(/\bmin-h-11\b/);
  });

  it("라벨은 설정 이름이지, 눌렀을 때 될 상태가 아니다", () => {
    render(<ThemeToggle />);
    // "다크 모드로 전환"(행위)이 아니라 "다크 모드"(설정 이름)여야 한다.
    // 지금 상태는 aria-checked가 전달하고, 라벨은 라이트/다크 전환에도 바뀌지 않는다.
    expect(screen.getByText("다크 모드")).toBeDefined();
  });

  it("AC-THEME-03 · AC-THEME-04 · 누르면 켜지고 저장된다", () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("switch"));

    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe(
      "true",
    );
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem(THEME_KEY)).toBe("dark");
  });

  it("AC-THEME-06 · 다시 누르면 꺼지고 light로 저장된다", () => {
    render(<ThemeToggle />);
    const sw = screen.getByRole("switch");
    fireEvent.click(sw);
    fireEvent.click(sw);

    expect(sw.getAttribute("aria-checked")).toBe("false");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem(THEME_KEY)).toBe("light");
  });

  it("초기 aria-checked가 현재 테마를 반영한다", () => {
    localStorage.setItem(THEME_KEY, "dark");
    render(<ThemeToggle />);
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe(
      "true",
    );
  });
});
