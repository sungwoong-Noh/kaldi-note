import { act, cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { closeQuickBrew, useQuickBrew } from "@/lib/quickBrew";
import { clearSession, setAccessToken } from "@/lib/session";
import {
  brewLogPage,
  brewLogWithTds,
  brewLogWithoutTds,
  fritzRoaster,
  hoffmann,
  homeCalendar,
  me,
  myComandante,
  yirgacheffeBatch,
  yirgacheffeProduct,
} from "@/test/fixtures";
import { server } from "@/test/msw-server";
import { renderWithQuery } from "@/test/render";
import { mockViewportWidth } from "@/test/viewport";
import HomePage from "./page";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

const BASE = "http://localhost:8080/api/v1";

function QuickBrewProbe() {
  const open = useQuickBrew();
  return <div data-testid="qb-state">{open ? open.start : "closed"}</div>;
}

function pageOf(content: object[]) {
  return {
    ...brewLogPage,
    content,
    totalElements: content.length,
    hasNext: false,
  };
}

function emptyCalendar(month: string) {
  return { ...homeCalendar, month, totalCount: 0, days: [] };
}

function useCatalogAndGearHandlers() {
  server.use(
    http.get(`${BASE}/bean-products/:id`, ({ params }) =>
      HttpResponse.json({
        ...yirgacheffeProduct,
        id: Number(params.id),
      }),
    ),
    http.get(`${BASE}/bean-batches/:id`, ({ params }) =>
      HttpResponse.json({
        ...yirgacheffeBatch,
        id: Number(params.id),
      }),
    ),
    http.get(`${BASE}/roasters`, () => HttpResponse.json([fritzRoaster])),
    http.get(`${BASE}/recipes/:id`, ({ params }) =>
      HttpResponse.json({ ...hoffmann, id: Number(params.id) }),
    ),
    http.get(`${BASE}/gear/user-grinders`, () =>
      HttpResponse.json([myComandante]),
    ),
  );
}

beforeEach(() => {
  setAccessToken("test-token");
  closeQuickBrew();
  replace.mockClear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  closeQuickBrew();
  clearSession();
});

describe("오늘 홈 (docs/specs/2026-11-14-quick-brew.md Task 10)", () => {
  it("AC-QUICKBREW-21 · 기록이 0건인 빈 홈은 첫 잔 안내와 기록하기 버튼만 보이고 지난번과 같게·이번 주·최근 기록 카드가 없다", async () => {
    mockViewportWidth(390);
    server.use(
      http.get(`${BASE}/users/me`, () => HttpResponse.json(me)),
      http.get(`${BASE}/brew-logs`, () => HttpResponse.json(pageOf([]))),
      http.get(`${BASE}/brew-logs/calendar`, ({ request }) => {
        const month =
          new URL(request.url).searchParams.get("month") ?? "2026-11";
        return HttpResponse.json(emptyCalendar(month));
      }),
    );

    const user = userEvent.setup();
    renderWithQuery(
      <>
        <HomePage />
        <QuickBrewProbe />
      </>,
    );

    expect(
      await screen.findByText("첫 잔을 기록해 보세요"),
    ).toBeInTheDocument();
    expect(screen.queryByText("지난번과 같게")).toBeNull();
    expect(screen.queryByText("이번 주")).toBeNull();
    expect(screen.queryByText("최근 기록")).toBeNull();
    expect(screen.queryByText("이대로 기록")).toBeNull();

    await user.click(screen.getByRole("button", { name: "기록하기" }));
    expect(screen.getByTestId("qb-state")).toHaveTextContent("record");
  });

  it("AC-QUICKBREW-22 · 오늘 2026-11-14(토) KST 기준으로 이번 주가 1잔이면 카드를 숨기고, 2잔이면 이번 주 숫자와 지난주 1잔을 보여준다", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-11-14T10:00:00+09:00"));
    mockViewportWidth(390);
    useCatalogAndGearHandlers();

    const oneThisWeek = [
      { date: "2026-11-08", count: 1, primaryRecipeName: "아침" },
      { date: "2026-11-09", count: 1, primaryRecipeName: "아침" },
    ];
    let calendarDays = oneThisWeek;

    server.use(
      http.get(`${BASE}/users/me`, () => HttpResponse.json(me)),
      http.get(`${BASE}/brew-logs`, () =>
        HttpResponse.json(pageOf([brewLogWithoutTds])),
      ),
      http.get(`${BASE}/brew-logs/calendar`, () =>
        HttpResponse.json({
          month: "2026-11",
          totalCount: calendarDays.length,
          days: calendarDays,
        }),
      ),
    );

    const view = renderWithQuery(<HomePage />);
    expect(await screen.findByText("지난번과 같게")).toBeInTheDocument();
    expect(screen.queryByText("이번 주")).toBeNull();
    view.unmount();

    calendarDays = [
      ...oneThisWeek,
      { date: "2026-11-12", count: 1, primaryRecipeName: "저녁" },
    ];
    renderWithQuery(<HomePage />);
    const weekCard = (await screen.findByText("이번 주")).closest(
      "[data-week-card]",
    ) as HTMLElement;
    expect(weekCard).not.toBeNull();
    expect(within(weekCard).getByText("2")).toBeInTheDocument();
    expect(within(weekCard).getByText("지난주 1잔")).toBeInTheDocument();
  });

  it("AC-QUICKBREW-22 · 주간이 월 경계를 넘으면 두 달 달력을 조회해 합산한다", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-11-01T10:00:00+09:00"));
    mockViewportWidth(390);
    useCatalogAndGearHandlers();

    const requestedMonths: string[] = [];
    server.use(
      http.get(`${BASE}/users/me`, () => HttpResponse.json(me)),
      http.get(`${BASE}/brew-logs`, () =>
        HttpResponse.json(pageOf([brewLogWithoutTds])),
      ),
      http.get(`${BASE}/brew-logs/calendar`, ({ request }) => {
        const month =
          new URL(request.url).searchParams.get("month") ?? "2026-11";
        requestedMonths.push(month);
        if (month === "2026-10") {
          return HttpResponse.json({
            month: "2026-10",
            totalCount: 2,
            days: [
              { date: "2026-10-20", count: 1, primaryRecipeName: "지난주" },
              { date: "2026-10-29", count: 1, primaryRecipeName: "이번주목" },
            ],
          });
        }
        return HttpResponse.json({
          month: "2026-11",
          totalCount: 1,
          days: [
            { date: "2026-11-01", count: 1, primaryRecipeName: "이번주일" },
          ],
        });
      }),
    );

    renderWithQuery(<HomePage />);
    const weekCard = (await screen.findByText("이번 주")).closest(
      "[data-week-card]",
    ) as HTMLElement;
    expect(requestedMonths.sort()).toEqual(["2026-10", "2026-11"]);
    expect(within(weekCard).getByText("2")).toBeInTheDocument();
    expect(within(weekCard).getByText("지난주 1잔")).toBeInTheDocument();
  });

  it("모바일 오늘 홈은 지난번과 같게로 이대로 기록을 열고 최근 기록은 최대 3건까지 보인다", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-11-14T10:00:00+09:00"));
    mockViewportWidth(390);
    useCatalogAndGearHandlers();

    const logs = [101, 102, 103, 104, 105].map((id, i) => ({
      ...brewLogWithoutTds,
      id,
      recipeId: undefined,
      beanProductId: 3,
      beanName: undefined,
      beanBatchId: undefined,
      actualDoseG: 16,
      actualWaterG: 250,
      brewRatio: 15.6,
      userGrinderId: myComandante.id,
      actualGrindSettingValue: 24,
      actualWaterTempC: 92,
      rating: 4.0,
      brewedAt: `2026-11-${String(13 - i).padStart(2, "0")}T08:20:00+09:00`,
    }));

    server.use(
      http.get(`${BASE}/users/me`, () => HttpResponse.json(me)),
      http.get(`${BASE}/brew-logs`, () => HttpResponse.json(pageOf(logs))),
      http.get(`${BASE}/brew-logs/calendar`, () =>
        HttpResponse.json(emptyCalendar("2026-11")),
      ),
    );

    const user = userEvent.setup();
    renderWithQuery(
      <>
        <HomePage />
        <QuickBrewProbe />
      </>,
    );

    const sameButton = await screen.findByRole("button", {
      name: "이대로 기록",
    });
    expect(screen.getByText("11월 14일 토요일")).toBeInTheDocument();
    expect(screen.getByText("오늘도 한 잔 내려 볼까요?")).toBeInTheDocument();
    expect(screen.getByText(/어제 08:20/)).toBeInTheDocument();
    expect(screen.getByText("1:15.6")).toBeInTheDocument();
    expect(screen.getByText(/24클릭 · 92°C/)).toBeInTheDocument();

    const recentSection = screen
      .getByRole("heading", { name: "최근 기록" })
      .closest("section") as HTMLElement;
    const recentLinks = within(recentSection)
      .getAllByRole("link")
      .filter((a) => a.getAttribute("href")?.startsWith("/brews/"));
    expect(recentLinks).toHaveLength(3);
    expect(
      within(recentSection).getByRole("link", { name: "전체 보기" }),
    ).toHaveAttribute("href", "/brews");

    await user.click(sameButton);
    expect(screen.getByTestId("qb-state")).toHaveTextContent("same");
  });

  it("웹 오늘 홈은 최근 기록 최대 5건과 TDS가 있는 가장 최근 기록의 관찰 문장을 보여준다", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-11-14T10:00:00+09:00"));
    mockViewportWidth(1280);
    useCatalogAndGearHandlers();

    const logs = [
      {
        ...brewLogWithoutTds,
        id: 201,
        recipeId: undefined,
        beanName: "직접 입력 원두",
        beanBatchId: undefined,
        beanProductId: undefined,
        tdsPercent: undefined,
        extractionYieldPercent: undefined,
        diagnosis: "측정 없는 진단",
        rating: 4.5,
        brewedAt: "2026-11-13T09:00:00+09:00",
      },
      {
        ...brewLogWithTds,
        id: 202,
        recipeId: undefined,
        beanProductId: 3,
        beanBatchId: undefined,
        tdsPercent: 1.38,
        extractionYieldPercent: 20.1,
        diagnosis: "수율이 적정하고 단맛이 잘 살아났습니다.",
        rating: 4.0,
        brewedAt: "2026-11-12T08:00:00+09:00",
      },
      {
        ...brewLogWithoutTds,
        id: 203,
        recipeId: undefined,
        beanName: "세번째",
        beanBatchId: undefined,
        brewedAt: "2026-11-11T08:00:00+09:00",
      },
      {
        ...brewLogWithoutTds,
        id: 204,
        recipeId: undefined,
        beanName: "네번째",
        beanBatchId: undefined,
        brewedAt: "2026-11-10T08:00:00+09:00",
      },
      {
        ...brewLogWithoutTds,
        id: 205,
        recipeId: undefined,
        beanName: "다섯번째",
        beanBatchId: undefined,
        brewedAt: "2026-11-09T08:00:00+09:00",
      },
      {
        ...brewLogWithoutTds,
        id: 206,
        recipeId: undefined,
        beanName: "여섯번째",
        beanBatchId: undefined,
        brewedAt: "2026-11-08T08:00:00+09:00",
      },
    ];

    server.use(
      http.get(`${BASE}/users/me`, () => HttpResponse.json(me)),
      http.get(`${BASE}/brew-logs`, () => HttpResponse.json(pageOf(logs))),
      http.get(`${BASE}/brew-logs/calendar`, () =>
        HttpResponse.json({
          month: "2026-11",
          totalCount: 5,
          days: [
            { date: "2026-11-09", count: 1, primaryRecipeName: "A" },
            { date: "2026-11-13", count: 1, primaryRecipeName: "B" },
          ],
        }),
      ),
    );

    renderWithQuery(<HomePage />);
    expect(
      await screen.findByText("수율이 적정하고 단맛이 잘 살아났습니다."),
    ).toBeInTheDocument();
    expect(screen.queryByText("측정 없는 진단")).toBeNull();
    expect(screen.getByText("20.1%")).toBeInTheDocument();

    const recentSection = screen
      .getByRole("heading", { name: "최근 기록" })
      .closest("section") as HTMLElement;
    const recentLinks = within(recentSection)
      .getAllByRole("link")
      .filter((a) => a.getAttribute("href")?.startsWith("/brews/"));
    expect(recentLinks).toHaveLength(5);
    expect(screen.queryByText("여섯번째")).toBeNull();
  });

  it("AC-QUICKBREW-65 · 300ms 이전에는 로딩 뼈대를 그리지 않고 300ms 이후부터 뼈대를 보여준 뒤 페이드 전환한다", async () => {
    vi.useFakeTimers();
    mockViewportWidth(390);

    let resolveLogs!: (body: object) => void;
    const logsPromise = new Promise<object>((resolve) => {
      resolveLogs = resolve;
    });

    server.use(
      http.get(`${BASE}/users/me`, () => HttpResponse.json(me)),
      http.get(`${BASE}/brew-logs`, async () =>
        HttpResponse.json(await logsPromise),
      ),
      http.get(`${BASE}/brew-logs/calendar`, () =>
        HttpResponse.json(emptyCalendar("2026-11")),
      ),
    );

    const { container } = renderWithQuery(<HomePage />);

    // 250ms 시점에는 뼈대가 없어야 한다
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(container.querySelector("[data-today-skeleton]")).toBeNull();

    // 300ms 도달 시 뼈대가 나타난다
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60);
    });
    expect(container.querySelector("[data-today-skeleton]")).not.toBeNull();

    // 응답 도착 후 뼈대가 사라지고 페이드 클래스와 함께 내용이 뜬다
    await act(async () => {
      resolveLogs(pageOf([]));
      await Promise.resolve();
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(20);
    });

    expect(container.querySelector("[data-today-skeleton]")).toBeNull();
    expect(screen.getByText("첫 잔을 기록해 보세요")).toBeInTheDocument();
    expect(container.querySelector(".kn-today-fade-in")).not.toBeNull();
  });
});
