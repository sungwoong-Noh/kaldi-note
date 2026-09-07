import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import LoginPage from "./page";

// AC-GOOGLE-02가 client id를 심으므로 뒤 테스트로 새지 않게 되돌린다.
const ORIGINAL = { ...process.env };
afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("LoginPage", () => {
  it("AC-WEB-03 · 카카오 로그인이 카카오 인가 URL을 가리킨다", async () => {
    render(
      await LoginPage({
        searchParams: Promise.resolve({ next: "/recipes/1" }),
      }),
    );

    const link = screen.getByRole("link", { name: "카카오로 로그인" });
    const href = link.getAttribute("href") ?? "";

    expect(href).toContain("https://kauth.kakao.com/oauth/authorize");
    expect(href).toContain("response_type=code");
    expect(href).toContain("client_id=");
    expect(href).toContain("redirect_uri=");
    // 로그인 후 돌아갈 경로를 state로 실어 보낸다.
    expect(href).toContain(`state=${encodeURIComponent("/recipes/1")}`);
  });

  it("next가 없으면 목록으로 돌아가도록 한다", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({}) }));

    const href =
      screen
        .getByRole("link", { name: "카카오로 로그인" })
        .getAttribute("href") ?? "";

    expect(href).toContain(`state=${encodeURIComponent("/recipes")}`);
  });

  it("외부 주소를 next로 넘겨도 앱 안으로만 돌아간다", async () => {
    render(
      await LoginPage({
        searchParams: Promise.resolve({ next: "//evil.example/steal" }),
      }),
    );

    const href =
      screen
        .getByRole("link", { name: "카카오로 로그인" })
        .getAttribute("href") ?? "";

    expect(href).toContain(`state=${encodeURIComponent("/recipes")}`);
    expect(href).not.toContain("evil.example");
  });
  it("AC-GOOGLE-01 · 구글 링크가 카카오 아래에 있다", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({}) }));

    const names = screen.getAllByRole("link").map((link) => link.textContent);

    expect(names).toEqual(["카카오로 로그인", "구글로 로그인"]);
  });

  it("AC-GOOGLE-02 · 구글 인가 URL의 모양", async () => {
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = "test-google-id";

    render(
      await LoginPage({
        searchParams: Promise.resolve({ next: "/recipes/1" }),
      }),
    );

    const href =
      screen.getByRole("link", { name: "구글로 로그인" }).getAttribute("href") ??
      "";
    const url = new URL(href);

    expect(url.origin + url.pathname).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
    expect(url.searchParams.get("client_id")).toBe("test-google-id");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe("openid email profile");
    expect(url.searchParams.get("redirect_uri")).toContain(
      "/auth/callback/google",
    );
    expect(url.searchParams.get("state")).toBe("/recipes/1");
  });

  it("AC-GOOGLE-03 · next가 없으면 구글 state가 /recipes다", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({}) }));

    const href =
      screen.getByRole("link", { name: "구글로 로그인" }).getAttribute("href") ??
      "";

    expect(new URL(href).searchParams.get("state")).toBe("/recipes");
  });

  it("AC-GOOGLE-04 · 외부 주소는 구글 state에 실리지 않는다", async () => {
    render(
      await LoginPage({
        searchParams: Promise.resolve({ next: "//evil.example/steal" }),
      }),
    );

    const href =
      screen.getByRole("link", { name: "구글로 로그인" }).getAttribute("href") ??
      "";

    expect(new URL(href).searchParams.get("state")).toBe("/recipes");
    expect(href).not.toContain("evil.example");
  });
});
