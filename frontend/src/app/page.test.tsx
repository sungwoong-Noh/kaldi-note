import { screen, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession, setAccessToken } from "@/lib/session";
import { brewLogPage, brewLogWithTds, grindedRecipe } from "@/test/fixtures";
import { server } from "@/test/msw-server";
import { renderWithQuery } from "@/test/render";
import HomePage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
}));

const BASE = "http://localhost:8080/api/v1";
const LIST_URL = `${BASE}/brew-logs`;

function pageOf(content: object[]) {
  return {
    ...brewLogPage,
    content,
    totalElements: content.length,
    hasNext: false,
  };
}

beforeEach(() => {
  clearSession();
  setAccessToken("a.b.c");
  server.use(
    http.get(`${BASE}/recipes/12`, () =>
      HttpResponse.json({ ...grindedRecipe, id: 12, title: "Kasuya 4:6" }),
    ),
  );
});

describe("HomePage", () => {
  it("AC-WEBBREW-37 · 홈은 최근 3개를 부른다", async () => {
    let query = "";
    server.use(
      http.get(LIST_URL, ({ request }) => {
        query = new URL(request.url).search;
        return HttpResponse.json(pageOf([brewLogWithTds]));
      }),
    );

    renderWithQuery(<HomePage />);

    await waitFor(() => expect(query).not.toBe(""));
    const params = new URLSearchParams(query);
    expect(params.get("page")).toBe("0");
    expect(params.get("size")).toBe("3");
  });

  it("AC-WEBBREW-38 · 홈에서 목록으로 갈 수 있다", async () => {
    server.use(
      http.get(LIST_URL, () => HttpResponse.json(pageOf([brewLogWithTds]))),
    );

    renderWithQuery(<HomePage />);

    expect(
      await screen.findByRole("link", { name: "전체 보기" }),
    ).toHaveAttribute("href", "/brews");
  });

  it("AC-WEBBREW-39 · 기록이 없으면 홈이 레시피로 안내한다", async () => {
    server.use(http.get(LIST_URL, () => HttpResponse.json(pageOf([]))));

    renderWithQuery(<HomePage />);

    expect(await screen.findByText("아직 기록이 없습니다")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "레시피 보러 가기" }),
    ).toHaveAttribute("href", "/recipes");
  });
});
