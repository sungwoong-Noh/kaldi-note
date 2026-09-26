import { screen, waitFor } from "@testing-library/react";
import { HttpResponse, delay, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession, setAccessToken } from "@/lib/session";
import {
  brewLogPage,
  brewLogWithTds,
  grindedRecipe,
  kasuyaRecipe,
} from "@/test/fixtures";
import { server } from "@/test/msw-server";
import { renderWithQuery } from "@/test/render";
import BrewsPage from "./page";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  usePathname: () => "/brews",
}));

const BASE = "http://localhost:8080/api/v1";
const LIST_URL = `${BASE}/brew-logs`;

/** 목록 응답 봉투. 항목은 실제 응답에서 뜬 것을 쓴다. */
function pageOf(
  content: object[],
  overrides: { hasNext?: boolean; page?: number } = {},
) {
  return {
    ...brewLogPage,
    content,
    page: overrides.page ?? 0,
    totalElements: content.length,
    hasNext: overrides.hasNext ?? false,
  };
}

beforeEach(() => {
  replace.mockClear();
  clearSession();
  setAccessToken("a.b.c");
  server.use(
    http.get(`${BASE}/recipes/12`, () =>
      HttpResponse.json({ ...grindedRecipe, id: 12, title: "Kasuya 4:6" }),
    ),
    // 통계는 이 파일 대부분의 테스트와 무관하다 — 기본값을 깔아 목록 테스트가
    // 통계 실패로 ErrorState를 그리지 않게 한다. 통계 자체를 보는 테스트는 덮어쓴다.
    http.get(`${BASE}/brew-logs/stats`, () =>
      HttpResponse.json({ monthCount: 0 }),
    ),
  );
});

describe("BrewsPage", () => {
  it("AC-WEBBREW-32 · 목록은 20개씩 최신순으로 부른다", async () => {
    let query = "";
    server.use(
      http.get(LIST_URL, ({ request }) => {
        query = new URL(request.url).search;
        return HttpResponse.json(pageOf([]));
      }),
    );

    renderWithQuery(<BrewsPage />);

    await waitFor(() => expect(query).not.toBe(""));
    const params = new URLSearchParams(query);
    expect(params.get("page")).toBe("0");
    expect(params.get("size")).toBe("20");
  });

  it("AC-WEBBREW-33 · hasNext가 true면 더 보기가 있다", async () => {
    server.use(
      http.get(LIST_URL, () =>
        HttpResponse.json(pageOf([brewLogWithTds], { hasNext: true })),
      ),
    );

    renderWithQuery(<BrewsPage />);

    expect(
      await screen.findByRole("button", { name: "더 보기" }),
    ).toBeInTheDocument();
  });

  it("AC-RECIPESBREWS-83 · 마지막 페이지에서 '더 보기'가 숨는다", async () => {
    server.use(
      http.get(LIST_URL, () =>
        HttpResponse.json(pageOf([brewLogWithTds], { hasNext: false })),
      ),
    );

    renderWithQuery(<BrewsPage />);

    await screen.findByText("Kasuya 4:6");
    expect(
      screen.queryByRole("button", { name: "더 보기" }),
    ).not.toBeInTheDocument();
  });

  it("AC-WEBBREW-34 · AC-RECIPESBREWS-86 · 기록이 없으면 통계는 0잔·—고 기록하기가 /recipes로 간다", async () => {
    server.use(
      http.get(LIST_URL, () => HttpResponse.json(pageOf([]))),
      http.get(`${BASE}/brew-logs/stats`, () =>
        HttpResponse.json({ monthCount: 0 }),
      ),
    );

    renderWithQuery(<BrewsPage />);

    expect(await screen.findByText("아직 기록이 없습니다")).toBeInTheDocument();
    expect(screen.getByText("0잔")).toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(3);
    expect(screen.getByRole("link", { name: "기록하기" })).toHaveAttribute(
      "href",
      "/recipes",
    );
  });

  it("AC-WEBBREW-35 · 항목에 날짜·레시피 제목·별점이 있다", async () => {
    server.use(
      http.get(LIST_URL, () =>
        HttpResponse.json(
          pageOf([
            {
              ...brewLogWithTds,
              brewedAt: "2026-08-31T09:00:00Z",
              recipeId: 12,
              rating: 4.5,
            },
          ]),
        ),
      ),
    );

    renderWithQuery(<BrewsPage />);

    expect(await screen.findByText("Kasuya 4:6")).toBeInTheDocument();
    expect(screen.getByText("2026-08-31")).toBeInTheDocument();
    expect(screen.getByText("4.5")).toBeInTheDocument();
  });

  it("AC-WEBBREW-36 · AC-RECIPESBREWS-87 · TDS 없는 잔은 수율 칸이 비되 열은 유지된다", async () => {
    // TDS 없이 내린 기록이 이 모양이다 — `non_null` 정책이라 키 자체가 없다.
    const withoutEy: Record<string, unknown> = {
      ...brewLogWithTds,
      recipeId: 12,
    };
    delete withoutEy.extractionYieldPercent;
    server.use(
      http.get(LIST_URL, () => HttpResponse.json(pageOf([withoutEy]))),
    );

    renderWithQuery(<BrewsPage />);

    await screen.findByText("Kasuya 4:6");
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "수율" }),
    ).toBeInTheDocument();
    const row = screen.getByText("Kasuya 4:6").closest("tr");
    expect(row?.textContent).toContain("—");
  });

  // AC-WEBSHELL-21·22를 대체한다 — 카드가 테이블/원장 행으로 바뀌면서 비율 열이
  // 빠지고 7열(AC-RECIPESBREWS-77)로 재구성됐다.
  it("AC-RECIPESBREWS-77 · 웹은 날짜·레시피/원두·원두량·온도·시간·수율·평가 7열 테이블이다", async () => {
    server.use(
      http.get(LIST_URL, () =>
        HttpResponse.json(
          pageOf([
            {
              ...brewLogWithTds,
              recipeId: 12,
              actualDoseG: 20.0,
              actualWaterTempC: 92.0,
              actualTotalTimeSeconds: 210,
            },
          ]),
        ),
      ),
    );

    renderWithQuery(<BrewsPage />);

    expect(
      await screen.findByRole("columnheader", { name: "날짜" }),
    ).toBeInTheDocument();
    for (const header of [
      "레시피/원두",
      "원두량",
      "온도",
      "시간",
      "수율",
      "평가",
    ]) {
      expect(
        screen.getByRole("columnheader", { name: header }),
      ).toBeInTheDocument();
    }

    expect(await screen.findByText("Kasuya 4:6")).toBeInTheDocument();
    expect(screen.getByText("20.0g")).toBeInTheDocument();
    expect(screen.getByText("92°C")).toBeInTheDocument();
    expect(screen.getByText("3:30")).toBeInTheDocument();
  });

  it("AC-RECIPESBREWS-77 · 총 시간이 없으면 그 칸이 빈다", async () => {
    const withoutTime: Record<string, unknown> = {
      ...brewLogWithTds,
      recipeId: 12,
    };
    delete withoutTime.actualTotalTimeSeconds;
    server.use(
      http.get(LIST_URL, () => HttpResponse.json(pageOf([withoutTime]))),
    );

    renderWithQuery(<BrewsPage />);

    await screen.findByText("Kasuya 4:6");
    expect(screen.queryByText(/^\d+:\d{2}$/)).not.toBeInTheDocument();
  });

  it("AC-RECIPESBREWS-76 · 통계 카드에 이번 달·평균 별점·최빈 원두량·즐겨 쓴 레시피가 있다", async () => {
    server.use(
      http.get(LIST_URL, () => HttpResponse.json(pageOf([brewLogWithTds]))),
      http.get(`${BASE}/brew-logs/stats`, () =>
        HttpResponse.json({
          monthCount: 9,
          averageRating: 3.7,
          favoriteDoseG: 16.0,
          favoriteRecipeId: 12,
          favoriteRecipeTitle: "케냐 94도 3푸어",
        }),
      ),
    );

    renderWithQuery(<BrewsPage />);

    expect(await screen.findByText("9잔")).toBeInTheDocument();
    expect(screen.getByText("★ 3.7")).toBeInTheDocument();
    expect(screen.getByText("16.0g")).toBeInTheDocument();
    expect(screen.getByText("케냐 94도 3푸어")).toBeInTheDocument();
  });
});

describe("BrewsPage — 레시피 이름", () => {
  it("AC-WEBNAME-41 · 한 레시피가 실패해도 나머지 카드는 제목을 보여준다", async () => {
    server.use(
      http.get(LIST_URL, () =>
        HttpResponse.json(
          pageOf([
            { ...brewLogWithTds, id: 1, recipeId: 12 },
            { ...brewLogWithTds, id: 2, recipeId: 17 },
          ]),
        ),
      ),
      http.get(`${BASE}/recipes/12`, () =>
        HttpResponse.json(
          { code: "FORBIDDEN", message: "권한이 없습니다." },
          { status: 403 },
        ),
      ),
      http.get(`${BASE}/recipes/17`, () => HttpResponse.json(kasuyaRecipe)),
    );

    renderWithQuery(<BrewsPage />);

    expect(await screen.findByText("비공개 레시피")).toBeInTheDocument();
    expect(
      await screen.findByText("Tetsu Kasuya 4:6 Method"),
    ).toBeInTheDocument();
  });

  it("AC-WEBNAME-42 · 같은 레시피를 쓴 로그가 여럿이어도 조회는 1회다", async () => {
    let calls = 0;
    server.use(
      http.get(LIST_URL, () =>
        HttpResponse.json(
          pageOf([
            { ...brewLogWithTds, id: 1, recipeId: 12 },
            { ...brewLogWithTds, id: 2, recipeId: 12 },
            { ...brewLogWithTds, id: 3, recipeId: 12 },
          ]),
        ),
      ),
      http.get(`${BASE}/recipes/12`, () => {
        calls += 1;
        return HttpResponse.json(kasuyaRecipe);
      }),
    );

    renderWithQuery(<BrewsPage />);

    await screen.findAllByText("Tetsu Kasuya 4:6 Method");
    expect(calls).toBe(1);
  });
});

describe("BrewsPage — 로그인·에러", () => {
  it("AC-RECIPESBREWS-94 · refresh가 무효면 로그인으로 보낸다", async () => {
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

    renderWithQuery(<BrewsPage />);

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/login?next=%2Fbrews"),
    );
  });

  it("AC-RECIPESBREWS-97 · 목록 조회가 실패하면 메시지와 다시 시도를 보여준다", async () => {
    server.use(
      http.get(LIST_URL, () =>
        HttpResponse.json(
          { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
          { status: 500 },
        ),
      ),
    );

    renderWithQuery(<BrewsPage />);

    expect(
      await screen.findByText("서버 오류가 발생했습니다."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "다시 시도" }),
    ).toBeInTheDocument();
  });

  it("AC-RECIPESBREWS-97 · 통계 조회가 실패하면 메시지와 다시 시도를 보여준다", async () => {
    server.use(
      http.get(LIST_URL, () => HttpResponse.json(pageOf([brewLogWithTds]))),
      http.get(`${BASE}/brew-logs/stats`, () =>
        HttpResponse.json(
          { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
          { status: 500 },
        ),
      ),
    );

    renderWithQuery(<BrewsPage />);

    expect(
      await screen.findByText("서버 오류가 발생했습니다."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "다시 시도" }),
    ).toBeInTheDocument();
  });

  it("AC-RECIPESBREWS-101 · 조회 중에는 로딩 상태가 표시된다", async () => {
    server.use(
      http.get(LIST_URL, async () => {
        await delay(300);
        return HttpResponse.json(pageOf([brewLogWithTds]));
      }),
    );

    renderWithQuery(<BrewsPage />);

    expect(
      await screen.findByRole("status", { name: "불러오는 중" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Kasuya 4:6")).not.toBeInTheDocument();
  });
});
