import { screen } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { clearSession, setAccessToken } from "@/lib/session";
import { brewLogSummarySchema } from "@/features/brewlog/schema";
import {
  brewLogPage,
  brewers,
  fritzRoaster,
  grindedRecipe,
  yirgacheffeBatch,
  yirgacheffeProduct,
} from "@/test/fixtures";
import { server } from "@/test/msw-server";
import { renderWithQuery } from "@/test/render";
import { DayCard } from "./DayCard";

const BASE = "http://localhost:8080/api/v1";

/** 실제 응답을 스키마로 통과시켜 쓴다 — recipeId 12 · beanBatchId 3 · brewedAt 09:00Z(KST 18:00). */
const log = brewLogSummarySchema.parse(brewLogPage.content[0]);

beforeEach(() => {
  clearSession();
  setAccessToken("a.b.c");
  server.use(
    http.get(`${BASE}/gear/brewers`, () => HttpResponse.json(brewers)),
    // grindedRecipe에는 brewerId가 없다 — 캡션의 드리퍼를 보려고 2(Hario V60 02)를 준다.
    http.get(`${BASE}/recipes/12`, () =>
      HttpResponse.json({
        ...grindedRecipe,
        id: 12,
        title: "hoffmann",
        brewerId: 2,
      }),
    ),
    http.get(`${BASE}/recipes/17`, () =>
      HttpResponse.json({
        ...grindedRecipe,
        id: 17,
        title: "드리퍼 없음",
        brewerId: undefined,
      }),
    ),
    http.get(`${BASE}/bean-batches/3`, () =>
      HttpResponse.json(yirgacheffeBatch),
    ),
    http.get(`${BASE}/bean-products/:id`, () =>
      HttpResponse.json(yirgacheffeProduct),
    ),
    http.get(`${BASE}/roasters`, () => HttpResponse.json([fritzRoaster])),
  );
});

describe("DayCard — 캡션", () => {
  it("AC-HOMEFIT-11 · 캡션은 원두 · 드리퍼 · 시각이고 레시피명 15.5px·600, 대표 수치 mono 17px다", async () => {
    renderWithQuery(<DayCard log={log} recipeLabel="hoffmann" />);

    const caption = await screen.findByText(
      "프릿츠 예가체프 · Hario V60 02 · 18:00",
    );
    expect(caption).toHaveClass("text-[12px]");
    expect(screen.getByText("hoffmann")).toHaveClass(
      "text-[15.5px]",
      "font-semibold",
    );
    expect(screen.getByTestId("day-card-metric")).toHaveClass(
      "text-card-metric",
    );
  });

  it("AC-HOMEFIT-15 · 원두가 없으면 드리퍼 · 시각, 둘 다 없으면 시각만이다", async () => {
    const { unmount } = renderWithQuery(
      <DayCard
        log={{ ...log, beanBatchId: undefined }}
        recipeLabel="hoffmann"
      />,
    );
    expect(await screen.findByText("Hario V60 02 · 18:00")).toBeInTheDocument();
    unmount();

    renderWithQuery(
      <DayCard
        log={{ ...log, beanBatchId: undefined, recipeId: 17 }}
        recipeLabel="드리퍼 없음"
      />,
    );
    await screen.findByText("드리퍼 없음");
    // 레시피 응답이 와도 드리퍼가 없으니 캡션은 시각뿐이다.
    expect(await screen.findByText("18:00")).toBeInTheDocument();
  });

  it("AC-HOMEFIT-16 · 읽을 수 없는 원두(403)는 캡션에서 빠진다", async () => {
    server.use(
      http.get(`${BASE}/bean-batches/3`, () =>
        HttpResponse.json(
          { code: "FORBIDDEN", message: "권한이 없습니다." },
          { status: 403 },
        ),
      ),
    );

    renderWithQuery(<DayCard log={log} recipeLabel="hoffmann" />);

    expect(await screen.findByText("Hario V60 02 · 18:00")).toBeInTheDocument();
    expect(screen.queryByText(/비공개 원두/)).toBeNull();
  });

  it("AC-HOMEFIT-21 · 원두·기구 조회가 실패해도 카드와 레시피명이 그려지고 캡션은 시각이다", async () => {
    server.use(
      http.get(`${BASE}/bean-batches/3`, () =>
        HttpResponse.json(
          { code: "INTERNAL", message: "오류" },
          { status: 500 },
        ),
      ),
      http.get(`${BASE}/gear/brewers`, () =>
        HttpResponse.json(
          { code: "INTERNAL", message: "오류" },
          { status: 500 },
        ),
      ),
    );

    renderWithQuery(<DayCard log={log} recipeLabel="hoffmann" />);

    expect(await screen.findByTestId("day-card")).toBeInTheDocument();
    expect(screen.getByText("hoffmann")).toBeInTheDocument();
    expect(await screen.findByText("18:00")).toBeInTheDocument();
  });
});
