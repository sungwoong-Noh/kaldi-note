import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LoginPage from "./page";

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
});
