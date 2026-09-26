import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

// 개별 테스트가 vi.useFakeTimers()를 걸고 도중에 실패하면 vi.useRealTimers()가 실행되지
// 못해 뒤따르는 모든 테스트가 5초 타임아웃으로 줄줄이 실패한다. 여기서 무조건 되돌린다.
afterEach(() => {
  vi.useRealTimers();
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

  it("AC-RECIPESBREWS-63 · 내 서랍 소유 필터 pill로 owner가 바뀐다", async () => {
    const searches: string[] = [];
    server.use(
      http.get(LIST_URL, ({ request }) => {
        searches.push(new URL(request.url).search);
        return HttpResponse.json(pageOf([hoffmannSummary]));
      }),
    );
    const user = userEvent.setup();

    renderWithQuery(<RecipesPage />);
    await screen.findByRole("tab", { name: "내 서랍", selected: true });

    await user.click(screen.getByRole("button", { name: "내가 만든" }));

    await waitFor(() => {
      const last = decodeURIComponent(searches.at(-1) ?? "");
      expect(last).toContain("scope=DRAWER");
      expect(last).toContain("owner=MINE");
    });
  });

  it("AC-RECIPESBREWS-64 · 정렬 토글로 sort가 바뀐다", async () => {
    const searches: string[] = [];
    server.use(
      http.get(LIST_URL, ({ request }) => {
        searches.push(new URL(request.url).search);
        return HttpResponse.json(pageOf([hoffmannSummary]));
      }),
    );
    const user = userEvent.setup();

    renderWithQuery(<RecipesPage />);
    await user.click(await screen.findByRole("tab", { name: "둘러보기" }));

    // 초기값 인기순은 sort 파라미터를 보내지 않는다.
    await waitFor(() =>
      expect(decodeURIComponent(searches.at(-1) ?? "")).not.toContain("sort="),
    );

    await user.click(screen.getByRole("button", { name: "최신순" }));
    await waitFor(() =>
      expect(decodeURIComponent(searches.at(-1) ?? "")).toContain(
        "sort=RECENT",
      ),
    );

    await user.click(screen.getByRole("button", { name: "인기순" }));
    await waitFor(() =>
      expect(decodeURIComponent(searches.at(-1) ?? "")).not.toContain("sort="),
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

  it("AC-RECIPESBREWS-59 · 둘러보기 검색어는 300ms 디바운스로 조회된다", async () => {
    const searches: string[] = [];
    server.use(
      http.get(LIST_URL, ({ request }) => {
        searches.push(new URL(request.url).search);
        return HttpResponse.json(pageOf([hoffmannSummary]));
      }),
    );
    const user = userEvent.setup();

    renderWithQuery(<RecipesPage />);
    await user.click(await screen.findByRole("tab", { name: "둘러보기" }));
    const input = await screen.findByLabelText("레시피 검색");
    const callsBeforeType = searches.length;

    // 렌더·탐색까지는 실제 타이머로 끝내고, 디바운스를 만드는 change부터 가짜 타이머로 바꾼다.
    // 먼저 켜 두면 jsdom + RTL의 비동기 유틸(findBy*) 폴링이 멈춰 화면이 절대 안정되지 않고,
    // change 뒤에 켜면 그 change가 만든 setTimeout은 이미 실제 타이머라 가짜 시간이 건드리지 못한다.
    vi.useFakeTimers();
    fireEvent.change(input, { target: { value: "워시드" } });

    await vi.advanceTimersByTimeAsync(299);
    expect(searches.length).toBe(callsBeforeType);

    // 디바운스 타이머 자체는 가짜 시간으로 정확히 300ms에 터뜨린다. 그 콜백 이후의 실제
    // fetch 왕복은 MSW가 내부적으로 쓰는 타이머가 vitest의 가짜 시간과 얽혀 결코 안 풀리므로,
    // 타이머를 터뜨린 뒤 곧장 실제 타이머로 돌아가 fetch가 도착하는 것을 관찰한다.
    await vi.advanceTimersByTimeAsync(1);
    vi.useRealTimers();
    await waitFor(() => expect(searches.length).toBe(callsBeforeType + 1));
    expect(searches.at(-1)).toContain("q=%EC%9B%8C%EC%8B%9C%EB%93%9C");
  });

  it("AC-RECIPESBREWS-60 · IME 조합 중에는 검색 요청이 나가지 않는다", async () => {
    const searches: string[] = [];
    server.use(
      http.get(LIST_URL, ({ request }) => {
        searches.push(new URL(request.url).search);
        return HttpResponse.json(pageOf([hoffmannSummary]));
      }),
    );
    const user = userEvent.setup();

    renderWithQuery(<RecipesPage />);
    await user.click(await screen.findByRole("tab", { name: "둘러보기" }));
    const input = await screen.findByLabelText("레시피 검색");
    const callsBeforeType = searches.length;

    vi.useFakeTimers();
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: "ㅇ" } });
    fireEvent.change(input, { target: { value: "워" } });
    fireEvent.change(input, { target: { value: "워시" } });
    expect(searches.length).toBe(callsBeforeType);

    fireEvent.compositionEnd(input, { target: { value: "워시드" } });

    await vi.advanceTimersByTimeAsync(299);
    expect(searches.length).toBe(callsBeforeType);

    await vi.advanceTimersByTimeAsync(1);
    vi.useRealTimers();
    await waitFor(() => expect(searches.length).toBe(callsBeforeType + 1));
    expect(searches.at(-1)).toContain("q=%EC%9B%8C%EC%8B%9C%EB%93%9C");
  });

  it("AC-RECIPESBREWS-80 · ⌘K/Ctrl+K가 검색 입력에 포커스한다", async () => {
    server.use(
      http.get(LIST_URL, () => HttpResponse.json(pageOf([hoffmannSummary]))),
    );
    const user = userEvent.setup();

    renderWithQuery(<RecipesPage />);
    await user.click(await screen.findByRole("tab", { name: "둘러보기" }));
    const input = await screen.findByLabelText("레시피 검색");
    expect(input).not.toHaveFocus();

    await user.keyboard("{Control>}k{/Control}");

    expect(input).toHaveFocus();
  });

  it("AC-RECIPESBREWS-61 · 온도·배전도·기구 필터가 웹에서 즉시 반영된다", async () => {
    const searches: string[] = [];
    server.use(
      http.get(LIST_URL, ({ request }) => {
        searches.push(new URL(request.url).search);
        return HttpResponse.json(pageOf([hoffmannSummary]));
      }),
    );
    const user = userEvent.setup();

    renderWithQuery(<RecipesPage />);
    await user.click(await screen.findByRole("tab", { name: "둘러보기" }));

    await user.click(screen.getByRole("button", { name: "Hot" }));
    await user.click(screen.getByRole("button", { name: "중배전" }));
    await user.click(screen.getByRole("button", { name: "V60" }));

    await waitFor(() => {
      const last = decodeURIComponent(searches.at(-1) ?? "");
      expect(last).toContain("temp=HOT");
      expect(last).toContain("roast=MEDIUM");
      expect(last).toContain("dripper=V60");
    });
  });

  it("AC-RECIPESBREWS-62 · 원두량 슬라이더는 드래그(pointerup)에서 1회만 조회된다", async () => {
    const searches: string[] = [];
    server.use(
      http.get(LIST_URL, ({ request }) => {
        searches.push(new URL(request.url).search);
        return HttpResponse.json(pageOf([hoffmannSummary]));
      }),
    );
    const user = userEvent.setup();

    renderWithQuery(<RecipesPage />);
    await user.click(await screen.findByRole("tab", { name: "둘러보기" }));
    const callsBeforeDrag = searches.length;
    const minHandle = screen.getByLabelText("원두량 최소");

    fireEvent.pointerDown(minHandle);
    fireEvent.change(minHandle, { target: { value: "15" } });
    fireEvent.change(minHandle, { target: { value: "18" } });
    expect(searches.length).toBe(callsBeforeDrag);

    fireEvent.pointerUp(minHandle);

    await waitFor(() =>
      expect(searches.length).toBe(callsBeforeDrag + 1),
    );
    expect(searches.at(-1)).toContain("doseMin=18");
  });

  it("AC-RECIPESBREWS-62 · 화살표 키 연타는 마지막 입력 후 200ms 디바운스로 1회만 조회된다", async () => {
    const searches: string[] = [];
    server.use(
      http.get(LIST_URL, ({ request }) => {
        searches.push(new URL(request.url).search);
        return HttpResponse.json(pageOf([hoffmannSummary]));
      }),
    );
    const user = userEvent.setup();

    renderWithQuery(<RecipesPage />);
    await user.click(await screen.findByRole("tab", { name: "둘러보기" }));
    const callsBeforeKeys = searches.length;
    const maxHandle = screen.getByLabelText("원두량 최대");

    vi.useFakeTimers();
    for (const value of [29, 28, 27, 26, 25]) {
      fireEvent.change(maxHandle, { target: { value: String(value) } });
    }
    expect(searches.length).toBe(callsBeforeKeys);

    await vi.advanceTimersByTimeAsync(199);
    expect(searches.length).toBe(callsBeforeKeys);

    await vi.advanceTimersByTimeAsync(1);
    vi.useRealTimers();
    await waitFor(() =>
      expect(searches.length).toBe(callsBeforeKeys + 1),
    );
    expect(searches.at(-1)).toContain("doseMax=25");
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

  // 같은 시나리오를 AC-RECIPESBREWS-83도 요구한다.
  it("AC-WEB-11 · AC-RECIPESBREWS-83 · hasNext가 false면 더 보기 버튼이 없다", async () => {
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

  it("AC-WEB-13 · AC-RECIPESBREWS-85 · 내 서랍이 비어 있으면 새 레시피 CTA를 보여준다", async () => {
    server.use(http.get(LIST_URL, () => HttpResponse.json(pageOf([]))));

    renderWithQuery(<RecipesPage />);

    expect(await screen.findByText("레시피가 없습니다")).toBeInTheDocument();
    const cta = screen
      .getByText("레시피가 없습니다")
      .closest("[data-empty]")
      ?.querySelector("a");
    expect(cta).toHaveAttribute("href", "/recipes/new");
  });

  it("AC-RECIPESBREWS-84 · 둘러보기 결과 0건이면 안내 카드가 뜬다", async () => {
    server.use(http.get(LIST_URL, () => HttpResponse.json(pageOf([]))));
    const user = userEvent.setup();

    renderWithQuery(<RecipesPage />);
    await user.click(await screen.findByRole("tab", { name: "둘러보기" }));

    expect(
      await screen.findByText("찾는 레시피가 없나요?"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("검색어를 줄이거나 필터를 해제해 보세요."),
    ).toBeInTheDocument();
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

describe("RecipesPage — 로딩", () => {
  it("AC-RECIPESBREWS-101 · 조회 중에는 로딩 상태가 표시된다", async () => {
    server.use(
      http.get(LIST_URL, async () => {
        await delay(300);
        return HttpResponse.json(pageOf([hoffmannSummary]));
      }),
    );

    renderWithQuery(<RecipesPage />);

    expect(
      await screen.findByRole("status", { name: "불러오는 중" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("James Hoffmann Ultimate V60"),
    ).not.toBeInTheDocument();
  });
});
