import { describe, expect, it } from "vitest";

const WORKER_URL = "http://localhost:8787";

/**
 * WorkerSmokeTest
 *
 * <p>기존 59개 테스트는 Node + jsdom에서 돈다. 배포 대상은 workerd다. 이 스위트만이 "노드에선 되는데 Workers에선 안 되는" 부류를 잡는다.
 */
describe("WorkerSmokeTest", () => {
  it("AC-WEBDEPLOY-02 · workerd에서 /login이 200을 반환한다", async () => {
    const response = await fetch(`${WORKER_URL}/login`);

    expect(response.status).toBe(200);
  });

  it("AC-WEBDEPLOY-03 · /login 응답에 운영 redirect_uri가 담긴 카카오 인가 URL이 있다", async () => {
    const html = await (await fetch(`${WORKER_URL}/login`)).text();

    expect(html).toContain("https://kauth.kakao.com/oauth/authorize");
    expect(html).toContain(
      "redirect_uri=https%3A%2F%2Fkaldi-note.today%2Fauth%2Fcallback",
    );
  });

  it("AC-WEBDEPLOY-04 · BFF 로그인 라우트가 httpOnly refresh 쿠키를 심는다", async () => {
    const response = await fetch(`${WORKER_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "test-authorization-code" }),
    });

    expect(response.status).toBe(200);
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("kaldi_refresh=");
    expect(setCookie).toContain("HttpOnly");
  });

  it("AC-WEBDEPLOY-05 · 운영 빌드에서 그 쿠키에 Secure 속성이 붙는다", async () => {
    const response = await fetch(`${WORKER_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "test-authorization-code" }),
    });

    expect(response.headers.get("set-cookie") ?? "").toContain("Secure");
  });

  it("AC-WEBDEPLOY-06 · /가 /recipes로 리다이렉트한다", async () => {
    const response = await fetch(`${WORKER_URL}/`, { redirect: "manual" });

    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.status).toBeLessThan(400);
    expect(response.headers.get("location")).toContain("/recipes");
  });
});
