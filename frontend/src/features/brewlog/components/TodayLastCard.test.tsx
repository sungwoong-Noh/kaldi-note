import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { BeanProduct } from "@/features/catalog/schema";
import { me, yirgacheffeProduct } from "@/test/fixtures";
import { renderWithQuery } from "@/test/render";
import type { BrewLogSummary } from "../schema";
import { TodayLastBrewCard } from "./TodayHome";

/** docs/specs/2026-11-15-bean-detail.md AC-BEANDETAIL-32 — 오늘 「지난번과 같게」 카드의 원두 이름 링크. */

const last = {
  id: 501,
  userId: me.id,
  brewedAt: "2026-11-13T23:20:00Z",
  visibility: "PRIVATE",
  actualDoseG: 16.0,
  actualWaterG: 250.0,
  brewRatio: 15.6,
  createdAt: "2026-11-13T23:21:00Z",
  updatedAt: "2026-11-13T23:21:00Z",
} as BrewLogSummary;

function metadata(products: BeanProduct[] = []) {
  return {
    productsById: new Map(products.map((p) => [p.id, p])),
    batchesById: new Map(),
    roastersById: new Map(),
    recipeTitlesById: new Map(),
    recipeGrindUnitsById: new Map(),
    grinders: [],
  };
}

function hrefOf(name: string) {
  const link = screen.getByRole("link", { name });
  const url = new URL(link.getAttribute("href") ?? "", "http://x");
  return { pathname: url.pathname, name: url.searchParams.get("name") };
}

describe("오늘 「지난번과 같게」 카드", () => {
  it("AC-BEANDETAIL-32 · 오늘 「지난번과 같게」의 원두 이름은 원두 상세로 간다", () => {
    const product = { ...yirgacheffeProduct, id: 41 } as BeanProduct;
    const first = renderWithQuery(
      <TodayLastBrewCard
        log={{ ...last, beanProductId: 41 }}
        todayKst="2026-11-14"
        isWide={false}
        metadata={metadata([product])}
      />,
    );
    expect(hrefOf(product.name)).toEqual({ pathname: "/beans/41", name: null });
    expect(
      screen.getByRole("button", { name: "이대로 기록" }),
    ).toBeInTheDocument();
    first.unmount();

    renderWithQuery(
      <TodayLastBrewCard
        log={{ ...last, beanName: "하늘 블렌드" }}
        todayKst="2026-11-14"
        isWide={false}
        metadata={metadata()}
      />,
    );
    expect(hrefOf("하늘 블렌드")).toEqual({
      pathname: "/beans/named",
      name: "하늘 블렌드",
    });
  });
});
