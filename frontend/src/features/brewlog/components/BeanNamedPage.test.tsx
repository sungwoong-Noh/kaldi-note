import { screen } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession, setAccessToken } from "@/lib/session";
import { me } from "@/test/fixtures";
import { server } from "@/test/msw-server";
import { renderWithQuery } from "@/test/render";
import { BeanNamedDetail } from "./BeanDetail";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/beans/named",
}));

const BASE = "http://localhost:8080/api/v1";

beforeEach(() => {
  clearSession();
  setAccessToken("a.b.c");
});

describe("직접 적은 원두", () => {
  it("AC-BEANDETAIL-29 · 직접 적은 원두는 이름과 내 기록만", async () => {
    const summaryQueries: string[] = [];
    let productCalls = 0;
    server.use(
      http.get(`${BASE}/users/me`, () => HttpResponse.json(me)),
      http.get(`${BASE}/bean-products/*`, () => {
        productCalls += 1;
        return HttpResponse.json({});
      }),
      // 모양은 2026-11-16 로컬 `GET /brew-logs/bean-summary` 응답
      http.get(`${BASE}/brew-logs/bean-summary`, ({ request }) => {
        summaryQueries.push(new URL(request.url).search);
        return HttpResponse.json({
          brewCount: 2,
          ratedCount: 2,
          averageRating: 4.0,
          frequentRatio: 15.6,
          frequentDoseG: 16.0,
          frequentWaterG: 250.0,
          recent: [
            {
              id: 2,
              brewedAt: "2026-11-13T23:05:00Z",
              actualDoseG: 16.0,
              actualWaterG: 250.0,
              brewRatio: 15.6,
              rating: 4.0,
            },
            {
              id: 1,
              brewedAt: "2026-11-12T23:05:00Z",
              actualDoseG: 16.0,
              actualWaterG: 250.0,
              brewRatio: 15.6,
              rating: 4.0,
            },
          ],
        });
      }),
    );

    renderWithQuery(<BeanNamedDetail name="하늘 블렌드" />);

    expect(
      await screen.findByRole("heading", { name: "하늘 블렌드" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("내가 이름만 적어 만든 원두 · 나만 보여요"),
    ).toBeInTheDocument();
    const card = await screen.findByRole("region", {
      name: "이 원두로 내린 기록",
    });
    expect(card).toHaveTextContent("2");
    expect(productCalls).toBe(0);
    expect(summaryQueries).toEqual([
      `?${new URLSearchParams({ beanName: "하늘 블렌드" })}`,
    ]);
  });
});
