import { render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRequireSession } from "./useRequireSession";
import { __resetRefreshState } from "@/lib/refresh";
import { clearSession } from "@/lib/session";
import { server } from "@/test/msw-server";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/recipes",
}));

function Guarded() {
  const { ready } = useRequireSession();
  return <p>{ready ? "보호된 화면" : "확인 중"}</p>;
}

beforeEach(() => {
  replace.mockClear();
  clearSession();
  __resetRefreshState();
});

/**
 * 개발 모드(StrictMode)는 effect를 mount → cleanup → mount로 두 번 실행한다.
 *
 * <p>실제로 겪은 버그다 — 복구를 한 번만 하려고 ref로 잠갔더니 첫 실행이 잠그고 cleanup이 결과를 버린 뒤 두 번째 실행이 잠금 때문에 바로
 * 빠져나갔다. 토큰도 못 받고 로그인으로도 못 가서 화면이 빈 채로 멈췄다.
 */
describe("useRequireSession · StrictMode", () => {
  it("effect가 두 번 실행돼도 세션을 복구한다", async () => {
    server.use(
      http.post("/api/auth/refresh", () =>
        HttpResponse.json({
          accessToken: "recovered.token",
          expiresInSeconds: 1800,
        }),
      ),
    );

    render(
      <StrictMode>
        <Guarded />
      </StrictMode>,
    );

    expect(await screen.findByText("보호된 화면")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("effect가 두 번 실행돼도 복구 실패 시 로그인으로 보낸다", async () => {
    server.use(
      http.post("/api/auth/refresh", () =>
        HttpResponse.json(
          { code: "REFRESH_TOKEN_INVALID", message: "다시 로그인해 주세요." },
          { status: 401 },
        ),
      ),
    );

    render(
      <StrictMode>
        <Guarded />
      </StrictMode>,
    );

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/login?next=%2Frecipes"),
    );
  });

  it("두 번 실행돼도 refresh 요청은 한 번만 나간다", async () => {
    let calls = 0;
    server.use(
      http.post("/api/auth/refresh", () => {
        calls += 1;
        return HttpResponse.json({
          accessToken: "recovered.token",
          expiresInSeconds: 1800,
        });
      }),
    );

    render(
      <StrictMode>
        <Guarded />
      </StrictMode>,
    );

    await screen.findByText("보호된 화면");
    // 백엔드가 refresh 토큰을 회전시키므로 두 번 보내면 뒤엣것이 무효한 토큰을 쓰게 된다.
    expect(calls).toBe(1);
  });
});
