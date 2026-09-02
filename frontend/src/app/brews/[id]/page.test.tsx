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

/** 실제 `GET /users/me` 응답에서 뜬 것. `brewLogWithTds.userId`와 같은 11이라 기본은 소유 상태다. */
const me = {
  id: 11,
  nickname: "테스터",
  role: "USER",
  createdAt: "2026-08-21T00:00:00Z",
};

/** 이 로그를 누가 남겼는지 바꾼다. `undefined`면 소유자 그대로다. */
function loggedBy(userId: number) {
  return http.get(DETAIL_URL, () =>
    HttpResponse.json({ ...brewLogWithTds, id: 42, recipeId: 1, userId }),
  );
}

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
    http.get(`${BASE}/users/me`, () => HttpResponse.json(me)),
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

    expect(
      await screen.findByRole("link", { name: "Kasuya 4:6" }),
    ).toHaveAttribute("href", "/recipes/1");
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

describe("BrewDetailPage — 소유 판정", () => {
  it("AC-WEBLOGEDIT-01 · 내 로그 상세에 편집 링크가 있다", async () => {
    await renderDetail();

    expect(await screen.findByRole("link", { name: "편집" })).toHaveAttribute(
      "href",
      "/brews/42/edit",
    );
  });

  it("AC-WEBLOGEDIT-02 · 남의 로그에는 편집도 삭제도 없다", async () => {
    server.use(loggedBy(99));

    await renderDetail();

    // 본문이 그려진 뒤에 부재를 본다 — 로딩 중이면 무엇이든 없다
    await screen.findByText("실측값");
    expect(
      screen.queryByRole("link", { name: "편집" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "삭제" }),
    ).not.toBeInTheDocument();
  });

  it("AC-WEBLOGEDIT-03 · 내 로그에는 삭제가 그대로 있다", async () => {
    await renderDetail();

    expect(
      await screen.findByRole("button", { name: "삭제" }),
    ).toBeInTheDocument();
  });
});
