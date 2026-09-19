import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RecipeListScreen } from "@/features/recipe/components/RecipeListScreen";
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
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/recipes",
}));

/**
 * 화면은 쿼리를 직접 읽지 않는다 — 서버 컴포넌트(`page.tsx`)가 풀어 prop으로 넘긴다.
 * 클라이언트에서 `useSearchParams`를 쓰면 Suspense 경계를 요구해 프리렌더가 깨진다
 * (2026-09-17에 겪었다).
 */
const NO_GRIND = {} as const;

const LIST_URL = "http://localhost:8080/api/v1/recipes";

beforeEach(() => {
  replace.mockClear();
  clearSession();
  setAccessToken("a.b.c");
});

describe("RecipeListScreen", () => {
  it("AC-WEB-09 · 카드에 추출 파라미터가 표시된다", async () => {
    server.use(
      http.get(LIST_URL, () => HttpResponse.json(pageOf([hoffmannSummary]))),
    );

    renderWithQuery(<RecipeListScreen grind={NO_GRIND} />);

    expect(
      await screen.findByText("James Hoffmann Ultimate V60"),
    ).toBeInTheDocument();
    expect(screen.getByText("30.0g")).toBeInTheDocument();
    expect(screen.getByText("500.0g")).toBeInTheDocument();
    expect(screen.getByText("1:16.7")).toBeInTheDocument();
    expect(screen.getByText("100°C")).toBeInTheDocument();
    expect(screen.getByText("3:30")).toBeInTheDocument();
  });

  it("AC-WEB-10 · hasNext가 true면 더 보기 버튼이 있다", async () => {
    server.use(
      http.get(LIST_URL, () =>
        HttpResponse.json(
          pageOf(summaries(20), { hasNext: true, totalElements: 40 }),
        ),
      ),
    );

    renderWithQuery(<RecipeListScreen grind={NO_GRIND} />);

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

    renderWithQuery(<RecipeListScreen grind={NO_GRIND} />);

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

    renderWithQuery(<RecipeListScreen grind={NO_GRIND} />);

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

    renderWithQuery(<RecipeListScreen grind={NO_GRIND} />);

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

    renderWithQuery(<RecipeListScreen grind={NO_GRIND} />);

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

    renderWithQuery(<RecipeListScreen grind={NO_GRIND} />);

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

    renderWithQuery(<RecipeListScreen grind={NO_GRIND} />);

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

    renderWithQuery(<RecipeListScreen grind={NO_GRIND} />);

    expect(
      await screen.findByRole("link", { name: "새 레시피" }),
    ).toHaveAttribute("href", "/recipes/new");
  });

  it("AC-WEBEDIT-05 · '내 레시피만'을 켜면 ownerUserId를 붙여 다시 부른다", async () => {
    const user = userEvent.setup();
    const searches: string[] = [];
    server.use(
      http.get("http://localhost:8080/api/v1/users/me", () =>
        HttpResponse.json({
          id: 7,
          nickname: "테스터",
          role: "USER",
          createdAt: "2026-08-21T00:00:00Z",
        }),
      ),
      http.get(LIST_URL, ({ request }) => {
        searches.push(new URL(request.url).search);
        return HttpResponse.json(pageOf([hoffmannSummary]));
      }),
    );

    renderWithQuery(<RecipeListScreen grind={NO_GRIND} />);
    await user.click(
      await screen.findByRole("checkbox", { name: "내 레시피만" }),
    );

    await waitFor(() =>
      expect(searches.at(-1)).toBe("?page=0&size=20&ownerUserId=7"),
    );
  });
});

describe("환산값 이어받기 — docs/specs/2026-09-17-small-features.md", () => {
  it("AC-SMALL-12 · 환산값이 있으면 카드가 기록 작성으로 간다", async () => {
    server.use(
      http.get(LIST_URL, () => HttpResponse.json(pageOf([hoffmannSummary]))),
    );
    renderWithQuery(
      <RecipeListScreen
        grind={{ grinderModelId: 1, grindSettingValue: 30 }}
      />,
    );

    // 카드의 접근 가능한 이름에는 제목 말고 수치도 섞인다. 제목으로 찾아 링크로 올라간다.
    const title = await screen.findByText("James Hoffmann Ultimate V60");
    const card = title.closest("a");

    expect(card?.getAttribute("href")).toBe(
      "/brews/new?recipeId=2&grinderModelId=1&grindSettingValue=30",
    );
  });

  it("AC-SMALL-12 · 환산값이 없으면 평소대로 상세로 간다", async () => {
    server.use(
      http.get(LIST_URL, () => HttpResponse.json(pageOf([hoffmannSummary]))),
    );
  
    renderWithQuery(<RecipeListScreen grind={NO_GRIND} />);

    const title = await screen.findByText("James Hoffmann Ultimate V60");
    const card = title.closest("a");

    expect(card?.getAttribute("href")).toBe("/recipes/2");
  });
});
