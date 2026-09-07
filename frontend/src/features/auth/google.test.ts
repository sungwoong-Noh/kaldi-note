import { afterEach, describe, expect, it } from "vitest";
import { googleAuthorizeUrl } from "./google";

const ORIGINAL = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("googleAuthorizeUrl", () => {
  it("AC-GOOGLE-12 · 클라이언트 id가 없으면 빈 문자열이다", () => {
    delete process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

    const url = new URL(googleAuthorizeUrl("/recipes"));

    expect(url.searchParams.get("client_id")).toBe("");
  });

  it("AC-GOOGLE-13 · 리디렉션 URI 기본값은 구글 전용 콜백 경로다", () => {
    delete process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI;

    const url = new URL(googleAuthorizeUrl("/recipes"));

    expect(url.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3000/auth/callback/google",
    );
  });
});
