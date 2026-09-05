import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/msw-server";
import { POST } from "./route";

const SECRET_32 = "0123456789abcdef0123456789abcdef";

const loginPayload = {
  tokens: {
    accessToken: "a.b.c",
    refreshToken: "r.e.f",
    expiresInSeconds: 1800,
  },
  userId: 12,
  nickname: "테스터",
  newUser: false,
};

function testLoginRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/auth/test-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/test-login (BFF)", () => {
  it("AC-TESTLOGIN-19 · 시크릿을 헤더로 백엔드에 넘긴다", async () => {
    let seenHeader: string | null = null;
    let seenBody: unknown = null;
    server.use(
      http.post("http://localhost:8080/api/v1/auth/login/test", async ({ request }) => {
        seenHeader = request.headers.get("X-Test-Login-Secret");
        seenBody = await request.json();
        return HttpResponse.json(loginPayload);
      }),
    );

    await POST(testLoginRequest({ secret: SECRET_32, userId: 12 }));

    expect(seenHeader).toBe(SECRET_32);
    // 시크릿이 본문에 섞여 들어가면 안 된다.
    expect(seenBody).toEqual({ userId: 12 });
  });

  it("AC-TESTLOGIN-20 · 성공하면 refresh 쿠키를 HttpOnly로 심는다", async () => {
    server.use(
      http.post("http://localhost:8080/api/v1/auth/login/test", () =>
        HttpResponse.json(loginPayload),
      ),
    );

    const response = await POST(
      testLoginRequest({ secret: SECRET_32, userId: 12 }),
    );

    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("kaldi_refresh=r.e.f");
    expect(setCookie).toContain("HttpOnly");
    expect(await response.json()).not.toHaveProperty("secret");
  });

  it("AC-TESTLOGIN-21 · 404면 쿠키를 심지 않고 그대로 넘긴다", async () => {
    server.use(
      http.post("http://localhost:8080/api/v1/auth/login/test", () =>
        HttpResponse.json(
          {
            code: "ENDPOINT_NOT_FOUND",
            message: "요청하신 주소를 찾을 수 없습니다.",
          },
          { status: 404 },
        ),
      ),
    );

    const response = await POST(
      testLoginRequest({ secret: "wrong", userId: 12 }),
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
