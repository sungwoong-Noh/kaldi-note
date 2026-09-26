import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FilterSheet } from "./FilterSheet";
import { clearSession, setAccessToken } from "@/lib/session";
import { hoffmannSummary, pageOf } from "@/test/fixtures";
import { server } from "@/test/msw-server";

const LIST_URL = "http://localhost:8080/api/v1/recipes";

beforeEach(() => {
  clearSession();
  setAccessToken("a.b.c");
});

afterEach(() => {
  vi.useRealTimers();
});

describe("FilterSheet", () => {
  it("AC-RECIPESBREWS-82 · 필터를 바꿔도 목록에는 반영되지 않고 CTA만 건수를 다시 센다", async () => {
    const onApply = vi.fn();
    let responseCount = 2;
    const calls: string[] = [];
    server.use(
      http.get(LIST_URL, ({ request }) => {
        calls.push(new URL(request.url).search);
        return HttpResponse.json(
          pageOf([hoffmannSummary], { totalElements: responseCount }),
        );
      }),
    );

    render(
      <FilterSheet
        q=""
        applied={{ roast: [], dripper: [] }}
        onApply={onApply}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "2개 결과 보기" }),
      ).toBeInTheDocument(),
    );
    const callsBeforeClick = calls.length;
    responseCount = 5;

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Hot" }));

    // 스테이징만 바뀐다 — 적용(onApply)은 아직 호출되지 않는다.
    expect(onApply).not.toHaveBeenCalled();

    vi.useFakeTimers();
    await vi.advanceTimersByTimeAsync(299);
    expect(calls.length).toBe(callsBeforeClick);

    await vi.advanceTimersByTimeAsync(1);
    vi.useRealTimers();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "5개 결과 보기" }),
      ).toBeInTheDocument(),
    );
    expect(calls.at(-1)).toContain("temp=HOT");
  });

  it("AC-RECIPESBREWS-82 · CTA를 클릭하면 스테이징된 조건이 적용된다", async () => {
    server.use(
      http.get(LIST_URL, () =>
        HttpResponse.json(pageOf([hoffmannSummary], { totalElements: 3 })),
      ),
    );
    const onApply = vi.fn();
    const user = userEvent.setup();

    render(
      <FilterSheet
        q=""
        applied={{ roast: [], dripper: [] }}
        onApply={onApply}
      />,
    );
    await user.click(screen.getByRole("button", { name: "중배전" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "3개 결과 보기" }),
      ).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: "3개 결과 보기" }));

    expect(onApply).toHaveBeenCalledWith({
      temp: undefined,
      roast: ["MEDIUM"],
      dripper: [],
    });
  });

  it("AC-RECIPESBREWS-82 · 초기화는 스테이징만 되돌리고 적용은 그대로다", async () => {
    server.use(
      http.get(LIST_URL, () =>
        HttpResponse.json(pageOf([hoffmannSummary], { totalElements: 3 })),
      ),
    );
    const onApply = vi.fn();
    const user = userEvent.setup();

    render(
      <FilterSheet
        q=""
        applied={{ temp: "HOT", roast: ["MEDIUM"], dripper: [] }}
        onApply={onApply}
      />,
    );
    expect(screen.getByRole("button", { name: "Hot" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "중배전" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "초기화" }));

    expect(screen.getByRole("button", { name: "Hot" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "중배전" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(onApply).not.toHaveBeenCalled();
  });
});
