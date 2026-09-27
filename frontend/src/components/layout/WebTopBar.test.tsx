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

/** 상단 바의 primary 링크. 모양은 `BUTTON_VARIANT.primary`(`bg-ink`)가 정한다. */
function primaryLinks(): HTMLElement[] {
  return screen
    .getAllByRole("link")
    .filter((link) => link.classList.contains("bg-ink"));
}

describe("WebTopBar", () => {
  it.each([
    ["/", "이 레시피로 내렸다", "/recipes"],
    ["/recipes", "새 레시피", "/recipes/new"],
    ["/brews", "기록하기", "/recipes"],
  ])("AC-GRAMMAR-05 · %s의 CTA는 %s(%s)다", (path, label, href) => {
    pathname = path;

    render(<WebTopBar />);

    const links = primaryLinks();
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveTextContent(label);
    expect(links[0]).toHaveAttribute("href", href);
  });

  it.each(["/recipes/12", "/brews/2", "/more", "/u/11", "/gear/grind-converter"])(
    "AC-GRAMMAR-14 · %s에는 CTA가 없다",
    (path) => {
      pathname = path;

      render(<WebTopBar />);

      expect(screen.getByRole("banner")).toBeInTheDocument();
      expect(primaryLinks()).toHaveLength(0);
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
    expect(primaryLinks()).toHaveLength(0);
  });
});
