import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession } from "@/lib/session";
import { server } from "@/test/msw-server";
import TestLoginPage from "./page";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
}));

const SECRET_32 = "0123456789abcdef0123456789abcdef";

beforeEach(() => {
  replace.mockClear();
  clearSession();
  localStorage.clear();
  sessionStorage.clear();
});

describe("TestLoginPage", () => {
  it("AC-TESTLOGIN-18 · 입력칸과 버튼이 있다", () => {
    render(<TestLoginPage />);

    expect(screen.getByLabelText("테스트 시크릿")).toBeInTheDocument();
    expect(screen.getByLabelText("사용자 id")).toBeInTheDocument();
    expect(screen.getByLabelText("핸들")).toBeInTheDocument();
    expect(screen.getByLabelText("닉네임")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "테스트 로그인" }),
    ).toBeInTheDocument();
  });

  it("AC-TESTLOGIN-20 · 성공하면 홈으로 간다", async () => {
    server.use(
      http.post("/api/auth/test-login", () =>
        HttpResponse.json({
          accessToken: "a.b.c",
          expiresInSeconds: 1800,
          userId: 12,
          nickname: "확인용친구",
          newUser: false,
        }),
      ),
    );

    render(<TestLoginPage />);
    await userEvent.type(screen.getByLabelText("테스트 시크릿"), SECRET_32);
    await userEvent.type(screen.getByLabelText("사용자 id"), "12");
    await userEvent.click(
      screen.getByRole("button", { name: "테스트 로그인" }),
    );

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  });

  it("AC-TESTLOGIN-21 · 실패하면 문구를 보여준다", async () => {
    server.use(
      http.post("/api/auth/test-login", () =>
        HttpResponse.json(
          {
            code: "ENDPOINT_NOT_FOUND",
            message: "요청하신 주소를 찾을 수 없습니다.",
          },
          { status: 404 },
        ),
      ),
    );

    render(<TestLoginPage />);
    await userEvent.type(screen.getByLabelText("테스트 시크릿"), "wrong");
    await userEvent.type(screen.getByLabelText("사용자 id"), "12");
    await userEvent.click(
      screen.getByRole("button", { name: "테스트 로그인" }),
    );

    expect(
      await screen.findByText("테스트 로그인을 쓸 수 없습니다"),
    ).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
