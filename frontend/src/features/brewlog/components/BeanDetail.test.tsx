import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession, setAccessToken } from "@/lib/session";
import { me } from "@/test/fixtures";
import { server } from "@/test/msw-server";
import { renderWithQuery } from "@/test/render";
import { BeanDetail } from "./BeanDetail";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/beans/41",
}));

/**
 * docs/specs/2026-11-15-bean-detail.md — 원두 상세 화면(Task 7).
 * 상세 모양은 2026-11-15 로컬 `GET /bean-products/82`, 요약은 2026-11-16 로컬 `GET /brew-logs/bean-summary`.
 * null 키는 없다(백엔드 non_null). 값은 AC 그대로.
 */

const BASE = "http://localhost:8080/api/v1";

const single = {
  id: 41,
  roasterId: 3,
  roasterName: "산책 로스터스",
  name: "에티오피아 구지 함벨라",
  beanMix: "SINGLE_ORIGIN",
  roastLevel: "LIGHT",
  roastLevelAgtron: 92,
  roastLevelCustom: "Light #92",
  decaf: false,
  productUrl: "https://momos.co.kr/shop/x",
  description: "자두, 홍차, 꿀",
  verified: false,
  hidden: false,
  origins: [
    {
      id: 1,
      country: "에티오피아",
      region: "구지",
      farm: "함벨라",
      altitudeMinM: 1900,
      altitudeMaxM: 2100,
      varietyId: 3,
      processId: 1,
      ratioPercent: 100.0,
      varietyName: "에어룸",
      processName: "워시드",
    },
  ],
  createdAt: "2026-10-14T11:52:05.836466Z",
};

const summary = {
  brewCount: 5,
  ratedCount: 4,
  averageRating: 4.1,
  frequentRatio: 15.6,
  frequentDoseG: 16.0,
  frequentWaterG: 250.0,
  recent: [
    {
      id: 912,
      brewedAt: "2026-11-12T23:05:00Z",
      actualDoseG: 16.0,
      actualWaterG: 250.0,
      brewRatio: 15.6,
      rating: 4.0,
    },
    {
      id: 911,
      brewedAt: "2026-11-10T22:40:00Z",
      actualDoseG: 16.0,
      actualWaterG: 250.0,
      brewRatio: 15.6,
      rating: 4.5,
    },
    {
      id: 910,
      brewedAt: "2026-11-08T01:20:00Z",
      actualDoseG: 15.0,
      actualWaterG: 240.0,
      brewRatio: 16.0,
    },
  ],
};

const empty = { brewCount: 0, ratedCount: 0, recent: [] };

function given(
  products: Record<number, object | number>,
  summaries: Record<number, object> = {},
) {
  const productCalls: number[] = [];
  server.use(
    http.get(`${BASE}/users/me`, () => HttpResponse.json(me)),
    http.get(`${BASE}/bean-products/:id`, ({ params }) => {
      const id = Number(params.id);
      productCalls.push(id);
      const p = products[id];
      if (typeof p === "number") {
        return HttpResponse.json(
          { code: p === 404 ? "NOT_FOUND" : "INTERNAL_ERROR", message: "x" },
          { status: p },
        );
      }
      return HttpResponse.json(p);
    }),
    http.get(`${BASE}/brew-logs/bean-summary`, ({ request }) => {
      const id = Number(new URL(request.url).searchParams.get("beanProductId"));
      return HttpResponse.json(summaries[id] ?? summary);
    }),
  );
  return productCalls;
}

beforeEach(() => {
  clearSession();
  setAccessToken("a.b.c");
});

describe("원두 상세", () => {
  it("AC-BEANDETAIL-22 · 원두 상세는 있는 정보만 그린다", async () => {
    given({
      41: single,
      50: {
        ...single,
        id: 50,
        decaf: true,
        roastLevel: undefined,
        roastLevelAgtron: undefined,
        origins: [
          { ...single.origins[0], altitudeMinM: 1750, altitudeMaxM: 1750 },
        ],
      },
      60: {
        ...single,
        id: 60,
        roastLevel: undefined,
        roastLevelAgtron: undefined,
        roastLevelCustom: undefined,
        description: undefined,
        origins: [],
      },
    });

    const first = renderWithQuery(<BeanDetail id={41} />);
    const chips = await screen.findByRole("list", { name: "원두 요약" });
    expect(
      within(chips)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["싱글", "약배전", "Agtron 92"]);
    expect(screen.queryByText("Light #92")).toBeNull();
    expect(screen.getByText("1,900–2,100 m")).toBeInTheDocument();
    first.unmount();

    const second = renderWithQuery(<BeanDetail id={50} />);
    const chips50 = await screen.findByRole("list", { name: "원두 요약" });
    expect(within(chips50).getByText("디카페인")).toBeInTheDocument();
    expect(within(chips50).getByText("Light #92")).toBeInTheDocument();
    expect(screen.getByText("1,750 m")).toBeInTheDocument();
    second.unmount();

    renderWithQuery(<BeanDetail id={60} />);
    expect(
      await screen.findByText("로스터가 알려 준 정보가 아직 많지 않습니다."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "원두 요약" })).toBeNull();
    expect(screen.queryByText("컵노트 · 로스터 설명 원문")).toBeNull();
    expect(screen.queryByText("산지")).toBeNull();
  });

  it("AC-BEANDETAIL-23 · 블렌드는 산지마다 비율을 보인다", async () => {
    given({
      41: {
        ...single,
        beanMix: "BLEND",
        origins: [
          { id: 1, country: "브라질", region: "세하도", ratioPercent: 50.0 },
          { id: 2, country: "콜롬비아", region: "우일라", ratioPercent: 30.0 },
          {
            id: 3,
            country: "에티오피아",
            region: "시다마",
            ratioPercent: 20.0,
          },
        ],
      },
    });
    renderWithQuery(<BeanDetail id={41} />);

    const rows = await screen.findAllByTestId("blend-origin");
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringMatching(/^브라질 · 세하도.*50%$/),
      expect.stringMatching(/^콜롬비아 · 우일라.*30%$/),
      expect.stringMatching(/^에티오피아 · 시다마.*20%$/),
    ]);
    expect(
      screen.getByRole("img", {
        name: "브라질 50%, 콜롬비아 30%, 에티오피아 20%",
      }),
    ).toBeInTheDocument();
  });

  it("AC-BEANDETAIL-24 · 긴 컵노트는 2줄에서 접히고 누르면 펼쳐진다", async () => {
    given({ 41: { ...single, description: "가".repeat(300) } });
    renderWithQuery(<BeanDetail id={41} />);

    const note = await screen.findByRole("button", { name: /가{10}/ });
    expect(note).toHaveAttribute("aria-expanded", "false");
    expect(note.style.webkitLineClamp).toBe("2");
    await userEvent.click(note);
    expect(note).toHaveAttribute("aria-expanded", "true");
    expect(note.style.webkitLineClamp).toBe("");
  });

  it("AC-BEANDETAIL-25 · 구매처 링크는 새 탭으로, 없으면 줄이 없다", async () => {
    given({ 41: single, 42: { ...single, id: 42, productUrl: undefined } });
    const first = renderWithQuery(<BeanDetail id={41} />);
    const link = await screen.findByRole("link", { name: "구매처에서 보기 ↗" });
    expect(link).toHaveAttribute("href", "https://momos.co.kr/shop/x");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    first.unmount();

    renderWithQuery(<BeanDetail id={42} />);
    await screen.findByRole("heading", { name: single.name });
    expect(
      screen.queryByRole("link", { name: "구매처에서 보기 ↗" }),
    ).toBeNull();
  });

  it("AC-BEANDETAIL-26 · 내 기록 요약을 보인다", async () => {
    given(
      { 41: single, 42: { ...single, id: 42 } },
      { 42: { ...summary, brewCount: 4, ratedCount: 4, averageRating: 4.0 } },
    );
    const first = renderWithQuery(<BeanDetail id={41} />);
    const card = await screen.findByRole("region", {
      name: "이 원두로 내린 기록",
    });
    expect(within(card).getByText("5")).toBeInTheDocument();
    expect(within(card).getByText("잔")).toBeInTheDocument();
    expect(within(card).getByText("★ 4.1 · 4잔 기준")).toBeInTheDocument();
    expect(within(card).getByText("1:15.6")).toBeInTheDocument();
    expect(within(card).getByText("16→250")).toBeInTheDocument();
    expect(screen.getAllByTestId("bean-recent-cup")).toHaveLength(3);
    expect(screen.getAllByTestId("bean-recent-cup")[0]).toHaveTextContent(
      "11.13 금 · 08:05",
    );
    first.unmount();

    renderWithQuery(<BeanDetail id={42} />);
    const card42 = await screen.findByRole("region", {
      name: "이 원두로 내린 기록",
    });
    expect(within(card42).getByText("★ 4.0")).toBeInTheDocument();
  });

  it("AC-BEANDETAIL-27 · 내 기록이 0잔이면 안내와 주 버튼만", async () => {
    given({ 41: single }, { 41: empty });
    renderWithQuery(<BeanDetail id={41} />);

    expect(
      await screen.findByText("아직 이 원두로 내린 기록이 없어요"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "이 원두로 내린 기록" }),
    ).toBeNull();
    expect(screen.queryAllByTestId("bean-recent-cup")).toHaveLength(0);
    expect(
      screen.getByRole("button", { name: "이 원두로 기록하기" }),
    ).toBeInTheDocument();
  });

  it("AC-BEANDETAIL-28 · 숨긴 원두는 안내와 내 기록만 보인다", async () => {
    given(
      { 45: { ...single, id: 45, hidden: true } },
      { 45: { ...summary, brewCount: 4 } },
    );
    renderWithQuery(<BeanDetail id={45} />);

    expect(
      await screen.findByText(
        "카탈로그에서 내려간 원두예요. 내 기록은 그대로 남아 있어요.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: single.name }),
    ).toBeInTheDocument();
    expect(screen.getByText("산책 로스터스")).toBeInTheDocument();
    expect(
      await screen.findByRole("region", { name: "이 원두로 내린 기록" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "원두 요약" })).toBeNull();
    expect(screen.queryByText("컵노트 · 로스터 설명 원문")).toBeNull();
    expect(screen.queryByText("산지")).toBeNull();
    expect(
      screen.queryByRole("link", { name: "구매처에서 보기 ↗" }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "이 원두로 기록하기" }),
    ).toBeInTheDocument();
  });

  it("AC-BEANDETAIL-55 · 상세를 불러오지 못하면 다시 시도할 수 있다", async () => {
    const calls = given({ 41: 500 });
    renderWithQuery(<BeanDetail id={41} />);

    expect(
      await screen.findByText("원두 정보를 불러오지 못했어요"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "이 원두로 기록하기" }),
    ).toBeNull();
    const before = calls.length;
    await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await waitFor(() => expect(calls.length).toBe(before + 1));
  });

  it("AC-BEANDETAIL-56 · 상세 경로에 없는 원두", async () => {
    given({ 999999: 404 });
    renderWithQuery(<BeanDetail id={999999} />);

    expect(
      await screen.findByText("찾을 수 없는 원두입니다."),
    ).toBeInTheDocument();
    expect(screen.queryByText("원두 정보를 불러오지 못했어요")).toBeNull();
    expect(screen.queryByRole("button", { name: "다시 시도" })).toBeNull();
  });
});
