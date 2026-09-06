import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRequireSession } from "./useRequireSession";
import { __resetRefreshState } from "@/lib/refresh";
import { clearSession, getAccessToken, setAccessToken } from "@/lib/session";
import { server } from "@/test/msw-server";

const replace = vi.fn();
let pathname = "/recipes";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => pathname,
}));

function Guarded() {
  const { ready } = useRequireSession();
  return <p>{ready ? "보호된 화면" : "확인 중"}</p>;
}

beforeEach(() => {
  replace.mockClear();
  clearSession();
  __resetRefreshState();
  pathname = "/recipes";
});

describe("useRequireSession", () => {
  it("AC-WEB-01 · 미인증으로 목록에 접근하면 로그인으로 보낸다", async () => {
    server.use(
      http.post("/api/auth/refresh", () =>
        HttpResponse.json(
          { code: "REFRESH_TOKEN_INVALID", message: "다시 로그인해 주세요." },
          { status: 401 },
        ),
      ),
    );

    render(<Guarded />);

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/login?next=%2Frecipes"),
    );
  });

  it("AC-WEB-02 · 미인증으로 상세에 접근하면 경로를 보존해 로그인으로 보낸다", async () => {
    pathname = "/recipes/1";
    server.use(
      http.post("/api/auth/refresh", () =>
        HttpResponse.json(
          { code: "REFRESH_TOKEN_INVALID", message: "다시 로그인해 주세요." },
          { status: 401 },
        ),
      ),
    );

    render(<Guarded />);

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/login?next=%2Frecipes%2F1"),
    );
  });

  it("새로고침으로 토큰이 사라져도 쿠키가 살아 있으면 조용히 복구된다", async () => {
    server.use(
      http.post("/api/auth/refresh", () =>
        HttpResponse.json({
          accessToken: "recovered.token",
          expiresInSeconds: 1800,
        }),
      ),
    );

    render(<Guarded />);

    expect(await screen.findByText("보호된 화면")).toBeInTheDocument();
    expect(getAccessToken()).toBe("recovered.token");
    expect(replace).not.toHaveBeenCalled();
  });

  it("토큰이 있으면 refresh 없이 바로 화면을 그린다", () => {
    setAccessToken("a.b.c");

    render(<Guarded />);

    expect(screen.getByText("보호된 화면")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("AC-PWA-14 · refresh가 401이면 로그인으로 보낸다", async () => {
    pathname = "/recipes/2";
    server.use(
      http.post("/api/auth/refresh", () => new HttpResponse(null, { status: 401 })),
    );

    render(<Guarded />);

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/login?next=%2Frecipes%2F2"),
    );
  });

  it("AC-PWA-13 · refresh가 네트워크로 실패하면 로그인으로 보내지 않는다", async () => {
    // 오프라인이다. 인증이 끊긴 것이 아니므로 토큰 없이도 화면을 그려야
    // Service Worker가 캐시된 응답을 내줄 수 있다.
    pathname = "/recipes/2";
    server.use(http.post("/api/auth/refresh", () => HttpResponse.error()));

    render(<Guarded />);

    expect(await screen.findByText("보호된 화면")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
