import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RecipesPage from "./page";
import { clearSession, setAccessToken } from "@/lib/session";
import {
  hoffmannSummary,
  kasuyaSummary,
  pageOf,
  summaries,
} from "@/test/fixtures";
import { renderWithQuery } from "@/test/render";
import { server } from "@/test/msw-server";

const replace = vi.fn();
let currentSearch = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/recipes",
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

const LIST_URL = "http://localhost:8080/api/v1/recipes";

beforeEach(() => {
  replace.mockClear();
  currentSearch = "";
  clearSession();
  setAccessToken("a.b.c");
});

describe("RecipesPage", () => {
  it("AC-RECIPESBREWS-58 · 쿼리 없이 진입하면 내 서랍이 기본이고 scope=DRAWER로 조회한다", async () => {
    const searches: string[] = [];
    server.use(
      http.get(LIST_URL, ({ request }) => {
        searches.push(new URL(request.url).search);
        return HttpResponse.json(pageOf([hoffmannSummary]));
      }),
    );

    renderWithQuery(<RecipesPage />);

    expect(
      await screen.findByRole("tab", { name: "내 서랍", selected: true }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(searches.at(-1)).toContain("scope=DRAWER"),
    );
  });

  it("AC-RECIPESBREWS-65 · 검색어·온도·정렬이 URL 쿼리로 동기화된다", async () => {
    server.use(
      http.get(LIST_URL, () => HttpResponse.json(pageOf([hoffmannSummary]))),
    );
    const user = userEvent.setup();

    renderWithQuery(<RecipesPage />);

    await user.click(await screen.findByRole("tab", { name: "둘러보기" }));
    await user.type(await screen.findByLabelText("레시피 검색"), "워시드");
    await user.click(screen.getByRole("button", { name: "Hot" }));
    await user.click(screen.getByRole("button", { name: "최신순" }));

    await waitFor(() => {
      const last = replace.mock.calls.at(-1)?.[0] as string;
      expect(decodeURIComponent(last)).toBe(
        "/recipes?scope=PUBLIC&q=워시드&temp=HOT&sort=RECENT",
      );
    });
  });

  it("AC-RECIPESBREWS-67 · '더 보기'로 불러온 페이지 depth는 URL에 반영되지 않는다", async () => {
    server.use(
      http.get(LIST_URL, ({ request }) => {
        const page = Number(
          new URL(request.url).searchParams.get("page") ?? "0",
        );
        return HttpResponse.json(
          page === 0
            ? pageOf(summaries(20, 100), { page: 0, hasNext: true })
            : pageOf(summaries(20, 200), { page: 1, hasNext: false }),
        );
      }),
    );

    renderWithQuery(<RecipesPage />);
    await userEvent.click(
      await screen.findByRole("button", { name: "더 보기" }),
    );

    await waitFor(() =>
      expect(screen.getAllByRole("link", { name: /^레시피 \d+/ })).toHaveLength(
        40,
      ),
    );
    // "더 보기"를 눌러도 router.replace는 한 번도 호출되지 않는다 — page는 URL에 없다.
    expect(replace).not.toHaveBeenCalled();
  });

  it("AC-RECIPESBREWS-68 · 필터가 바뀌면 누적된 페이지가 사라지고 처음부터 다시 불러온다", async () => {
    let calls = 0;
    server.use(
      http.get(LIST_URL, ({ request }) => {
        calls += 1;
        const url = new URL(request.url);
        const page = Number(url.searchParams.get("page") ?? "0");
        if (url.searchParams.get("scope") === "PUBLIC") {
          return HttpResponse.json(pageOf([kasuyaSummary]));
        }
        return HttpResponse.json(
          page === 0
            ? pageOf(summaries(20, 100), { page: 0, hasNext: true })
            : pageOf(summaries(20, 200), { page: 1, hasNext: false }),
        );
      }),
    );
    const user = userEvent.setup();

    renderWithQuery(<RecipesPage />);
    await userEvent.click(
      await screen.findByRole("button", { name: "더 보기" }),
    );
    await waitFor(() =>
      expect(screen.getAllByRole("link", { name: /^레시피 \d+/ })).toHaveLength(
        40,
      ),
    );
    const callsBeforeSwitch = calls;

    await user.click(await screen.findByRole("tab", { name: "둘러보기" }));

    await screen.findByText("Tetsu Kasuya 4:6 Method");
    expect(
      screen.queryAllByRole("link", { name: /^레시피 \d+/ }),
    ).toHaveLength(0);
    expect(calls).toBeGreaterThan(callsBeforeSwitch);
  });

  it("AC-WEB-10 · hasNext가 true면 더 보기 버튼이 있다", async () => {
    server.use(
      http.get(LIST_URL, () =>
        HttpResponse.json(
          pageOf(summaries(20), { hasNext: true, totalElements: 40 }),
        ),
      ),
    );

    renderWithQuery(<RecipesPage />);

    expect(
      await screen.findByRole("button", { name: "더 보기" }),
    ).toBeInTheDocument();
  });

  it("AC-WEB-11 · hasNext가 false면 더 보기 버튼이 없다", async () => {
    server.use(
      http.get(LIST_URL, () =>
        HttpResponse.json(pageOf([hoffmannSummary, kasuyaSummary])),
      ),
    );

    renderWithQuery(<RecipesPage />);

    await screen.findByText("James Hoffmann Ultimate V60");
    expect(
      screen.queryByRole("button", { name: "더 보기" }),
    ).not.toBeInTheDocument();
  });

  it("AC-WEB-12 · 더 보기가 다음 페이지를 뒤에 이어붙인다", async () => {
    server.use(
      http.get(LIST_URL, ({ request }) => {
        const page = Number(
          new URL(request.url).searchParams.get("page") ?? "0",
        );
        return HttpResponse.json(
          page === 0
            ? pageOf(summaries(20, 100), {
                page: 0,
                hasNext: true,
                totalElements: 40,
              })
            : pageOf(summaries(20, 200), {
                page: 1,
                hasNext: false,
                totalElements: 40,
              }),
        );
      }),
    );

    renderWithQuery(<RecipesPage />);

    await userEvent.click(
      await screen.findByRole("button", { name: "더 보기" }),
    );

    // 레시피 카드만 센다. 상단의 "새 레시피" 링크는 목록 항목이 아니다.
    await waitFor(() =>
      expect(screen.getAllByRole("link", { name: /^레시피 \d+/ })).toHaveLength(
        40,
      ),
    );
    expect(
      screen.queryByRole("button", { name: "더 보기" }),
    ).not.toBeInTheDocument();
    // 첫 페이지 항목이 그대로 남아 있어야 한다. 갈아치우면 안 된다.
    expect(screen.getByText("레시피 100")).toBeInTheDocument();
    expect(screen.getByText("레시피 200")).toBeInTheDocument();
  });

  it("AC-WEB-13 · 볼 레시피가 없으면 안내를 보여준다", async () => {
    server.use(http.get(LIST_URL, () => HttpResponse.json(pageOf([]))));

    renderWithQuery(<RecipesPage />);

    expect(await screen.findByText("레시피가 없습니다")).toBeInTheDocument();
  });

  it("AC-WEB-07 · 401을 받으면 refresh 후 목록을 보여준다", async () => {
    let listCalls = 0;
    server.use(
      http.get(LIST_URL, () => {
        listCalls += 1;
        return listCalls === 1
          ? HttpResponse.json(
              { code: "UNAUTHORIZED", message: "인증이 필요합니다." },
              { status: 401 },
            )
          : HttpResponse.json(pageOf([hoffmannSummary]));
      }),
      http.post("/api/auth/refresh", () =>
        HttpResponse.json({ accessToken: "new.token", expiresInSeconds: 1800 }),
      ),
    );

    renderWithQuery(<RecipesPage />);

    expect(
      await screen.findByText("James Hoffmann Ultimate V60"),
    ).toBeInTheDocument();
    expect(listCalls).toBe(2);
  });

  it("AC-WEB-08 · refresh가 무효면 로그인으로 보낸다", async () => {
    server.use(
      http.get(LIST_URL, () =>
        HttpResponse.json(
          { code: "UNAUTHORIZED", message: "인증이 필요합니다." },
          { status: 401 },
        ),
      ),
      http.post("/api/auth/refresh", () =>
        HttpResponse.json(
          { code: "REFRESH_TOKEN_INVALID", message: "다시 로그인해 주세요." },
          { status: 401 },
        ),
      ),
    );

    renderWithQuery(<RecipesPage />);

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/login?next=%2Frecipes"),
    );
  });

  it("목록 조회가 실패하면 메시지와 다시 시도를 보여준다", async () => {
    server.use(
      http.get(LIST_URL, () =>
        HttpResponse.json(
          { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
          { status: 500 },
        ),
      ),
    );

    renderWithQuery(<RecipesPage />);

    expect(
      await screen.findByText("서버 오류가 발생했습니다."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "다시 시도" }),
    ).toBeInTheDocument();
  });
});

describe("RecipesPage — 쓰기 슬라이스", () => {
  it("AC-WEBEDIT-04 · 목록 상단에서 생성 화면으로 갈 수 있다", async () => {
    server.use(
      http.get(LIST_URL, () => HttpResponse.json(pageOf([hoffmannSummary]))),
    );

    renderWithQuery(<RecipesPage />);

    expect(
      await screen.findByRole("link", { name: "새 레시피" }),
    ).toHaveAttribute("href", "/recipes/new");
  });
});
