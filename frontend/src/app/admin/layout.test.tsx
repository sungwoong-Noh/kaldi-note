import { readFileSync } from "node:fs";
import { join } from "node:path";
import { screen } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession, setAccessToken } from "@/lib/session";
import { server } from "@/test/msw-server";
import { renderWithQuery } from "@/test/render";
import AdminLayout from "./layout";
import AdminPage from "./page";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  usePathname: () => "/admin/crawl",
}));

const ME_URL = "http://localhost:8080/api/v1/users/me";
/** 2026-10-19 로컬 실제 `GET /users/me` (crawler-admin). email·profileImageUrl 키가 없다. */
const admin = {
  id: 16,
  nickname: "크롤러관리자",
  role: "ADMIN",
  createdAt: "2026-10-14T11:45:15.602628Z",
};

const adminCalls: string[] = [];

beforeEach(() => {
  replace.mockClear();
  adminCalls.length = 0;
  clearSession();
  setAccessToken("a.b.c");
  server.events.removeAllListeners();
  server.events.on("request:start", ({ request }) => {
    if (request.url.includes("/api/v1/admin")) adminCalls.push(request.url);
  });
});

describe("AdminLayout", () => {
  it("ADMIN이면 관리자 상단 바·메뉴와 본문을 그린다", async () => {
    server.use(http.get(ME_URL, () => HttpResponse.json(admin)));
    renderWithQuery(
      <AdminLayout>
        <p>본문</p>
      </AdminLayout>,
    );

    expect(await screen.findByText("본문")).toBeInTheDocument();
    expect(screen.getByText("관리자")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "원두 수집" })).toHaveAttribute(
      "href",
      "/admin/crawl",
    );
    expect(
      screen.getByRole("link", { name: "앱으로 돌아가기" }),
    ).toHaveAttribute("href", "/");
  });

  it("AC-ADMIN-30 · USER면 403 화면이고 admin API를 부르지 않는다", async () => {
    server.use(
      http.get(ME_URL, () => HttpResponse.json({ ...admin, role: "USER" })),
    );
    renderWithQuery(
      <AdminLayout>
        <p>본문</p>
      </AdminLayout>,
    );

    expect(
      await screen.findByText(
        "관리자 권한이 있는 계정만 볼 수 있는 화면입니다.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("403 · /admin")).toBeInTheDocument();
    expect(screen.queryByText("본문")).not.toBeInTheDocument();
    expect(screen.queryByText("관리자")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "앱으로 돌아가기" }),
    ).toHaveAttribute("href", "/");
    expect(adminCalls).toEqual([]);
  });
});

describe("AdminPage", () => {
  it("AC-ADMIN-13 · /admin은 /admin/crawl로 replace", () => {
    renderWithQuery(<AdminPage />);
    expect(replace).toHaveBeenCalledExactlyOnceWith("/admin/crawl");
  });
});

describe("tokens", () => {
  it("AC-ADMIN-42 · 관리자 전용 --a- 토큰을 만들지 않는다", () => {
    const css = readFileSync(
      join(process.cwd(), "src/app/globals.css"),
      "utf8",
    );
    expect(css).not.toMatch(/--a-[a-z]/);
  });
});
