import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession, setAccessToken } from "@/lib/session";
import { brewLogPage, grindedRecipe, me } from "@/test/fixtures";
import { server } from "@/test/msw-server";
import { renderWithQuery } from "@/test/render";
import HomePage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
}));

const BASE = "http://localhost:8080/api/v1";

const 지연 = { id: 12, nickname: "지연" };

function calendarResponse(month: string, userId?: number) {
  if (userId === undefined && month === "2026-09") {
    return {
      month,
      totalCount: 2,
      days: [
        { date: "2026-09-02", count: 1, primaryRecipeName: "Hoffmann V60" },
        { date: "2026-09-05", count: 2, primaryRecipeName: "Kasuya 4:6" },
      ],
    };
  }
  if (userId === 12 && month === "2026-09") {
    return {
      month,
      totalCount: 6,
      days: [{ date: "2026-09-10", count: 1, primaryRecipeName: "Hoffmann V60" }],
    };
  }
  return { month, totalCount: 0, days: [] };
}

function dayOf(id: number, date: string, userId = 11) {
  return {
    ...brewLogPage.content[0],
    id,
    userId,
    recipeId: 12,
    brewedAt: `${date}T01:00:00Z`,
  };
}

function pageOf(content: object[]) {
  return { ...brewLogPage, content, totalElements: content.length, hasNext: false };
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date("2026-09-19T01:00:00Z"));
  clearSession();
  setAccessToken("a.b.c");

  server.use(
    http.get(`${BASE}/users/me`, () => HttpResponse.json(me)),
    http.get(`${BASE}/users/me/mutual-follows`, () => HttpResponse.json([지연])),
    http.get(`${BASE}/recipes/12`, () =>
      HttpResponse.json({ ...grindedRecipe, id: 12, title: "Kasuya 4:6" }),
    ),
    http.get(`${BASE}/brew-logs/calendar`, ({ request }) => {
      const url = new URL(request.url);
      const userId = url.searchParams.get("userId");
      return HttpResponse.json(
        calendarResponse(
          url.searchParams.get("month") ?? "",
          userId === null ? undefined : Number(userId),
        ),
      );
    }),
    http.get(`${BASE}/brew-logs`, ({ request }) => {
      const url = new URL(request.url);
      const date = url.searchParams.get("date");
      const userId = url.searchParams.get("userId");
      if (date === "2026-09-05" && userId === null)
        return HttpResponse.json(pageOf([dayOf(1, date), dayOf(2, date)]));
      if (date === "2026-09-10" && userId === "12")
        return HttpResponse.json(pageOf([dayOf(3, date, 12)]));
      return HttpResponse.json(pageOf([]));
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
});

async function renderHome() {
  const result = renderWithQuery(<HomePage />);
  await screen.findByText("2026.09");
  return result;
}

describe("HomePage", () => {
  it("AC-HOMECAL-27 · 진입하면 오늘이 선택돼 있다", async () => {
    await renderHome();

    expect(
      await screen.findByRole("button", { name: "9월 19일, 기록 없음" }),
    ).toHaveAttribute("aria-current", "date");
  });

  it("AC-HOMECAL-28 · 날짜를 누르면 목록이 그 날짜 기록으로 바뀐다", async () => {
    await renderHome();

    await userEvent.click(
      await screen.findByRole("button", { name: "9월 5일, 기록 2건" }),
    );

    expect(await screen.findByText("09.05 SAT · 2 BREWS")).toBeInTheDocument();
    expect(screen.getAllByTestId("day-list-row")).toHaveLength(2);
  });

  it("AC-HOMECAL-29 · 빈 날짜를 누르면 선택되고 빈 문구가 뜬다", async () => {
    await renderHome();

    await userEvent.click(
      await screen.findByRole("button", { name: "9월 3일, 기록 없음" }),
    );

    expect(
      screen.getByRole("button", { name: "9월 3일, 기록 없음" }),
    ).toHaveAttribute("aria-current", "date");
    expect(screen.getByText("이 날에는 기록이 없습니다.")).toBeInTheDocument();
  });

  it("AC-HOMECAL-33 · 이전 달로 넘기면 선택 없음 상태가 된다", async () => {
    await renderHome();

    await userEvent.click(await screen.findByRole("button", { name: "이전 달" }));

    expect(await screen.findByText("2026.08")).toBeInTheDocument();
    expect(document.querySelectorAll('[aria-current="date"]')).toHaveLength(0);
  });

  it("AC-HOMECAL-37 · 상대를 누르면 달력이 그 사람 기록으로 바뀐다", async () => {
    await renderHome();

    await userEvent.click(await screen.findByRole("tab", { name: /지연/ }));

    expect(await screen.findByText("지연 · 6 BREWS")).toBeInTheDocument();
  });

  it("AC-HOMECAL-38 · 사람을 바꾸면 month는 유지되고 selectedDate는 초기화된다", async () => {
    await renderHome();
    await userEvent.click(await screen.findByRole("button", { name: "이전 달" }));
    await screen.findByText("2026.08");

    await userEvent.click(screen.getByRole("tab", { name: /지연/ }));

    expect(screen.getByText("2026.08")).toBeInTheDocument();
    expect(document.querySelectorAll('[aria-current="date"]')).toHaveLength(0);
  });

  it("AC-HOMECAL-39 · 남의 달력에 관계 문구가 뜬다", async () => {
    await renderHome();

    await userEvent.click(await screen.findByRole("tab", { name: /지연/ }));
    await userEvent.click(
      await screen.findByRole("button", { name: "9월 10일, 기록 1건" }),
    );

    expect(
      await screen.findByText("맞팔로우 — 서로의 기록이 보입니다"),
    ).toBeInTheDocument();
  });

  it("AC-HOMECAL-50 · 이전 달로 넘길 때 추가 요청이 없다", async () => {
    const calls: string[] = [];
    server.events.on("request:start", ({ request }) => {
      if (request.url.includes("/brew-logs/calendar")) calls.push(request.url);
    });

    await renderHome();
    await waitFor(() =>
      expect(calls.filter((u) => u.includes("month=2026-08"))).toHaveLength(1),
    );
    const before = calls.filter((u) => u.includes("month=2026-08")).length;

    await userEvent.click(await screen.findByRole("button", { name: "이전 달" }));
    await screen.findByText("2026.08");

    expect(calls.filter((u) => u.includes("month=2026-08"))).toHaveLength(before);
  });

  it("AC-HOMECAL-52 · 로딩 중에도 그리드 골격이 유지된다", async () => {
    const { delay } = await import("msw");
    server.use(
      http.get(`${BASE}/brew-logs/calendar`, async () => {
        await delay("infinite");
        return HttpResponse.json(calendarResponse("2026-09"));
      }),
    );

    renderWithQuery(<HomePage />);

    expect(await screen.findAllByRole("columnheader")).toHaveLength(7);
    // 갱신(2026-09-21, AC-HOMECAL-101): 점 자리는 이제 기록이 없어도 항상 렌더된다
    // (투명 placeholder) — "점만 비운다"는 요소 부재가 아니라 무색으로 구현이 바뀌었다.
    const dots = document.querySelectorAll<HTMLElement>("[data-record-dot]");
    expect(dots.length).toBeGreaterThan(0);
    for (const dot of dots) {
      expect(dot.style.backgroundColor).toBe("transparent");
    }
    expect(screen.queryByTestId("skeleton")).toBeNull();
  });
});
