import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ApiError } from "./api-client";
import { authedRequest, __resetRefreshState } from "./authed-fetch";
import { clearSession, getAccessToken, setAccessToken } from "./session";
import { server } from "@/test/msw-server";

const onSessionLost = vi.fn();
const schema = z.object({ ok: z.boolean() });

beforeEach(() => {
  clearSession();
  __resetRefreshState();
  onSessionLost.mockClear();
  setAccessToken("old.token");
});

function get() {
  return authedRequest("http://localhost:8080/api/v1/recipes", {
    schema,
    onSessionLost,
  });
}

describe("authedRequest", () => {
  it("AC-WEB-07 · 401을 받으면 refresh를 1회 하고 원 요청을 재시도한다", async () => {
    let listCalls = 0;
    let refreshCalls = 0;
    server.use(
      http.get("http://localhost:8080/api/v1/recipes", () => {
        listCalls += 1;
        return listCalls === 1
          ? HttpResponse.json(
              { code: "UNAUTHORIZED", message: "인증이 필요합니다." },
              { status: 401 },
            )
          : HttpResponse.json({ ok: true });
      }),
      http.post("/api/auth/refresh", () => {
        refreshCalls += 1;
        return HttpResponse.json({
          accessToken: "new.token",
          expiresInSeconds: 1800,
        });
      }),
    );

    await expect(get()).resolves.toEqual({ ok: true });

    expect(refreshCalls).toBe(1);
    expect(listCalls).toBe(2);
    expect(getAccessToken()).toBe("new.token");
    expect(onSessionLost).not.toHaveBeenCalled();
  });

  it("AC-WEB-08 · refresh가 무효면 재시도 없이 세션을 버린다", async () => {
    let listCalls = 0;
    server.use(
      http.get("http://localhost:8080/api/v1/recipes", () => {
        listCalls += 1;
        return HttpResponse.json(
          { code: "UNAUTHORIZED", message: "인증이 필요합니다." },
          { status: 401 },
        );
      }),
      http.post("/api/auth/refresh", () =>
        HttpResponse.json(
          { code: "REFRESH_TOKEN_INVALID", message: "다시 로그인해 주세요." },
          { status: 401 },
        ),
      ),
    );

    await expect(get()).rejects.toBeInstanceOf(ApiError);

    expect(listCalls).toBe(1);
    expect(onSessionLost).toHaveBeenCalledTimes(1);
    expect(getAccessToken()).toBeNull();
  });

  it("동시에 401을 받아도 refresh는 한 번만 나간다", async () => {
    let refreshCalls = 0;
    const seen = new Set<string>();
    server.use(
      http.get("http://localhost:8080/api/v1/recipes", ({ request }) => {
        const token = request.headers.get("Authorization") ?? "";
        // 같은 토큰으로 온 첫 요청만 401을 준다. 갱신 후에는 통과시킨다.
        if (token.includes("old.token")) {
          seen.add(token);
          return HttpResponse.json(
            { code: "UNAUTHORIZED", message: "인증이 필요합니다." },
            { status: 401 },
          );
        }
        return HttpResponse.json({ ok: true });
      }),
      http.post("/api/auth/refresh", () => {
        refreshCalls += 1;
        return HttpResponse.json({
          accessToken: "new.token",
          expiresInSeconds: 1800,
        });
      }),
    );

    await Promise.all([get(), get(), get()]);

    expect(refreshCalls).toBe(1);
  });

  it("401이 아닌 에러는 그대로 던진다", async () => {
    let refreshCalls = 0;
    server.use(
      http.get("http://localhost:8080/api/v1/recipes", () =>
        HttpResponse.json(
          { code: "FORBIDDEN", message: "권한이 없습니다." },
          { status: 403 },
        ),
      ),
      http.post("/api/auth/refresh", () => {
        refreshCalls += 1;
        return HttpResponse.json({
          accessToken: "new.token",
          expiresInSeconds: 1800,
        });
      }),
    );

    await expect(get()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(refreshCalls).toBe(0);
  });

  it("Authorization 헤더에 현재 accessToken을 싣는다", async () => {
    let seenToken: string | null = null;
    server.use(
      http.get("http://localhost:8080/api/v1/recipes", ({ request }) => {
        seenToken = request.headers.get("Authorization");
        return HttpResponse.json({ ok: true });
      }),
    );

    await get();

    expect(seenToken).toBe("Bearer old.token");
  });
});
