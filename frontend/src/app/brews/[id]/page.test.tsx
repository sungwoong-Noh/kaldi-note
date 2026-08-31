import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession, setAccessToken } from "@/lib/session";
import {
  brewLogWithoutTds,
  brewLogWithTds,
  grindedRecipe,
} from "@/test/fixtures";
import { server } from "@/test/msw-server";
import { renderWithQuery } from "@/test/render";
import BrewDetailPage from "./page";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, refresh: vi.fn() }),
  usePathname: () => "/brews/42",
}));

const BASE = "http://localhost:8080/api/v1";
const DETAIL_URL = `${BASE}/brew-logs/42`;

function renderDetail() {
  return BrewDetailPage({ params: Promise.resolve({ id: "42" }) }).then((ui) =>
    renderWithQuery(ui),
  );
}

beforeEach(() => {
  push.mockClear();
  replace.mockClear();
  clearSession();
  setAccessToken("a.b.c");
  server.use(
    http.get(DETAIL_URL, () =>
      HttpResponse.json({ ...brewLogWithTds, id: 42, recipeId: 1 }),
    ),
    http.get(`${BASE}/recipes/1`, () =>
      HttpResponse.json({ ...grindedRecipe, id: 1, title: "Kasuya 4:6" }),
    ),
  );
});

describe("BrewDetailPage", () => {
  it("AC-WEBBREW-40 · 실측값이 서버 값 그대로 보인다", async () => {
    await renderDetail();

    expect(await screen.findByText("20.0g")).toBeInTheDocument();
    expect(screen.getByText("300.0g")).toBeInTheDocument();
    expect(screen.getByText("92°C")).toBeInTheDocument();
  });

  it("AC-WEBBREW-41 · TDS가 있으면 추출 분석이 보인다", async () => {
    server.use(
      http.get(DETAIL_URL, () =>
        HttpResponse.json({
          ...brewLogWithTds,
          id: 42,
          recipeId: 1,
          tdsPercent: 1.35,
          extractionYieldPercent: 20.5,
          strengthZone: "IDEAL",
          extractionZone: "IDEAL",
          diagnosis: "균형 있는 추출입니다",
        }),
      ),
    );

    await renderDetail();

    expect(await screen.findByText("20.5 %")).toBeInTheDocument();
    expect(screen.getByText("균형 있는 추출입니다")).toBeInTheDocument();
  });

  it("AC-WEBBREW-42 · TDS가 없으면 추출 분석 영역이 아예 없다", async () => {
    server.use(
      http.get(DETAIL_URL, () =>
        HttpResponse.json({ ...brewLogWithoutTds, id: 42, recipeId: 1 }),
      ),
    );

    await renderDetail();

    expect(await screen.findByText("20.0g")).toBeInTheDocument();
    expect(screen.queryByText("추출 분석")).not.toBeInTheDocument();
  });

  it("AC-WEBBREW-43 · 어떤 레시피로 내렸는지 링크된다", async () => {
    await renderDetail();

    expect(await screen.findByRole("link", { name: "Kasuya 4:6" })).toHaveAttribute(
      "href",
      "/recipes/1",
    );
  });

  it("AC-WEBBREW-44 · 삭제를 확인하면 요청 후 목록으로 간다", async () => {
    const user = userEvent.setup();
    let deletes = 0;
    server.use(
      http.delete(DETAIL_URL, () => {
        deletes += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await renderDetail();
    await user.click(await screen.findByRole("button", { name: "삭제" }));
    await user.click(screen.getByRole("button", { name: "삭제합니다" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/brews"));
    expect(deletes).toBe(1);
  });

  it("AC-WEBBREW-45 · 삭제를 취소하면 아무 요청도 나가지 않는다", async () => {
    const user = userEvent.setup();
    let deletes = 0;
    server.use(
      http.delete(DETAIL_URL, () => {
        deletes += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await renderDetail();
    await user.click(await screen.findByRole("button", { name: "삭제" }));
    await user.click(screen.getByRole("button", { name: "취소" }));

    expect(deletes).toBe(0);
    expect(push).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: "삭제합니다" }),
    ).not.toBeInTheDocument();
  });
});
