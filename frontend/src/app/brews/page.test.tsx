import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, delay, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession, setAccessToken } from "@/lib/session";
import { closeQuickBrew, useQuickBrew } from "@/lib/quickBrew";
import {
  brewLogPage,
  brewLogWithoutTds,
  brewLogWithTds,
  fritzRoaster,
  grindedRecipe,
  kasuyaRecipe,
  me,
  yirgacheffeBatch,
  yirgacheffeProduct,
} from "@/test/fixtures";
import { server } from "@/test/msw-server";
import { renderWithQuery } from "@/test/render";
import BrewsPage from "./page";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  usePathname: () => "/brews",
  useSearchParams: () => new URLSearchParams(),
}));

const BASE = "http://localhost:8080/api/v1";
const LIST_URL = `${BASE}/brew-logs`;
const CALENDAR_URL = `${BASE}/brew-logs/calendar`;

/** 목록 응답 봉투. 항목은 실제 응답에서 뜬 것을 쓴다. */
function pageOf(
  content: object[],
  overrides: { hasNext?: boolean; page?: number; totalElements?: number } = {},
) {
  return {
    ...brewLogPage,
    content,
    page: overrides.page ?? 0,
    totalElements: overrides.totalElements ?? content.length,
    hasNext: overrides.hasNext ?? false,
  };
}

function QuickBrewProbe() {
  const open = useQuickBrew();
  return <div data-testid="qb-state">{open ? open.start : "closed"}</div>;
}

const initialWidth = window.innerWidth;

beforeEach(() => {
  // 오늘 KST = 2026-10-10
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date("2026-10-10T01:00:00Z"));
  window.innerWidth = initialWidth;
  closeQuickBrew();
  replace.mockClear();
  clearSession();
  setAccessToken("a.b.c");
  server.use(
    http.get(`${BASE}/users/me`, () => HttpResponse.json(me)),
    http.get(`${BASE}/recipes/12`, () =>
      HttpResponse.json({ ...grindedRecipe, id: 12, title: "Kasuya 4:6" }),
    ),
    http.get(CALENDAR_URL, () =>
      HttpResponse.json({ month: "2026-10", totalCount: 0, days: [] }),
    ),
  );
});

afterEach(() => {
  closeQuickBrew();
  window.innerWidth = initialWidth;
  vi.restoreAllMocks();
  vi.useRealTimers();
});

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

describe("기록 탭 — 목록 계약과 원장 (docs/specs/2026-11-14-quick-brew.md)", () => {
  it("AC-MYCUPS-01 · 목록은 본인 잔만 부른다", async () => {
    const list = captureListQuery();

    renderWithQuery(<BrewsPage />);

    await waitFor(() => expect(list.params().get("userId")).toBe("11"));
  });

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

  it("AC-WEBBREW-34 · 기록이 없으면 빈 안내가 보이고 기록하기 버튼이 빠른 기록을 연다", async () => {
    server.use(http.get(LIST_URL, () => HttpResponse.json(pageOf([]))));

    renderWithQuery(
      <>
        <QuickBrewProbe />
        <BrewsPage />
      </>,
    );

    expect(await screen.findByText("아직 기록이 없습니다")).toBeInTheDocument();
    const emptyBox = document.querySelector("[data-empty]") as HTMLElement;
    expect(emptyBox).not.toBeNull();
    const cta = within(emptyBox).getByRole("button", { name: "기록하기" });
    expect(screen.queryByRole("link", { name: "기록하기" })).toBeNull();
    expect(screen.getByTestId("qb-state")).toHaveTextContent("closed");

    await userEvent.click(cta);
    expect(screen.getByTestId("qb-state")).toHaveTextContent("record");
  });

  it("AC-WEBBREW-35 · AC-MYCUPS-13 · 항목에 날짜·레시피 제목·별점이 있다", async () => {
    server.use(
      http.get(LIST_URL, () =>
        HttpResponse.json(
          pageOf([
            {
              ...brewLogWithoutTds,
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
    expect(screen.getByText(/08\.31/)).toBeInTheDocument();
    expect(screen.getByText(/4\.5/)).toBeInTheDocument();
  });

  it("AC-WEBBREW-36 · EY가 없는 항목은 % 표기가 없다", async () => {
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
  });

  it("AC-RECIPESBREWS-78 · AC-MYCUPS-12 · AC-GRAMMAR-22 · 원장 행이 전체 링크고 FW 수치 20 g가 font-num이다", async () => {
    window.innerWidth = 1440;
    server.use(
      http.get(LIST_URL, () => HttpResponse.json(pageOf([brewLogWithTds]))),
    );

    renderWithQuery(<BrewsPage />);

    const title = await screen.findByText("Kasuya 4:6");
    const link = title.closest("a");
    expect(link).toHaveAttribute("href", "/brews/2");

    const ledger = document.querySelector("[data-brew-ledger]") as HTMLElement;
    expect(ledger).not.toBeNull();
    const dose = within(ledger).getByText("20 g", { exact: true });
    expect(dose).toHaveClass("font-num");
  });

  it("AC-QUICKBREW-31 · 제목 옆 N잔은 totalElements이고 목록↔달력 전환 후 목록 스크롤이 600px로 복원된다", async () => {
    window.innerWidth = 390;
    let currentScrollY = 600;
    Object.defineProperty(window, "scrollY", {
      configurable: true,
      get: () => currentScrollY,
    });
    const scrollToSpy = vi
      .spyOn(window, "scrollTo")
      .mockImplementation((_x: unknown, y?: number) => {
        if (typeof y === "number") currentScrollY = y;
      });

    server.use(
      http.get(LIST_URL, () =>
        HttpResponse.json(pageOf([brewLogWithTds], { totalElements: 142 })),
      ),
    );

    renderWithQuery(<BrewsPage />);

    expect(await screen.findByText("142잔")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "기록" }),
    ).toBeInTheDocument();

    const listBtn = screen.getByRole("button", { name: "목록" });
    const calBtn = screen.getByRole("button", { name: "달력" });
    expect(listBtn).toHaveAttribute("aria-pressed", "true");
    expect(calBtn).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(calBtn);
    expect(calBtn).toHaveAttribute("aria-pressed", "true");
    // 모바일 F2 월 헤더는 건수 라벨을 생략한다(AC-HOMECAL-40).
    expect(screen.getByText("2026.10")).toBeInTheDocument();
    expect(screen.queryByText(/0잔/)).not.toBeInTheDocument();

    currentScrollY = 0;
    await userEvent.click(listBtn);
    expect(listBtn).toHaveAttribute("aria-pressed", "true");
    expect(scrollToSpy).toHaveBeenLastCalledWith(0, 600);
  });

  it("AC-QUICKBREW-35 · 웹 달력 모드는 우측 사이드 카드를 감추고 720px 달력 카드와 DayList를 보여준다", async () => {
    vi.setSystemTime(new Date("2026-11-14T01:00:00Z"));
    window.innerWidth = 1440;
    const novLog = {
      ...brewLogWithoutTds,
      id: 91,
      brewedAt: "2026-11-14T00:00:00Z", // KST 11.14 09:00
      recipeId: 12,
      beanBatchId: undefined,
    };
    server.use(
      http.get(LIST_URL, ({ request }) => {
        const dateParam = new URL(request.url).searchParams.get("date");
        if (dateParam === "2026-11-14") {
          return HttpResponse.json(pageOf([novLog]));
        }
        return HttpResponse.json(pageOf([novLog], { totalElements: 12 }));
      }),
      http.get(CALENDAR_URL, () =>
        HttpResponse.json({
          month: "2026-11",
          totalCount: 12,
          days: Array.from({ length: 8 }, (_, idx) => ({
            date: `2026-11-${String(idx + 7).padStart(2, "0")}`,
            count: idx === 7 ? 1 : 2,
          })),
        }),
      ),
    );

    renderWithQuery(<BrewsPage />);

    expect(
      await screen.findByText("날짜를 누르면 왼쪽 목록이 그 날로 스크롤됩니다."),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "달력" }));

    expect(
      screen.queryByText("날짜를 누르면 왼쪽 목록이 그 날로 스크롤됩니다."),
    ).not.toBeInTheDocument();
    expect(screen.getByText("2026.11")).toBeInTheDocument();
    expect(screen.getByText("8일 · 12잔")).toBeInTheDocument();
    expect(await screen.findByText("11.14 토 · 1잔")).toBeInTheDocument();
  });

  it("AC-QUICKBREW-36 · 웹 사이드 카드 ‹ 이동, 로드된 날 스크롤, 미로드 날은 추가 페이지 로드 없이 달력 전환한다", async () => {
    vi.setSystemTime(new Date("2026-11-14T01:00:00Z"));
    window.innerWidth = 1440;
    const novLog = {
      ...brewLogWithoutTds,
      id: 31,
      brewedAt: "2026-11-12T01:00:00Z", // KST 11.12 목 10:00
      recipeId: 12,
      beanBatchId: undefined,
    };
    const octLog = {
      ...brewLogWithoutTds,
      id: 32,
      brewedAt: "2026-10-05T01:00:00Z", // KST 10.05 월 10:00
      recipeId: 12,
      beanBatchId: undefined,
    };
    const listPageParams: string[] = [];

    server.use(
      http.get(LIST_URL, ({ request }) => {
        const sp = new URL(request.url).searchParams;
        const dateParam = sp.get("date");
        if (dateParam === "2026-10-05") {
          return HttpResponse.json(pageOf([octLog]));
        }
        listPageParams.push(sp.get("page") ?? "");
        return HttpResponse.json(pageOf([novLog], { hasNext: true }));
      }),
      http.get(CALENDAR_URL, ({ request }) => {
        const m = new URL(request.url).searchParams.get("month");
        if (m === "2026-10") {
          return HttpResponse.json({
            month: "2026-10",
            totalCount: 1,
            days: [{ date: "2026-10-05", count: 1 }],
          });
        }
        return HttpResponse.json({
          month: "2026-11",
          totalCount: 1,
          days: [{ date: "2026-11-12", count: 1 }],
        });
      }),
    );

    const scrollIntoViewMock = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoViewMock;

    renderWithQuery(<BrewsPage />);

    expect(await screen.findByText("11.12 목")).toBeInTheDocument();

    // 로드된 날짜 2026-11-12 클릭 → 목록 모드 유지 + scrollIntoView
    await userEvent.click(
      screen.getByRole("button", { name: "11월 12일, 기록 1건" }),
    );
    expect(screen.getByRole("button", { name: "목록" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);

    // 이전 달(‹) → 2026.10 로드 후 미로드 날짜 2026-10-05 클릭 → 추가 page 요청 없이 달력 전환
    await userEvent.click(screen.getByRole("button", { name: "이전 달" }));
    expect(await screen.findByText("2026.10")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "10월 5일, 기록 1건" }),
    );
    expect(screen.getByRole("button", { name: "달력" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(await screen.findByText("10.05 월 · 1잔")).toBeInTheDocument();
    expect(listPageParams).toEqual(["0"]);
  });

  it("AC-QUICKBREW-37 · 900px에서는 이번 주 한 줄로 시작하고 그 줄을 누르면 한 달 전체로 펼쳐진다", async () => {
    vi.setSystemTime(new Date("2026-11-14T01:00:00Z"));
    window.innerWidth = 900;
    server.use(
      http.get(LIST_URL, () => HttpResponse.json(pageOf([brewLogWithTds]))),
      http.get(CALENDAR_URL, () =>
        HttpResponse.json({
          month: "2026-11",
          totalCount: 1,
          days: [{ date: "2026-11-12", count: 1 }],
        }),
      ),
    );

    renderWithQuery(<BrewsPage />);

    await screen.findByText("Kasuya 4:6");
    expect(screen.getAllByTestId("calendar-row")).toHaveLength(1);
    const weekGrid = screen.getByTestId("calendar-week-grid");
    const weekButtons = within(weekGrid).getAllByRole("button");
    expect(weekButtons).toHaveLength(1);
    expect(weekButtons[0]).toHaveAccessibleName("이번 주 달력 펼치기");
    // 별도 토글 버튼 없이 MonthNav(이전/다음) + 접힌 주 1개만 있다
    const aside = document.querySelector("aside") as HTMLElement;
    expect(within(aside).getAllByRole("button")).toHaveLength(3);

    await userEvent.click(weekButtons[0]);
    expect(screen.getAllByTestId("calendar-row").length).toBeGreaterThan(1);
  });
});

describe("기록 탭 — 레시피·원두 라벨과 무추가 API", () => {
  it("AC-WEBNAME-41 · 한 레시피가 실패해도 나머지 행은 제목을 보여준다", async () => {
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

  it("AC-MYCUPS-24 · 라벨 표시에 새 백엔드 API를 부르지 않는다", async () => {
    const paths = new Set<string>();
    const record = ({ request }: { request: Request }) => {
      paths.add(new URL(request.url).pathname);
    };
    server.events.on("request:start", record);
    server.use(
      http.get(LIST_URL, () =>
        HttpResponse.json(
          pageOf([
            brewLogWithTds,
            {
              ...brewLogWithoutTds,
              id: 4,
              recipeId: undefined,
              beanBatchId: yirgacheffeBatch.id,
            },
          ]),
        ),
      ),
      http.get(`${BASE}/bean-batches/${yirgacheffeBatch.id}`, () =>
        HttpResponse.json(yirgacheffeBatch),
      ),
      http.get(`${BASE}/bean-products/${yirgacheffeProduct.id}`, () =>
        HttpResponse.json(yirgacheffeProduct),
      ),
      http.get(`${BASE}/roasters`, () => HttpResponse.json([fritzRoaster])),
    );

    renderWithQuery(<BrewsPage />);
    expect(await screen.findByText("Kasuya 4:6")).toBeInTheDocument();
    expect(await screen.findByText(yirgacheffeProduct.name)).toBeInTheDocument();
    server.events.removeListener("request:start", record);

    const allowed = [
      /^\/api\/v1\/users\/me$/,
      /^\/api\/v1\/brew-logs$/,
      /^\/api\/v1\/brew-logs\/calendar$/,
      /^\/api\/v1\/recipes\/\d+$/,
      /^\/api\/v1\/bean-batches\/\d+$/,
      /^\/api\/v1\/bean-products\/\d+$/,
      /^\/api\/v1\/roasters$/,
    ];
    expect(
      [...paths].filter((path) => !allowed.some((re) => re.test(path))),
    ).toEqual([]);
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
