import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession, getAccessToken } from "@/lib/session";
import { server } from "@/test/msw-server";
import GoogleAuthCallbackPage from "./page";

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

describe("GoogleAuthCallbackPage", () => {
  it("AC-GOOGLE-05 · 구글 콜백은 provider를 google로 보낸다", async () => {
    let forwarded: unknown = null;
    server.use(
      http.post("/api/auth/login", async ({ request }) => {
        forwarded = await request.json();
        return HttpResponse.json(SESSION);
      }),
    );

    render(
      await GoogleAuthCallbackPage({
        searchParams: Promise.resolve({ code: "test-code", state: "/recipes" }),
      }),
    );

    await waitFor(() =>
      expect(forwarded).toEqual({ code: "test-code", provider: "google" }),
    );
  });

  it("AC-GOOGLE-06 · 성공하면 토큰을 저장하고 state 경로로 이동한다", async () => {
    server.use(http.post("/api/auth/login", () => HttpResponse.json(SESSION)));

    render(
      await GoogleAuthCallbackPage({
        searchParams: Promise.resolve({
          code: "test-code",
          state: "/recipes/1",
        }),
      }),
    );

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/recipes/1"));
    expect(getAccessToken()).toBe("a.b.c");
  });

  it("AC-GOOGLE-10 · code도 error도 없으면 기존 문구를 유지한다", async () => {
    render(await GoogleAuthCallbackPage({ searchParams: Promise.resolve({}) }));

    expect(
      screen.getByText("인가 코드가 없습니다. 다시 로그인해 주세요."),
    ).toBeInTheDocument();
  });

  it("AC-GOOGLE-11 · BFF가 실패하면 그 message를 보여준다", async () => {
    server.use(
      http.post("/api/auth/login", () =>
        HttpResponse.json(
          {
            code: "OAUTH_TOKEN_EXCHANGE_FAILED",
            message: "로그인에 실패했습니다.",
          },
          { status: 401 },
        ),
      ),
    );

    render(
      await GoogleAuthCallbackPage({
        searchParams: Promise.resolve({ code: "bad-code", state: "/recipes" }),
      }),
    );

    expect(
      await screen.findByText("로그인에 실패했습니다."),
    ).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
  it("AC-GOOGLE-08 · 취소하면 전용 문구가 뜨고 BFF를 부르지 않는다", async () => {
    let called = false;
    server.use(
      http.post("/api/auth/login", () => {
        called = true;
        return HttpResponse.json(SESSION);
      }),
    );

    render(
      await GoogleAuthCallbackPage({
        searchParams: Promise.resolve({ error: "access_denied" }),
      }),
    );

    expect(screen.getByText("로그인을 취소했습니다")).toBeInTheDocument();
    expect(called).toBe(false);
  });
});
