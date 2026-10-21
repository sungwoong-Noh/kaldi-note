import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession, setAccessToken } from "@/lib/session";
import running from "@/test/admin/run-running.json";
import unspecialty from "@/test/admin/run-unspecialty.json";
import momosRun from "@/test/admin/run-momos.json";
import runsPage from "@/test/admin/runs-page.json";
import sources from "@/test/admin/sources.json";
import { server } from "@/test/msw-server";
import { renderWithQuery } from "@/test/render";
import CrawlPage from "./page";

const replace = vi.fn();
let currentSearch = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  usePathname: () => "/admin/crawl",
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

const BASE = "http://localhost:8080/api/v1/admin";
const SOURCES_URL = `${BASE}/crawl-sources`;
const RUNS_URL = `${BASE}/crawl-runs`;

// 픽스처는 2026-10-19 로컬 실제 응답이다. AC의 리터럴 값에 맞춰 일부 필드만 덮는다.
const [momosSource, unspecialtySource] = sources;
const { lastRun: _u, ...unspecialtyNeverRun } = unspecialtySource;
const { lastRun: _m, ...momosNeverRun } = momosSource;
void _u;
void _m;

const page = (content: object[], over: object = {}) => ({
  ...runsPage,
  content,
  totalElements: content.length,
  totalPages: 1,
  hasNext: false,
  ...over,
});

let calls: string[] = [];

function stub({
  srcs = [momosSource, unspecialtySource] as object[],
  runs = page([unspecialty, momosRun]) as object,
  run = undefined as object | undefined,
} = {}) {
  server.use(
    http.get(SOURCES_URL, () => HttpResponse.json(srcs)),
    http.get(RUNS_URL, () => HttpResponse.json(runs)),
    http.get(`${RUNS_URL}/:id`, ({ params }) =>
      run
        ? HttpResponse.json({ ...run, id: Number(params.id) })
        : HttpResponse.json(
            { code: "CRAWL_RUN_NOT_FOUND", message: "x", fieldErrors: [] },
            { status: 404 },
          ),
    ),
  );
}

beforeEach(() => {
  replace.mockClear();
  currentSearch = "";
  calls = [];
  clearSession();
  setAccessToken("a.b.c");
  server.events.removeAllListeners();
  server.events.on("request:start", ({ request }) => {
    calls.push(`${request.method} ${request.url}`);
  });
});

afterEach(() => {
  vi.useRealTimers();
});

const count = (needle: string) =>
  calls.filter((c) => c.endsWith(needle)).length;

describe("구매처", () => {
  it("AC-ADMIN-01 · 구매처 카드 2행 — lastRun이 없으면 상태가 —", async () => {
    stub({
      srcs: [
        {
          ...momosSource,
          lastRun: {
            id: 2,
            status: "SUCCEEDED",
            startedAt: "2026-10-14T12:03:00.000Z",
            finishedAt: "2026-10-14T12:03:41.000Z",
          },
        },
        unspecialtyNeverRun,
      ],
    });
    renderWithQuery(<CrawlPage />);

    const momos = await screen.findByTestId("source-momos");
    expect(within(momos).getByText("모모스커피")).toBeInTheDocument();
    expect(within(momos).getByText("momos")).toBeInTheDocument();
    expect(
      within(momos).getByText("https://momos.co.kr/Product_CoffeeBeans"),
    ).toBeInTheDocument();
    expect(within(momos).getByText("SUCCEEDED")).toBeInTheDocument();
    expect(within(momos).getByText(/00:41/)).toBeInTheDocument();
    expect(within(momos).getByRole("button", { name: "수집" })).toBeEnabled();

    const uns = screen.getByTestId("source-unspecialty");
    expect(within(uns).getByTestId("status-tag")).toHaveTextContent("—");
  });

  it("AC-ADMIN-02 · 「수집」 → POST 1회 + 패널이 RUNNING으로 열린다", async () => {
    stub({ srcs: [momosNeverRun], run: running });
    server.use(
      http.post(`${SOURCES_URL}/momos/runs`, () =>
        HttpResponse.json({ ...running, id: 130 }, { status: 202 }),
      ),
    );
    renderWithQuery(<CrawlPage />);

    const momos = await screen.findByTestId("source-momos");
    await userEvent.click(within(momos).getByRole("button", { name: "수집" }));

    expect(count(`${SOURCES_URL}/momos/runs`)).toBe(1);
    expect(replace).toHaveBeenLastCalledWith("/admin/crawl?run=130");
    const panel = await screen.findByTestId("run-panel");
    expect(within(panel).getByText("Run #130 · momos")).toBeInTheDocument();
    expect(within(panel).getByText("● RUNNING")).toBeInTheDocument();
    expect(within(panel).getByText("진행 중")).toBeInTheDocument();
    expect(
      within(panel).getByText("갱신 — · 건너뜀 — · 미매핑 —"),
    ).toBeInTheDocument();
    expect(
      within(panel).getByText(
        "수집 중입니다. 3초마다 상태를 다시 읽습니다. 생성·갱신 집계와 목록은 실행이 끝나면 표시됩니다.",
      ),
    ).toBeInTheDocument();
  });

  it("AC-ADMIN-03 · 실행 중인 구매처만 버튼이 막힌다", async () => {
    stub({
      srcs: [
        {
          ...momosSource,
          lastRun: { id: 5, status: "RUNNING", startedAt: running.startedAt },
        },
        unspecialtySource,
      ],
    });
    renderWithQuery(<CrawlPage />);

    const momos = await screen.findByTestId("source-momos");
    expect(
      within(momos).getByRole("button", { name: "수집 중" }),
    ).toBeDisabled();
    expect(
      within(screen.getByTestId("source-unspecialty")).getByRole("button", {
        name: "수집",
      }),
    ).toBeEnabled();
  });
});

describe("폴링", () => {
  it("AC-ADMIN-04 · RUNNING이면 3000ms 뒤 다시 읽고, 끝나면 멈추고 목록을 다시 읽는다", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    currentSearch = "run=130";
    let n = 0;
    stub();
    server.use(
      http.get(`${RUNS_URL}/130`, () => {
        n += 1;
        return HttpResponse.json(
          n === 1
            ? { ...running, id: 130 }
            : {
                ...momosRun,
                id: 130,
                created: 3,
              },
        );
      }),
    );
    renderWithQuery(<CrawlPage />);
    const panel = await screen.findByTestId("run-panel");
    await within(panel).findByText("진행 중");
    const sourcesBefore = count(SOURCES_URL);

    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(await within(panel).findByText("생성 3")).toBeInTheDocument();
    expect(n).toBe(2);
    await waitFor(() => expect(count(SOURCES_URL)).toBe(sourcesBefore + 1));

    await act(() => vi.advanceTimersByTimeAsync(6000));
    expect(n).toBe(2);
  });
});

describe("실행 이력", () => {
  it("AC-ADMIN-05 · 집계·굵게·RUNNING은 —", async () => {
    stub({
      runs: page([
        { ...unspecialty, id: 131 },
        { ...running, id: 130 },
      ]),
    });
    renderWithQuery(<CrawlPage />);

    expect(await screen.findByText("2건 · 최신순")).toBeInTheDocument();
    const r131 = screen.getByTestId("run-row-131");
    expect(within(r131).getByText("언스페셜티 몰")).toBeInTheDocument();
    expect(within(r131).getByText("SUCCEEDED")).toBeInTheDocument();
    expect(
      within(r131)
        .getAllByTestId("count")
        .map((c) => c.textContent),
    ).toEqual(["0", "72", "0", "41"]);
    expect(within(r131).getAllByTestId("count")[3]).toHaveClass(
      "font-semibold",
    );
    expect(
      within(screen.getByTestId("run-row-130"))
        .getAllByTestId("count")
        .map((c) => c.textContent),
    ).toEqual(["—", "—", "—", "—"]);
  });

  it("AC-ADMIN-06 · 구매처 필터 pill", async () => {
    stub();
    renderWithQuery(<CrawlPage />);
    await screen.findByText(/건 · 최신순/);

    await userEvent.click(screen.getByRole("button", { name: "모모스커피" }));
    await waitFor(() =>
      expect(count(`${RUNS_URL}?page=0&size=20&source=momos`)).toBe(1),
    );
    await userEvent.click(screen.getByRole("button", { name: "전체" }));
    expect(count(`${RUNS_URL}?page=0&size=20`)).toBeGreaterThanOrEqual(1);
  });

  it("AC-ADMIN-07 · 행 클릭 → 패널 교체", async () => {
    stub({ runs: page([{ ...unspecialty, id: 131 }]), run: unspecialty });
    renderWithQuery(<CrawlPage />);

    await userEvent.click(await screen.findByTestId("run-row-131"));
    expect(replace).toHaveBeenLastCalledWith("/admin/crawl?run=131");
    expect(
      await within(screen.getByTestId("run-panel")).findByText(
        "Run #131 · unspecialty",
      ),
    ).toBeInTheDocument();
  });

  it("AC-ADMIN-20 · 이력 0건", async () => {
    stub({ runs: page([]) });
    renderWithQuery(<CrawlPage />);

    expect(
      await screen.findByText("아직 실행 이력이 없습니다."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "위에서 구매처를 골라 「수집」을 누르면 첫 실행이 여기 쌓입니다.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("미매핑")).not.toBeInTheDocument();
  });

  it("AC-ADMIN-23 · 페이지 넘김", async () => {
    stub();
    const content = Array.from({ length: 20 }, (_, i) => ({
      ...momosRun,
      id: 100 - i,
    }));
    server.use(
      http.get(RUNS_URL, ({ request }) => {
        const p = Number(new URL(request.url).searchParams.get("page"));
        return HttpResponse.json(
          p === 0
            ? page(content, { totalElements: 25, totalPages: 2, hasNext: true })
            : page(content.slice(0, 5), {
                page: 1,
                totalElements: 25,
                totalPages: 2,
                hasNext: false,
              }),
        );
      }),
    );
    renderWithQuery(<CrawlPage />);

    expect(await screen.findByText("1–20 / 25")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "← 이전" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "다음 →" }));
    expect(await screen.findByText("21–25 / 25")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다음 →" })).toBeDisabled();
  });
});

describe("실행 상세 패널", () => {
  it("AC-ADMIN-08 · 요약 — 히어로·부가·문장", async () => {
    currentSearch = "run=128";
    stub({
      run: {
        ...momosRun,
        created: 19,
        updated: 42,
        skipped: Array.from({ length: 3 }, (_, i) => ({
          name: `s${i}`,
          reason: "USER_OWNED",
        })),
        unmapped: Array.from({ length: 5 }, (_, i) => ({
          name: `u${i}`,
          field: "process",
          raw: `r${i}`,
        })),
      },
    });
    renderWithQuery(<CrawlPage />);
    const panel = await screen.findByTestId("run-panel");

    expect(await within(panel).findByText("생성 19")).toBeInTheDocument();
    expect(
      within(panel).getByText("갱신 42 · 건너뜀 3 · 미매핑 5"),
    ).toBeInTheDocument();
    expect(
      within(panel).getByText(
        "이번 실행에서 상품 3건을 건너뛰고, 원문 5건을 매핑하지 못했습니다.",
      ),
    ).toBeInTheDocument();
  });

  it("AC-ADMIN-09 · 건너뛴 상품 사유별 묶음", async () => {
    currentSearch = "run=128";
    stub({
      run: {
        ...momosRun,
        skipped: [
          { name: "a", reason: "USER_OWNED" },
          { name: "b", reason: "FETCH_FAILED" },
          { name: "c", reason: "FETCH_FAILED" },
        ],
      },
    });
    renderWithQuery(<CrawlPage />);
    const panel = await screen.findByTestId("run-panel");

    const heads = await within(panel).findAllByTestId("skip-group");
    expect(heads.map((h) => h.textContent)).toEqual([
      "USER_OWNED사용자가 등록한 원두 — 덮어쓰지 않음1건",
      "FETCH_FAILED상품 페이지를 읽지 못함2건",
    ]);
  });

  it("AC-ADMIN-10 · 미매핑 field별·5건 접기·따옴표 (실제 응답)", async () => {
    currentSearch = "run=4";
    stub({ run: unspecialty });
    renderWithQuery(<CrawlPage />);
    const panel = await screen.findByTestId("run-panel");

    const groups = await within(panel).findAllByTestId("unmapped-group");
    expect(groups.map((g) => g.dataset.field)).toEqual(["variety", "process"]);
    expect(within(groups[0]).getAllByTestId("raw")).toHaveLength(5);
    expect(within(groups[0]).getAllByTestId("raw")[0].textContent).toMatch(
      /^“.+”$/,
    );
    await userEvent.click(
      within(groups[0]).getByRole("button", { name: "나머지 20건 보기" }),
    );
    expect(within(groups[0]).getAllByTestId("raw")).toHaveLength(25);
  });

  it("AC-ADMIN-12 · ?run= 딥링크로 패널이 열리고 「닫기」는 쿼리를 지운다", async () => {
    currentSearch = "run=131";
    stub({ run: unspecialty });
    renderWithQuery(<CrawlPage />);

    const panel = await screen.findByTestId("run-panel");
    expect(
      await within(panel).findByText("Run #131 · unspecialty"),
    ).toBeInTheDocument();
    expect(count(`${RUNS_URL}/131`)).toBe(1);

    await userEvent.click(within(panel).getByRole("button", { name: "닫기" }));
    expect(replace).toHaveBeenLastCalledWith("/admin/crawl");
    expect(screen.queryByTestId("run-panel")).not.toBeInTheDocument();
  });

  it("AC-ADMIN-21 · 건너뜀·미매핑 0건 — 문장 + 이력의 0은 흐리게", async () => {
    currentSearch = "run=5";
    stub({ runs: page([momosRun]), run: momosRun });
    renderWithQuery(<CrawlPage />);

    expect(
      await screen.findByText(
        "이번 실행에서 건너뛴 상품과 매핑하지 못한 원문이 없습니다.",
      ),
    ).toBeInTheDocument();
    const zero = within(screen.getByTestId("run-row-5")).getAllByTestId(
      "count",
    )[0];
    expect(zero).toHaveTextContent("0");
    expect(zero).toHaveClass("text-ink-3");
  });

  it("AC-ADMIN-22 · INTERRUPTED는 종료·소요·집계가 —", async () => {
    currentSearch = "run=5";
    const interrupted = { ...momosRun, status: "INTERRUPTED", updated: 0 };
    stub({ runs: page([interrupted]), run: interrupted });
    renderWithQuery(<CrawlPage />);
    const panel = await screen.findByTestId("run-panel");

    expect(
      await within(panel).findByText(
        "앱이 재시작되어 실행이 중단되었습니다. 중단 전에 반영된 원두는 집계에 남지 않았습니다.",
      ),
    ).toBeInTheDocument();
    expect(within(panel).getByTestId("run-end")).toHaveTextContent("—");
    expect(within(panel).getByTestId("run-duration")).toHaveTextContent("—");
    const row = screen.getByTestId("run-row-5");
    expect(within(row).getByTestId("run-duration")).toHaveTextContent("—");
    expect(
      within(row)
        .getAllByTestId("count")
        .map((c) => c.textContent),
    ).toEqual(["—", "—", "—", "—"]);
  });
});

describe("실패", () => {
  it("AC-ADMIN-31 · 409면 안내하고 진행 중 실행을 연다", async () => {
    let srcCalls = 0;
    stub({ run: running });
    server.use(
      http.get(SOURCES_URL, () => {
        srcCalls += 1;
        // 첫 응답은 낡은 목록(실행 없음), 다시 읽으면 RUNNING #129가 보인다.
        return HttpResponse.json(
          srcCalls === 1
            ? [momosNeverRun]
            : [
                {
                  ...momosSource,
                  lastRun: {
                    id: 129,
                    status: "RUNNING",
                    startedAt: running.startedAt,
                  },
                },
              ],
        );
      }),
      http.post(`${SOURCES_URL}/momos/runs`, () =>
        HttpResponse.json(
          {
            code: "CRAWL_ALREADY_RUNNING",
            message: "이 수집 대상은 이미 실행 중입니다.",
            fieldErrors: [],
          },
          { status: 409 },
        ),
      ),
    );
    renderWithQuery(<CrawlPage />);

    const momos = await screen.findByTestId("source-momos");
    await userEvent.click(within(momos).getByRole("button", { name: "수집" }));

    expect(
      await screen.findByText(
        "409 CRAWL_ALREADY_RUNNING — 이 구매처는 이미 수집 중이라 새 실행을 시작하지 않았습니다. 진행 중인 실행 #129를 표시합니다.",
      ),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(replace).toHaveBeenLastCalledWith("/admin/crawl?run=129"),
    );
  });

  it("AC-ADMIN-32 · FAILED 패널 — errorMessage, 목록 없음", async () => {
    currentSearch = "run=7";
    stub({
      run: {
        ...momosRun,
        status: "FAILED",
        updated: 0,
        errorMessage: "목록에서 상품 링크를 찾지 못했습니다",
      },
    });
    renderWithQuery(<CrawlPage />);
    const panel = await screen.findByTestId("run-panel");

    expect(
      await within(panel).findByText(
        "실행 전체가 실패했습니다. 이번 실행으로 생성되거나 갱신된 원두는 없습니다.",
      ),
    ).toBeInTheDocument();
    expect(within(panel).getByTestId("error-message")).toHaveTextContent(
      "목록에서 상품 링크를 찾지 못했습니다",
    );
    expect(within(panel).queryByText("건너뛴 상품")).not.toBeInTheDocument();
    expect(
      within(panel).queryByText("매핑하지 못한 원문"),
    ).not.toBeInTheDocument();
  });

  it("AC-ADMIN-33 · 없는 실행 딥링크", async () => {
    currentSearch = "run=999999";
    stub();
    renderWithQuery(<CrawlPage />);

    expect(
      await screen.findByText("실행 #999999을 찾지 못했습니다."),
    ).toBeInTheDocument();
    expect(screen.getByTestId("source-momos")).toBeInTheDocument();
    expect(screen.getByText(/건 · 최신순/)).toBeInTheDocument();
  });
});
