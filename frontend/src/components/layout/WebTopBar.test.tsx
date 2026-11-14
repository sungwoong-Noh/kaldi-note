import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { me } from "@/test/fixtures";
import { WebTopBar } from "./WebTopBar";

let pathname = "/";
let meData: typeof me | undefined = me;

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

vi.mock("@/features/user/queries", () => ({
  useMe: () => ({ data: meData }),
}));

beforeEach(() => {
  pathname = "/";
  meData = me;
});

/** 상단 바의 primary CTA. 모양은 `BUTTON_VARIANT.primary`(`bg-ink`)가 정한다. */
function primaryCtas(): HTMLElement[] {
  return [
    ...screen.queryAllByRole("link"),
    ...screen.queryAllByRole("button"),
  ].filter((el) => el.classList.contains("bg-ink"));
}

describe("WebTopBar", () => {
  it("AC-QUICKBREW-29 · 웹 상단 바는 오늘 · 기록 · 레시피 링크와 기록하기 버튼을 둔다", () => {
    pathname = "/";

    render(<WebTopBar />);

    const nav = screen.getByRole("navigation");
    const labels = Array.from(nav.querySelectorAll("a")).map(
      (link) => link.textContent,
    );
    expect(labels).toEqual(["오늘", "기록", "레시피"]);
    expect(screen.getByRole("link", { name: "오늘" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: "기록" })).toHaveAttribute(
      "href",
      "/brews",
    );
    expect(screen.getByRole("link", { name: "레시피" })).toHaveAttribute(
      "href",
      "/recipes",
    );
    expect(
      screen.getByRole("button", { name: "기록하기" }),
    ).toBeInTheDocument();
  });

  it.each([
    ["/", "기록하기", null],
    ["/recipes", "새 레시피", "/recipes/new"],
    ["/brews", "기록하기", null],
  ])("AC-GRAMMAR-05 · %s의 CTA는 %s다", (path, label, href) => {
    pathname = path;

    render(<WebTopBar />);

    const ctas = primaryCtas();
    expect(ctas).toHaveLength(1);
    expect(ctas[0]).toHaveTextContent(label);
    if (href) {
      expect(ctas[0]).toHaveAttribute("href", href);
    }
  });

  it.each(["/recipes/12", "/brews/2", "/more", "/u/11", "/gear/grind-converter"])(
    "AC-GRAMMAR-14 · %s에는 CTA가 없다",
    (path) => {
      pathname = path;

      render(<WebTopBar />);

      expect(screen.getByRole("banner")).toBeInTheDocument();
      expect(primaryCtas()).toHaveLength(0);
    },
  );

  it("AC-GRAMMAR-18 · me 로딩 중에도 CTA는 보이고 아바타 자리만 비어 있다", () => {
    pathname = "/recipes";
    meData = undefined;

    render(<WebTopBar />);

    expect(screen.getByRole("link", { name: "새 레시피" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "더보기" })).toBeNull();
  });

  it("AC-GRAMMAR-19 · 매핑에 없는 경로에서도 로고가 보이고 CTA가 없다", () => {
    pathname = "/offline";

    render(<WebTopBar />);

    expect(screen.getByRole("img", { name: "kaldi-note" })).toBeInTheDocument();
    expect(primaryCtas()).toHaveLength(0);
  });
});
