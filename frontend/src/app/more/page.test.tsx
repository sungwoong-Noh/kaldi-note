import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession, setAccessToken } from "@/lib/session";
import { server } from "@/test/msw-server";
import { renderWithQuery } from "@/test/render";
import MorePage from "./page";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/more",
}));

const BASE = "http://localhost:8080/api/v1";
const ME_URL = `${BASE}/users/me`;
const LOGOUT_URL = "/api/auth/logout";

/** 실제 `GET /users/me` 응답에서 뜬 것. */
const me = {
  id: 11,
  nickname: "노성웅",
  email: "a@b.com",
  role: "USER" as const,
  createdAt: "2026-08-21T05:35:20.440335Z",
};

beforeEach(() => {
  push.mockClear();
  clearSession();
  setAccessToken("a.b.c");
  server.use(
    http.get(ME_URL, () => HttpResponse.json(me)),
    http.post(LOGOUT_URL, () => HttpResponse.json({ ok: true })),
  );
});

describe("MorePage", () => {
  it("AC-WEBSHELL-08 · 내 정보가 보인다", async () => {
    renderWithQuery(<MorePage />);

    expect(await screen.findByText("노성웅")).toBeInTheDocument();
    expect(screen.getByText("a@b.com")).toBeInTheDocument();
    expect(screen.getByText("2026-08-21")).toBeInTheDocument();
  });

  it("AC-WEBSHELL-09 · 이메일이 없으면 그 줄이 없다", async () => {
    // 키 자체가 없는 응답이다. `email: undefined`로는 이 상황이 재현되지 않는다.
    const withoutEmail = Object.fromEntries(
      Object.entries(me).filter(([key]) => key !== "email"),
    );
    server.use(http.get(ME_URL, () => HttpResponse.json(withoutEmail)));

    renderWithQuery(<MorePage />);

    expect(await screen.findByText("노성웅")).toBeInTheDocument();
    expect(screen.queryByText("이메일")).not.toBeInTheDocument();
  });

  it("AC-WEBSHELL-10 · 로그아웃하면 요청 한 번과 홈 이동", async () => {
    const user = userEvent.setup();
    let calls = 0;
    server.use(
      http.post(LOGOUT_URL, () => {
        calls += 1;
        return HttpResponse.json({ ok: true });
      }),
    );

    renderWithQuery(<MorePage />);
    await user.click(await screen.findByRole("button", { name: "로그아웃" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(calls).toBe(1);
  });

  it("AC-WEBSHELL-11 · 로그아웃 요청이 실패해도 홈으로 간다", async () => {
    const user = userEvent.setup();
    server.use(http.post(LOGOUT_URL, () => new HttpResponse(null, { status: 500 })));

    renderWithQuery(<MorePage />);
    await user.click(await screen.findByRole("button", { name: "로그아웃" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  });

  it("AC-WEBSHELL-12 · 환산기로 가는 링크가 있다", async () => {
    renderWithQuery(<MorePage />);

    expect(await screen.findByRole("link", { name: "분쇄도 환산기" })).toHaveAttribute(
      "href",
      "/gear/grind-converter",
    );
  });
});
