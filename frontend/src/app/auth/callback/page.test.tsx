import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession, getAccessToken } from "@/lib/session";
import { server } from "@/test/msw-server";
import AuthCallbackPage from "./page";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
}));

const SESSION = {
  accessToken: "a.b.c",
  expiresInSeconds: 1800,
  userId: 7,
  nickname: "테스터",
  newUser: false,
};

beforeEach(() => {
  replace.mockClear();
  clearSession();
  localStorage.clear();
  sessionStorage.clear();
});

describe("AuthCallbackPage", () => {
  it("AC-WEB-04 · 인가코드를 BFF에 넘기고 원래 경로로 돌아간다", async () => {
    let forwarded: unknown = null;
    server.use(
      http.post("/api/auth/login", async ({ request }) => {
        forwarded = await request.json();
        return HttpResponse.json(SESSION);
      }),
    );

    render(
      await AuthCallbackPage({
        searchParams: Promise.resolve({
          code: "test-code",
          state: "/recipes/1",
        }),
      }),
    );

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/recipes/1"));
    expect(forwarded).toEqual({ code: "test-code" });
  });

  it("AC-WEB-06 · accessToken을 브라우저 저장소에 쓰지 않는다", async () => {
    server.use(http.post("/api/auth/login", () => HttpResponse.json(SESSION)));

    render(
      await AuthCallbackPage({
        searchParams: Promise.resolve({ code: "test-code", state: "/recipes" }),
      }),
    );

    await waitFor(() => expect(getAccessToken()).toBe("a.b.c"));

    const stored = [
      ...Object.entries({ ...localStorage }).flat(),
      ...Object.entries({ ...sessionStorage }).flat(),
    ].join("|");
    expect(stored).not.toContain("a.b.c");
  });

  it("로그인에 실패하면 백엔드 메시지를 보여준다", async () => {
    server.use(
      http.post("/api/auth/login", () =>
        HttpResponse.json(
          {
            code: "OAUTH_TOKEN_EXCHANGE_FAILED",
            message: "소셜 로그인에 실패했습니다.",
          },
          { status: 401 },
        ),
      ),
    );

    render(
      await AuthCallbackPage({
        searchParams: Promise.resolve({ code: "bad-code", state: "/recipes" }),
      }),
    );

    expect(
      await screen.findByText("소셜 로그인에 실패했습니다."),
    ).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("인가 코드가 없으면 안내를 보여준다", async () => {
    render(await AuthCallbackPage({ searchParams: Promise.resolve({}) }));

    expect(await screen.findByText(/인가 코드가 없습니다/)).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
