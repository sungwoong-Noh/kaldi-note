import { screen, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
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

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
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
  clearSession();
  setAccessToken("a.b.c");
  server.use(
    http.get(`${BASE}/recipes/12`, () =>
      HttpResponse.json({ ...grindedRecipe, id: 12, title: "Kasuya 4:6" }),
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

  it("AC-WEBBREW-34 · 기록이 없으면 안내가 보인다", async () => {
    server.use(http.get(LIST_URL, () => HttpResponse.json(pageOf([]))));

    renderWithQuery(<BrewsPage />);

    expect(await screen.findByText("아직 기록이 없습니다")).toBeInTheDocument();
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

  it("AC-WEBBREW-36 · EY가 없는 항목은 그 자리가 비어 있다", async () => {
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
  });

  it("AC-WEBSHELL-21 · 카드에 비율·온도·시간이 보인다", async () => {
    server.use(
      http.get(LIST_URL, () =>
        HttpResponse.json(
          pageOf([
            {
              ...brewLogWithTds,
              recipeId: 12,
              brewRatio: 15.0,
              actualWaterTempC: 92.0,
              actualTotalTimeSeconds: 210,
            },
          ]),
        ),
      ),
    );

    renderWithQuery(<BrewsPage />);

    expect(await screen.findByText("1:15.0")).toBeInTheDocument();
    expect(screen.getByText("92°C")).toBeInTheDocument();
    expect(screen.getByText("3:30")).toBeInTheDocument();
  });

  it("AC-WEBSHELL-22 · 추출 시간이 없으면 그 자리가 없다", async () => {
    const withoutTime: Record<string, unknown> = {
      ...brewLogWithTds,
      recipeId: 12,
      brewRatio: 15.0,
    };
    delete withoutTime.actualTotalTimeSeconds;
    server.use(
      http.get(LIST_URL, () => HttpResponse.json(pageOf([withoutTime]))),
    );

    renderWithQuery(<BrewsPage />);

    expect(await screen.findByText("1:15.0")).toBeInTheDocument();
    expect(screen.queryByText(/^\d+:\d{2}$/)).not.toBeInTheDocument();
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
