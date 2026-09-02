import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BottomNav } from "./BottomNav";

let pathname = "/recipes";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

beforeEach(() => {
  pathname = "/recipes";
});

describe("BottomNav", () => {
  it("AC-WEBSHELL-01 · 탭 네 개가 순서대로 보인다", () => {
    render(<BottomNav />);

    const labels = screen.getAllByRole("link").map((link) => link.textContent);
    expect(labels).toEqual(["홈", "레시피", "기록", "더보기"]);
  });

  it("AC-WEBSHELL-02 · 각 탭이 제 경로를 가리킨다", () => {
    render(<BottomNav />);

    expect(screen.getByRole("link", { name: "홈" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: "레시피" })).toHaveAttribute(
      "href",
      "/recipes",
    );
    expect(screen.getByRole("link", { name: "기록" })).toHaveAttribute(
      "href",
      "/brews",
    );
    expect(screen.getByRole("link", { name: "더보기" })).toHaveAttribute(
      "href",
      "/more",
    );
  });

  it("AC-WEBSHELL-03 · 로그 상세에서도 기록 탭이 켜진다", () => {
    pathname = "/brews/42";

    render(<BottomNav />);

    expect(screen.getByRole("link", { name: "기록" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "홈" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(screen.getByRole("link", { name: "레시피" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(screen.getByRole("link", { name: "더보기" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("AC-WEBSHELL-04 · 레시피 상세에서도 레시피 탭이 켜진다", () => {
    pathname = "/recipes/12";

    render(<BottomNav />);

    expect(screen.getByRole("link", { name: "레시피" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("AC-WEBLOGEDIT-18 · 로그 편집 화면에는 탭바가 없다", () => {
    pathname = "/brews/42/edit";

    render(<BottomNav />);

    expect(
      screen.queryByRole("link", { name: "기록" }),
    ).not.toBeInTheDocument();
  });

  it("레시피 편집 화면에는 탭바가 없다", () => {
    pathname = "/recipes/12/edit";

    render(<BottomNav />);

    expect(
      screen.queryByRole("link", { name: "레시피" }),
    ).not.toBeInTheDocument();
  });

  it("AC-WEBSHELL-05 · 홈은 정확히 일치할 때만 켜진다", () => {
    pathname = "/recipes";

    render(<BottomNav />);

    expect(screen.getByRole("link", { name: "홈" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("AC-WEBSHELL-06 · 로그인 화면에는 탭바가 없다", () => {
    pathname = "/login";

    render(<BottomNav />);

    expect(
      screen.queryByRole("link", { name: "기록" }),
    ).not.toBeInTheDocument();
  });

  it("AC-WEBSHELL-07 · 작성 화면에는 탭바가 없다", () => {
    pathname = "/brews/new";

    render(<BottomNav />);

    expect(
      screen.queryByRole("link", { name: "기록" }),
    ).not.toBeInTheDocument();
  });

  it("홈에서는 홈 탭이 켜진다", () => {
    pathname = "/";

    render(<BottomNav />);

    expect(screen.getByRole("link", { name: "홈" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("레시피 작성 화면에도 탭바가 없다", () => {
    pathname = "/recipes/new";

    render(<BottomNav />);

    expect(
      screen.queryByRole("link", { name: "레시피" }),
    ).not.toBeInTheDocument();
  });

  it("OAuth 콜백 화면에도 탭바가 없다", () => {
    pathname = "/auth/callback";

    render(<BottomNav />);

    expect(screen.queryByRole("link", { name: "홈" })).not.toBeInTheDocument();
  });

  it("AC-WEBSHELL-32 · 콘텐츠가 짧아도 탭바가 화면 하단에 놓인다", () => {
    pathname = "/";

    render(<BottomNav />);

    // jsdom은 레이아웃을 계산하지 않는다. 좌표 대신 하단에 놓이게 하는 클래스를 본다.
    const nav = screen.getByRole("navigation", { name: "주요 화면" });
    for (const className of ["mt-auto", "sticky", "bottom-0"]) {
      expect(nav).toHaveClass(className);
    }
  });
});
