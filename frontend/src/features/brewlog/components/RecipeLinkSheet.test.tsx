import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession, setAccessToken } from "@/lib/session";
import { hoffmannSummary, pageOf } from "@/test/fixtures";
import { server } from "@/test/msw-server";
import { renderWithQuery } from "@/test/render";
import { RecipeLinkSheet } from "./RecipeLinkSheet";

/** docs/specs/2026-11-14-quick-brew.md — 레시피 연결 시트(Task 14, AC-QUICKBREW-73·75·76·82). */

const BASE = "http://localhost:8080/api/v1";

const morningV60 = {
  ...hoffmannSummary,
  id: 12,
  sourceType: "USER" as const,
  title: "아침 V60 15g",
  doseG: 15,
  waterG: 240,
  ratio: 16.0,
  waterTempC: 92,
  authorDisplayName: "민수",
};

const noTempRecipe = {
  ...hoffmannSummary,
  id: 13,
  sourceType: "USER" as const,
  title: "콜드 스타일",
  doseG: 20,
  waterG: 300,
  ratio: 15.0,
  waterTempC: undefined,
  authorDisplayName: "민수",
};

const forkedRecipe = {
  ...hoffmannSummary,
  id: 14,
  sourceType: "USER" as const,
  title: "가져온 V60",
  doseG: 16,
  waterG: 256,
  ratio: 16.0,
  waterTempC: 93,
  parentRecipeId: 99,
  sourceAuthorName: "지연",
  authorDisplayName: "민수",
};

beforeEach(() => {
  clearSession();
  setAccessToken("test.access.token");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("RecipeLinkSheet", () => {
  it("AC-QUICKBREW-73 · 내 서랍(scope=DRAWER&size=50) 목록 행과 온도 생략·출처를 보여주고 선택을 넘긴다", async () => {
    const requestedUrls: URL[] = [];
    server.use(
      http.get(`${BASE}/recipes`, ({ request }) => {
        requestedUrls.push(new URL(request.url));
        return HttpResponse.json(
          pageOf([morningV60, noTempRecipe, forkedRecipe], {
            size: 50,
            hasNext: true,
          }),
        );
      }),
    );

    const onSelect = vi.fn();
    const onBack = vi.fn();
    renderWithQuery(
      <RecipeLinkSheet selectedId={12} onSelect={onSelect} onBack={onBack} />,
    );

    expect(await screen.findByText("아침 V60 15g")).toBeInTheDocument();
    expect(screen.getByText("15g → 240g · 1:16.0 · 92°C")).toBeInTheDocument();
    expect(screen.getByText("콜드 스타일")).toBeInTheDocument();
    expect(screen.getByText("20g → 300g · 1:15.0")).toBeInTheDocument();
    expect(
      screen.getByText("16g → 256g · 1:16.0 · 93°C · 지연 님 레시피"),
    ).toBeInTheDocument();

    expect(requestedUrls).toHaveLength(1);
    expect(requestedUrls[0].searchParams.get("scope")).toBe("DRAWER");
    expect(requestedUrls[0].searchParams.get("size")).toBe("50");
    expect(requestedUrls[0].searchParams.get("page")).toBe("0");

    const morningBtn = screen.getByRole("button", { name: /아침 V60 15g/ });
    expect(morningBtn).toHaveAttribute("aria-pressed", "true");
    const noneBtn = screen.getByRole("button", { name: /연결 안 함/ });
    expect(noneBtn).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(screen.getByRole("button", { name: /콜드 스타일/ }));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 13, title: "콜드 스타일" }),
    );

    await userEvent.click(noneBtn);
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });

  it("AC-QUICKBREW-75 · 서랍이 비어 있으면 안내와 「연결 안 함」만 보인다", async () => {
    server.use(
      http.get(`${BASE}/recipes`, () =>
        HttpResponse.json(pageOf([], { size: 50 })),
      ),
    );

    const onSelect = vi.fn();
    renderWithQuery(
      <RecipeLinkSheet
        selectedId={null}
        onSelect={onSelect}
        onBack={vi.fn()}
      />,
    );

    expect(
      await screen.findByText("서랍에 레시피가 없어요."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /연결 안 함/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("내 레시피 · 최근 내린 순"),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /연결 안 함/ }));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("AC-QUICKBREW-76 · 목록 500 오류 시 안내·「다시 시도」를 보이고 다시 누르면 size=50으로 1회만 재요청한다", async () => {
    let calls = 0;
    const requestedSizes: Array<string | null> = [];
    server.use(
      http.get(`${BASE}/recipes`, ({ request }) => {
        calls += 1;
        requestedSizes.push(new URL(request.url).searchParams.get("size"));
        if (calls === 1) {
          return HttpResponse.json(
            { code: "INTERNAL_ERROR", message: "boom" },
            { status: 500 },
          );
        }
        return HttpResponse.json(
          pageOf([morningV60], { size: 50, hasNext: true }),
        );
      }),
    );

    renderWithQuery(
      <RecipeLinkSheet selectedId={null} onSelect={vi.fn()} onBack={vi.fn()} />,
    );

    expect(
      await screen.findByText("레시피를 불러오지 못했어요."),
    ).toBeInTheDocument();
    expect(calls).toBe(1);

    const retryBtn = screen.getByRole("button", { name: "다시 시도" });
    await userEvent.click(retryBtn);

    expect(await screen.findByText("아침 V60 15g")).toBeInTheDocument();
    await waitFor(() => expect(calls).toBe(2));
    expect(requestedSizes).toEqual(["50", "50"]);
  });

  it("AC-QUICKBREW-82 · 이전·닫기·Escape와 행 버튼의 터치 타깃 속성을 갖춘다", async () => {
    server.use(
      http.get(`${BASE}/recipes`, () =>
        HttpResponse.json(pageOf([morningV60], { size: 50 })),
      ),
    );

    const onBack = vi.fn();
    const onClose = vi.fn();
    renderWithQuery(
      <RecipeLinkSheet
        selectedId={null}
        onSelect={vi.fn()}
        onBack={onBack}
        onClose={onClose}
      />,
    );

    const dialog = await screen.findByRole("dialog", { name: "레시피 연결" });
    expect(dialog).toBeInTheDocument();

    const row = await screen.findByRole("button", { name: /아침 V60 15g/ });
    expect(row.className).toMatch(/hit-44|min-h-\[44px\]/);
    expect(
      screen.getByRole("button", { name: /연결 안 함/ }).className,
    ).toMatch(/hit-44|min-h-\[44px\]/);

    await userEvent.keyboard("{Escape}");
    expect(onBack).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole("button", { name: "‹ 이전" }));
    expect(onBack).toHaveBeenCalledTimes(2);

    await userEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
