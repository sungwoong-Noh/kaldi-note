import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/msw-server";
import { POST } from "./route";

function loginRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/login (BFF)", () => {
  it("AC-WEB-05 · refreshToken은 응답 본문에 없고 httpOnly 쿠키로 나간다", async () => {
    server.use(
      http.post("http://localhost:8080/api/v1/auth/login/kakao", () =>
        HttpResponse.json({
          tokens: {
            accessToken: "a.b.c",
            refreshToken: "r.e.f",
            expiresInSeconds: 1800,
          },
          userId: 7,
          nickname: "테스터",
          newUser: false,
        }),
      ),
    );

    const response = await POST(loginRequest({ code: "test-code" }));

    const body = await response.json();
    expect(body).not.toHaveProperty("refreshToken");
    expect(body.accessToken).toBe("a.b.c");
    expect(body.userId).toBe(7);

    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("kaldi_refresh=r.e.f");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=lax");
  });

  it("백엔드에 넘기는 본문은 인가 코드만 담는다", async () => {
    let forwarded: unknown = null;
    server.use(
      http.post(
        "http://localhost:8080/api/v1/auth/login/kakao",
        async ({ request }) => {
          forwarded = await request.json();
          return HttpResponse.json({
            tokens: {
              accessToken: "a.b.c",
              refreshToken: "r.e.f",
              expiresInSeconds: 1800,
            },
            userId: 7,
            nickname: "테스터",
            newUser: false,
          });
        },
      ),
    );

    await POST(loginRequest({ code: "test-code" }));

    expect(forwarded).toEqual({ code: "test-code" });
  });

  it("백엔드가 실패하면 그 code와 상태를 그대로 전달한다", async () => {
    server.use(
      http.post("http://localhost:8080/api/v1/auth/login/kakao", () =>
        HttpResponse.json(
          {
            code: "OAUTH_TOKEN_EXCHANGE_FAILED",
            message: "소셜 로그인에 실패했습니다.",
          },
          { status: 401 },
        ),
      ),
    );

    const response = await POST(loginRequest({ code: "bad-code" }));

    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe("OAUTH_TOKEN_EXCHANGE_FAILED");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("인가 코드가 없으면 400을 돌려주고 백엔드를 부르지 않는다", async () => {
    const response = await POST(loginRequest({}));

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("INVALID_REQUEST");
  });
});
