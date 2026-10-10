import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, delay, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession, setAccessToken } from "@/lib/session";
import {
  brewLogPage,
  brewLogWithTds,
  grindedRecipe,
  brewLogWithoutTds,
  brewers,
  fritzRoaster,
  kasuyaRecipe,
  me,
  yirgacheffeBatch,
  yirgacheffeProduct,
} from "@/test/fixtures";
import { server } from "@/test/msw-server";
import { renderWithQuery } from "@/test/render";
import BrewsPage from "./page";

const replace = vi.fn();
let currentSearch = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  usePathname: () => "/brews",
  useSearchParams: () => new URLSearchParams(currentSearch),
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
  // 「이번 달」이 2026-10이 되도록 오늘을 고정한다(KST 2026-10-10 10:00).
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date("2026-10-10T01:00:00Z"));
  replace.mockClear();
  currentSearch = "";
  clearSession();
  setAccessToken("a.b.c");
  server.use(
    http.get(`${BASE}/users/me`, () => HttpResponse.json(me)),
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

afterEach(() => {
  vi.useRealTimers();
});

/** 목록 요청의 쿼리를 잡는다. 마지막 요청이 남는다. */
function captureListQuery(): { params: () => URLSearchParams } {
  let query = "";
  server.use(
    http.get(LIST_URL, ({ request }) => {
      query = new URL(request.url).search;
      return HttpResponse.json(pageOf([brewLogWithTds]));
    }),
  );
  return { params: () => new URLSearchParams(query) };
}

describe("내 잔 — 범위와 필터 (docs/specs/2026-10-10-my-cups-ledger.md)", () => {
  it("AC-MYCUPS-01 · 목록은 본인 잔만 부른다", async () => {
    const list = captureListQuery();

    renderWithQuery(<BrewsPage />);

    await waitFor(() => expect(list.params().get("userId")).toBe("11"));
  });

  it("AC-MYCUPS-04 · 「이번 달」을 누르면 ?filter=month로 바뀐다", async () => {
    captureListQuery();
    renderWithQuery(<BrewsPage />);

    await userEvent.click(await screen.findByRole("button", { name: "이번 달" }));

    expect(replace).toHaveBeenCalledWith("/brews?filter=month");
  });

  it("AC-MYCUPS-04 · ?filter=month면 month=2026-10과 userId를 함께 보낸다", async () => {
    currentSearch = "filter=month";
    const list = captureListQuery();

    renderWithQuery(<BrewsPage />);

    await waitFor(() => expect(list.params().get("month")).toBe("2026-10"));
    expect(list.params().get("userId")).toBe("11");
    expect(list.params().get("minRating")).toBeNull();
    expect(
      await screen.findByRole("button", { name: "이번 달" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("AC-MYCUPS-05 · 「★ 4 이상」은 ?filter=rated, 「전체」는 쿼리를 지운다", async () => {
    currentSearch = "filter=month";
    captureListQuery();
    renderWithQuery(<BrewsPage />);

    await userEvent.click(await screen.findByRole("button", { name: "★ 4 이상" }));
    expect(replace).toHaveBeenLastCalledWith("/brews?filter=rated");

    await userEvent.click(screen.getByRole("button", { name: "전체" }));
    expect(replace).toHaveBeenLastCalledWith("/brews");
  });

  it("AC-MYCUPS-05 · ?filter=rated면 minRating=4만 보낸다", async () => {
    currentSearch = "filter=rated";
    const list = captureListQuery();

    renderWithQuery(<BrewsPage />);

    await waitFor(() => expect(list.params().get("minRating")).toBe("4"));
    expect(list.params().get("month")).toBeNull();
  });

  it("AC-MYCUPS-21 · 모르는 filter 값은 전체로 본다", async () => {
    currentSearch = "filter=xyz";
    const list = captureListQuery();

    renderWithQuery(<BrewsPage />);

    await waitFor(() => expect(list.params().get("userId")).toBe("11"));
    expect(screen.getByRole("button", { name: "전체" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(list.params().get("month")).toBeNull();
    expect(list.params().get("minRating")).toBeNull();
  });
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
    // 웹 머리의 개수(`0잔`, AC-MYCUPS-07)와 글자가 같다 — 통계 타일 안에서 찾는다.
    const monthTile = screen.getByText("이번 달", { selector: "[data-stat-label]" }).parentElement!;
    expect(within(monthTile).getByText("0잔")).toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(3);
    expect(screen.getByRole("link", { name: "기록하기" })).toHaveAttribute(
      "href",
      "/recipes",
    );
  });

  it("AC-WEBBREW-35 · AC-MYCUPS-13 · 항목에 날짜·레시피 제목·별점이 있다", async () => {
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
    expect(screen.getByText("08.31")).toBeInTheDocument();
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
  // "새 API 호출이 추가되지 않는다"(AC-78)는 아래 AC-WEBNAME-42(조회는 1회다)가 이미
  // useRecipeLabels 캐싱으로 증명한다 — 여기서는 그 훅이 채운 값이 테이블 셀에 그대로
  // 나오는지만 본다.
  it("AC-RECIPESBREWS-77 · AC-RECIPESBREWS-78 · 웹은 7열 테이블이고 레시피 열은 기존 useRecipeLabels로 채운다", async () => {
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
      "레시피 / 원두",
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
    expect(screen.getByText("20 g")).toBeInTheDocument();
    expect(screen.getByText("92 °C")).toBeInTheDocument();
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

  it("AC-RECIPESBREWS-76 · AC-MYCUPS-10 · 통계 카드에 이번 달·평균 별점·가장 많이 쓴 원두량·즐겨 쓴 레시피가 있다", async () => {
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
    expect(screen.getByText("16 g")).toBeInTheDocument();
    expect(screen.getByText("케냐 94도 3푸어")).toBeInTheDocument();
    for (const label of ["이번 달", "평균 별점", "가장 많이 쓴 원두량", "즐겨 쓴 레시피"]) {
      expect(screen.getByText(label, { selector: "[data-stat-label]" })).toBeInTheDocument();
    }
  });
});

describe("내 잔 — 헤더·통계·빈 결과", () => {
  const STATS = {
    monthCount: 9,
    averageRating: 3.7,
    favoriteDoseG: 16.0,
    favoriteRecipeId: 12,
    favoriteRecipeTitle: "케냐 94도 3푸어",
  };
  const initialWidth = window.innerWidth;

  afterEach(() => {
    window.innerWidth = initialWidth;
  });

  it("AC-MYCUPS-07 · 웹 헤더는 연도 eyebrow와 알약·개수다", async () => {
    server.use(
      http.get(LIST_URL, () =>
        HttpResponse.json(pageOf([brewLogWithTds, { ...brewLogWithTds, id: 3 }])),
      ),
    );

    renderWithQuery(<BrewsPage />);

    expect(await screen.findByText("My cups · 2026")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "내 잔" })).toBeInTheDocument();
    expect(await screen.findByText("2잔")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "레시피" })).toBeNull();
  });

  it("AC-MYCUPS-06 · 모바일 헤더는 개수 eyebrow와 아바타다", async () => {
    window.innerWidth = 390;
    server.use(
      http.get(LIST_URL, () =>
        HttpResponse.json(pageOf([brewLogWithTds, { ...brewLogWithTds, id: 3 }])),
      ),
    );

    renderWithQuery(<BrewsPage />);

    expect(await screen.findByText("My cups · 2")).toBeInTheDocument();
    expect(screen.queryByText("2잔")).toBeNull();
    expect(screen.queryByRole("link", { name: "레시피" })).toBeNull();
  });

  it("AC-MYCUPS-10 · 모바일 통계는 2칸이다", async () => {
    window.innerWidth = 390;
    server.use(
      http.get(LIST_URL, () => HttpResponse.json(pageOf([brewLogWithTds]))),
      http.get(`${BASE}/brew-logs/stats`, () => HttpResponse.json(STATS)),
    );

    renderWithQuery(<BrewsPage />);

    expect(await screen.findByText("9잔")).toBeInTheDocument();
    expect(screen.getByText("★ 3.7")).toBeInTheDocument();
    expect(screen.queryByText("가장 많이 쓴 원두량")).toBeNull();
    expect(screen.queryByText("즐겨 쓴 레시피")).toBeNull();
  });

  it("AC-MYCUPS-18 · 필터 결과 0건이면 안내와 전체 보기가 뜨고 통계는 그대로다", async () => {
    currentSearch = "filter=rated";
    server.use(
      http.get(LIST_URL, () => HttpResponse.json(pageOf([]))),
      http.get(`${BASE}/brew-logs/stats`, () => HttpResponse.json(STATS)),
    );

    renderWithQuery(<BrewsPage />);

    expect(await screen.findByText("조건에 맞는 잔이 없습니다")).toBeInTheDocument();
    expect(screen.getByText("9잔")).toBeInTheDocument();
    expect(screen.queryByText("아직 기록이 없습니다")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "전체 보기" }));
    expect(replace).toHaveBeenLastCalledWith("/brews");
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

describe("내 잔 — 모바일 원장 행", () => {
  const initialWidth = window.innerWidth;

  beforeEach(() => {
    window.innerWidth = 390;
  });

  afterEach(() => {
    window.innerWidth = initialWidth;
  });

  it("AC-MYCUPS-08 · 1줄은 레시피명·원두량, 2줄은 날짜·온도·시간 / 수율·별점이다", async () => {
    server.use(
      http.get(LIST_URL, () => HttpResponse.json(pageOf([brewLogWithTds]))),
    );

    renderWithQuery(<BrewsPage />);

    expect(await screen.findByText("Kasuya 4:6")).toBeInTheDocument();
    expect(screen.getByText("20 g")).toBeInTheDocument();
    expect(screen.getByText("08.31 월 · 92°C · 3:30")).toBeInTheDocument();
    expect(screen.getByText("17.6 % · ★ 4")).toBeInTheDocument();
  });

  it("AC-MYCUPS-14 · 없는 값은 그 조각만 빠진다", async () => {
    server.use(
      http.get(LIST_URL, () =>
        HttpResponse.json(
          pageOf([
            brewLogWithoutTds,
            { ...brewLogWithoutTds, id: 4, rating: undefined },
          ]),
        ),
      ),
    );

    renderWithQuery(<BrewsPage />);

    expect(await screen.findAllByText("08.30 일 · 92°C")).toHaveLength(2);
    expect(screen.getByText("★ 3")).toBeInTheDocument();
    // 별점도 없는 행은 오른쪽 자리가 비고 `·`가 남지 않는다.
    expect(screen.queryByText(/^\s*·|·\s*$/)).toBeNull();
    expect(document.querySelectorAll("[data-ledger-accent]")).toHaveLength(1);
  });
});

describe("내 잔 — 웹 표 보조줄", () => {
  beforeEach(() => {
    server.use(
      http.get(`${BASE}/gear/brewers`, () => HttpResponse.json(brewers)),
      // grindedRecipe에는 brewerId가 없다 — 보조줄의 드리퍼를 보려고 2(Hario V60 02)를 준다.
      http.get(`${BASE}/recipes/12`, () =>
        HttpResponse.json({ ...grindedRecipe, id: 12, title: "Kasuya 4:6", brewerId: 2 }),
      ),
      http.get(`${BASE}/bean-batches/3`, () => HttpResponse.json(yirgacheffeBatch)),
      http.get(`${BASE}/bean-products/:id`, () => HttpResponse.json(yirgacheffeProduct)),
      http.get(`${BASE}/roasters`, () => HttpResponse.json([fritzRoaster])),
      // 드리퍼도 원두도 없는 경우를 만들려고 brewerId 없는 레시피를 둔다.
      http.get(`${BASE}/recipes/17`, () =>
        HttpResponse.json({ ...grindedRecipe, id: 17, title: "드리퍼 없음", brewerId: undefined }),
      ),
    );
  });

  it("AC-MYCUPS-15 · 보조줄은 원두 · 드리퍼, 원두가 없으면 드리퍼만, 둘 다 없으면 없다", async () => {
    server.use(
      http.get(LIST_URL, () =>
        HttpResponse.json(
          pageOf([
            { ...brewLogWithTds, id: 2 },
            { ...brewLogWithTds, id: 5, beanBatchId: undefined },
            { ...brewLogWithTds, id: 6, beanBatchId: undefined, recipeId: 17 },
          ]),
        ),
      ),
    );

    renderWithQuery(<BrewsPage />);

    expect(await screen.findByText("프릿츠 예가체프 · Hario V60 02")).toBeInTheDocument();
    expect(screen.getByText("Hario V60 02")).toBeInTheDocument();
    expect(await screen.findByText("드리퍼 없음")).toBeInTheDocument();
    expect(document.querySelectorAll("[data-ledger-sub]")).toHaveLength(2);
    // 점 자리는 원두가 없어도 비워 둔다 — 제목의 왼쪽 선이 행마다 같다.
    expect(document.querySelectorAll("[data-ledger-dot]")).toHaveLength(3);
  });

  it("AC-MYCUPS-24 · 보조줄·점을 위해 새 API를 부르지 않는다", async () => {
    const paths = new Set<string>();
    const record = ({ request }: { request: Request }) => {
      paths.add(new URL(request.url).pathname);
    };
    server.events.on("request:start", record);
    server.use(
      http.get(LIST_URL, () => HttpResponse.json(pageOf([brewLogWithTds]))),
    );

    renderWithQuery(<BrewsPage />);
    expect(await screen.findByText("프릿츠 예가체프 · Hario V60 02")).toBeInTheDocument();
    server.events.removeListener("request:start", record);

    const allowed = [
      /^\/api\/v1\/users\/me$/,
      /^\/api\/v1\/brew-logs$/,
      /^\/api\/v1\/brew-logs\/stats$/,
      /^\/api\/v1\/recipes\/\d+$/,
      /^\/api\/v1\/gear\/brewers$/,
      /^\/api\/v1\/bean-batches\/\d+$/,
      /^\/api\/v1\/bean-products\/\d+$/,
      /^\/api\/v1\/roasters$/,
    ];
    expect([...paths].filter((path) => !allowed.some((re) => re.test(path)))).toEqual([]);
  });
});
