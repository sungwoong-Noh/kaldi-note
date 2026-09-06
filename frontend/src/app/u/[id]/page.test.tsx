import { screen, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FollowStatus } from "@/features/user/queries";
import { clearSession, setAccessToken } from "@/lib/session";
import { server } from "@/test/msw-server";
import { renderWithQuery } from "@/test/render";
import UserProfilePage from "./page";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, refresh: vi.fn() }),
  usePathname: () => "/u/12",
}));

const BASE = "http://localhost:8080/api/v1";

/** 실제 `GET /users/me` 응답에서 뜬 것. */
const me = {
  id: 11,
  nickname: "노성웅",
  role: "USER",
  createdAt: "2026-08-21T00:00:00Z",
};

/** 백엔드 `PublicProfileResponse`는 세 필드가 전부다. */
const friendProfile = { id: 12, nickname: "확인용친구" };
const myProfile = { id: 11, nickname: "노성웅" };

const status = (s: Partial<FollowStatus>): FollowStatus => ({
  following: false,
  followedBy: false,
  mutual: false,
  ...s,
});

function renderProfile(id: number) {
  return UserProfilePage({ params: Promise.resolve({ id: String(id) }) }).then(
    (ui) => renderWithQuery(ui),
  );
}

beforeEach(() => {
  push.mockClear();
  replace.mockClear();
  clearSession();
  setAccessToken("a.b.c");
  server.use(http.get(`${BASE}/users/me`, () => HttpResponse.json(me)));
});

describe("UserProfilePage", () => {
  it("AC-WEBFOLLOW-06 · 관계가 없으면 팔로우 버튼만 있다", async () => {
    server.use(
      http.get(`${BASE}/users/12`, () => HttpResponse.json(friendProfile)),
      http.get(`${BASE}/users/12/follow`, () => HttpResponse.json(status({}))),
    );

    await renderProfile(12);

    expect(
      await screen.findByRole("button", { name: "팔로우" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("나를 팔로우하고 있습니다"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("맞팔로우 — 서로의 기록이 보입니다"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("상대도 나를 팔로우하면 서로의 기록이 보입니다"),
    ).not.toBeInTheDocument();
  });

  it("AC-WEBFOLLOW-07 · 나만 팔로우 중이면 기다리는 중임을 알린다", async () => {
    server.use(
      http.get(`${BASE}/users/12`, () => HttpResponse.json(friendProfile)),
      http.get(`${BASE}/users/12/follow`, () =>
        HttpResponse.json(status({ following: true })),
      ),
    );

    await renderProfile(12);

    expect(
      await screen.findByRole("button", { name: "팔로우 취소" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("상대도 나를 팔로우하면 서로의 기록이 보입니다"),
    ).toBeInTheDocument();
  });

  it("AC-WEBFOLLOW-08 · 상대만 나를 팔로우하면 그렇게 말한다", async () => {
    server.use(
      http.get(`${BASE}/users/12`, () => HttpResponse.json(friendProfile)),
      http.get(`${BASE}/users/12/follow`, () =>
        HttpResponse.json(status({ followedBy: true })),
      ),
    );

    await renderProfile(12);

    expect(
      await screen.findByRole("button", { name: "팔로우" }),
    ).toBeInTheDocument();
    expect(screen.getByText("나를 팔로우하고 있습니다")).toBeInTheDocument();
  });

  it("AC-WEBFOLLOW-09 · 맞팔로우면 서로 보인다고 말한다", async () => {
    server.use(
      http.get(`${BASE}/users/12`, () => HttpResponse.json(friendProfile)),
      http.get(`${BASE}/users/12/follow`, () =>
        HttpResponse.json(
          status({ following: true, followedBy: true, mutual: true }),
        ),
      ),
    );

    await renderProfile(12);

    expect(
      await screen.findByRole("button", { name: "팔로우 취소" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("맞팔로우 — 서로의 기록이 보입니다"),
    ).toBeInTheDocument();
  });

  it("AC-WEBFOLLOW-10 · 내 프로필엔 버튼이 없고 상태를 조회하지 않는다", async () => {
    // 백엔드는 자기 자신의 상태 조회에 400을 낸다. 부르지 않는 것이 이 조건의 핵심이다.
    let statusCalls = 0;
    server.use(
      http.get(`${BASE}/users/11`, () => HttpResponse.json(myProfile)),
      http.get(`${BASE}/users/11/follow`, () => {
        statusCalls += 1;
        return HttpResponse.json(status({}));
      }),
    );

    await renderProfile(11);

    expect(await screen.findByText("나")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "팔로우" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "팔로우 취소" }),
    ).not.toBeInTheDocument();
    expect(statusCalls).toBe(0);
  });

  it("AC-WEBFOLLOW-17 · 없는 사용자는 못 찾았다고 말한다", async () => {
    server.use(
      http.get(`${BASE}/users/999`, () =>
        HttpResponse.json(
          { code: "NOT_FOUND", message: "대상을 찾을 수 없습니다." },
          { status: 404 },
        ),
      ),
    );

    await renderProfile(999);

    expect(
      await screen.findByText("사용자를 찾을 수 없습니다"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "팔로우" }),
    ).not.toBeInTheDocument();
  });

  it("AC-WEBFOLLOW-18 · 로그인하지 않았으면 로그인으로 보낸다", async () => {
    clearSession();
    server.use(
      http.post("/api/auth/refresh", () => new HttpResponse(null, { status: 401 })),
    );

    await renderProfile(12);

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/login?next=%2Fu%2F12"),
    );
  });
});
