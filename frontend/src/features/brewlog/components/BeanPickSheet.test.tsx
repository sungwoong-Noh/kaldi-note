import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { setAccessToken } from "@/lib/session";
import {
  fritzRoaster,
  me,
  myComandante,
  yirgacheffeProduct,
} from "@/test/fixtures";
import { server } from "@/test/msw-server";
import { renderWithQuery } from "@/test/render";
import { QuickBrewSheet } from "./QuickBrewSheet";

/**
 * docs/specs/2026-11-15-bean-detail.md — 원두 고르기 결과 행 · 정보 시트(Task 6).
 * 검색 행 · 상세 · 요약의 모양은 2026-11-15~16 로컬 실제 응답에서 떴다(null 키는 없다). 값은 AC 그대로.
 */

const BASE = "http://localhost:8080/api/v1";

const decafBlend = {
  id: 41,
  name: "하우스 블렌드 디카페인",
  roasterId: 7,
  roasterName: "북쪽 커피",
  beanMix: "BLEND",
  roastLevel: "MEDIUM_DARK",
  decaf: true,
  countries: ["브라질", "콜롬비아", "에티오피아"],
};
const unknownRoast = {
  id: 42,
  name: "구지 시즌 블렌드",
  roasterId: 8,
  roasterName: "하늘 커피",
  beanMix: "SINGLE_ORIGIN",
  decaf: false,
  countries: [],
};
/** 원두 41 상세 — 모양은 로컬 `GET /bean-products/82`. */
const decafBlendDetail = {
  id: 41,
  roasterId: 7,
  roasterName: "북쪽 커피",
  name: "하우스 블렌드 디카페인",
  beanMix: "BLEND",
  roastLevel: "MEDIUM_DARK",
  decaf: true,
  description: "다크 초콜릿, 견과",
  verified: false,
  hidden: false,
  origins: [
    { id: 1, country: "브라질", ratioPercent: 50.0 },
    { id: 2, country: "콜롬비아", ratioPercent: 30.0 },
    { id: 3, country: "에티오피아", ratioPercent: 20.0 },
  ],
  createdAt: "2026-11-15T00:00:00Z",
};
/** 모양은 로컬 `GET /brew-logs/bean-summary?beanProductId=82`. */
const decafBlendSummary = {
  brewCount: 5,
  ratedCount: 4,
  averageRating: 4.1,
  frequentRatio: 15.6,
  frequentDoseG: 16.0,
  frequentWaterG: 250.0,
  recent: [
    {
      id: 912,
      brewedAt: "2026-11-13T23:05:00Z",
      actualDoseG: 16.0,
      actualWaterG: 250.0,
      brewRatio: 15.6,
      rating: 4.0,
    },
  ],
};

/** 지난번 — 카탈로그 원두(yirgacheffeProduct). */
const last = {
  id: 501,
  userId: me.id,
  beanProductId: yirgacheffeProduct.id,
  brewedAt: "2026-11-13T23:20:00Z",
  visibility: "FRIENDS",
  actualDoseG: 16.0,
  actualWaterG: 250.0,
  userGrinderId: myComandante.id,
  brewRatio: 15.6,
  createdAt: "2026-11-13T23:21:00Z",
  updatedAt: "2026-11-13T23:21:00Z",
};

function page(content: object[], totalElements = content.length) {
  return {
    content,
    page: 0,
    size: 20,
    totalElements,
    totalPages: Math.ceil(totalElements / 20),
    hasNext: totalElements > 20,
  };
}

/** 검색 요청의 q를 모은다. */
function given({
  logs = [last],
  rows = [decafBlend, unknownRoast],
  totalElements,
  details = {},
}: {
  logs?: object[];
  rows?: object[];
  totalElements?: number;
  details?: Record<number, object>;
} = {}) {
  const searches: string[] = [];
  server.use(
    http.get(`${BASE}/users/me`, () => HttpResponse.json(me)),
    http.get(`${BASE}/brew-logs`, () => HttpResponse.json(page(logs))),
    http.get(`${BASE}/bean-products`, ({ request }) => {
      searches.push(new URL(request.url).searchParams.get("q") ?? "");
      return HttpResponse.json(page(rows, totalElements));
    }),
    http.get(`${BASE}/bean-products/:id`, ({ params }) => {
      const id = Number(params.id);
      const detail =
        details[id] ??
        (id === 41
          ? decafBlendDetail
          : id === yirgacheffeProduct.id
            ? yirgacheffeProduct
            : null);
      return detail
        ? HttpResponse.json(detail)
        : HttpResponse.json({ code: "NOT_FOUND" }, { status: 404 });
    }),
    http.get(`${BASE}/brew-logs/bean-summary`, () =>
      HttpResponse.json(decafBlendSummary),
    ),
    http.get(`${BASE}/roasters`, () => HttpResponse.json([fritzRoaster])),
    http.get(`${BASE}/gear/user-grinders`, () =>
      HttpResponse.json([myComandante]),
    ),
  );
  return searches;
}

async function openBeanPicker() {
  renderWithQuery(<QuickBrewSheet start="record" onClose={() => {}} />);
  await userEvent.click(
    await screen.findByRole("button", { name: "바꿀래요" }),
  );
  await userEvent.click(screen.getByRole("button", { name: "원두 고르기" }));
}

async function search(text: string) {
  await userEvent.type(screen.getByLabelText("원두 검색"), text);
  return screen.findByRole("list", { name: "카탈로그" });
}

beforeEach(() => setAccessToken("a.b.c"));

describe("원두 고르기 결과 행", () => {
  it("AC-BEANDETAIL-20 · 원두 고르기 결과 행에 원두 정보와 「정보」가 있다", async () => {
    given();
    await openBeanPicker();
    const list = await search("구지");

    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("디카페인")).toBeInTheDocument();
    expect(rows[0]).toHaveTextContent("북쪽 커피 · 중강배전 · 블렌드 · 3개국");
    expect(rows[1].querySelector("[data-roast-dot-unknown]")).not.toBeNull();
    expect(
      within(rows[1]).getByText("하늘 커피", { exact: true }),
    ).toBeInTheDocument();
    for (const name of ["하우스 블렌드 디카페인", "구지 시즌 블렌드"]) {
      const info = screen.getByRole("button", { name: `${name} 정보` });
      expect(info).toHaveClass("min-h-[44px]", "min-w-[52px]");
    }
  });

  it("AC-BEANDETAIL-21 · 「정보」는 시트를 쌓고, 「이 원두 고르기」로 고른다", async () => {
    given();
    await openBeanPicker();
    await search("구지");

    await userEvent.click(
      screen.getByRole("button", { name: "하우스 블렌드 디카페인 정보" }),
    );
    const sheet = await screen.findByRole("dialog", {
      name: "하우스 블렌드 디카페인",
    });
    expect(
      await within(sheet).findByText("5잔 · ★ 4.1 · 1:15.6"),
    ).toBeInTheDocument();
    await userEvent.click(
      within(sheet).getByRole("button", { name: "이 원두 고르기" }),
    );

    expect(
      screen.queryByRole("dialog", { name: "하우스 블렌드 디카페인" }),
    ).toBeNull();
    expect(screen.queryByLabelText("원두 검색")).toBeNull();
    expect(
      await screen.findByText("하우스 블렌드 디카페인"),
    ).toBeInTheDocument();
  });

  it("행 자체를 누르면 시트 없이 바로 고른다", async () => {
    given();
    await openBeanPicker();
    await search("구지");

    await userEvent.click(
      screen.getByRole("button", { name: /^구지 시즌 블렌드(?! 정보)/ }),
    );

    expect(
      screen.queryByRole("dialog", { name: "구지 시즌 블렌드" }),
    ).toBeNull();
    expect(screen.queryByLabelText("원두 검색")).toBeNull();
  });

  it("AC-BEANDETAIL-31 · 숨긴 원두는 최근 원두에서 빠진다", async () => {
    const hidden45 = {
      ...yirgacheffeProduct,
      id: 45,
      name: "숨긴 원두 45",
      hidden: true,
    };
    const product41 = { ...decafBlendDetail, name: "상품 41 이름" };
    given({
      logs: [
        { ...last, id: 1, beanProductId: 45 },
        { ...last, id: 2, beanProductId: 41 },
        {
          ...last,
          id: 3,
          beanProductId: undefined,
          beanName: "하늘 블렌드",
        },
      ],
      details: { 45: hidden45, 41: product41 },
    });
    renderWithQuery(<QuickBrewSheet start="record" onClose={() => {}} />);

    // 「지난번」 원두 줄은 숨긴 원두여도 그대로다
    expect(await screen.findByText("숨긴 원두 45")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "바꿀래요" }));
    await userEvent.click(screen.getByRole("button", { name: "원두 고르기" }));

    const recent = screen.getByRole("list", { name: "최근 고른 원두" });
    await waitFor(() =>
      expect(
        [...recent.querySelectorAll("li")].map((li) => li.textContent),
      ).toEqual(["상품 41 이름", "하늘 블렌드"]),
    );
  });

  it("AC-BEANDETAIL-34 · 검색 결과가 20개를 넘으면 좁히라고 안내한다", async () => {
    const twenty = Array.from({ length: 20 }, (_, i) => ({
      ...unknownRoast,
      id: 100 + i,
      name: `구지 ${i}`,
    }));
    given({ rows: twenty, totalElements: 37 });
    await openBeanPicker();
    const list = await search("구지");

    expect(within(list).getAllByRole("listitem")).toHaveLength(20);
    expect(
      screen.getByText("20개까지 보여요 — 더 좁혀 보세요"),
    ).toBeInTheDocument();
  });

  it("검색 결과가 정확히 20개면 안내가 없다", async () => {
    const twenty = Array.from({ length: 20 }, (_, i) => ({
      ...unknownRoast,
      id: 100 + i,
      name: `구지 ${i}`,
    }));
    given({ rows: twenty, totalElements: 20 });
    await openBeanPicker();
    await search("구지");

    expect(screen.queryByText("20개까지 보여요 — 더 좁혀 보세요")).toBeNull();
  });

  it("AC-BEANDETAIL-44 · 검색어는 1글자부터, 250ms 뒤 한 번만 부른다", async () => {
    const searches = given();
    await openBeanPicker();
    const user = userEvent.setup({ delay: 100 });

    await user.type(screen.getByLabelText("원두 검색"), "구지");
    await screen.findByRole("list", { name: "카탈로그" });
    await new Promise((r) => setTimeout(r, 300));
    expect(searches).toEqual(["구지"]);

    await user.clear(screen.getByLabelText("원두 검색"));
    await new Promise((r) => setTimeout(r, 300));
    expect(searches).toEqual(["구지"]);
    expect(
      screen.getByRole("list", { name: "최근 고른 원두" }),
    ).toBeInTheDocument();
  });
});
