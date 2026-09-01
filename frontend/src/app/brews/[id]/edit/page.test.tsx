import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession, setAccessToken } from "@/lib/session";
import { brewLogWithTds, myComandante } from "@/test/fixtures";
import { server } from "@/test/msw-server";
import { renderWithQuery } from "@/test/render";
import BrewEditPage from "./page";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/brews/42/edit",
}));

const BASE = "http://localhost:8080/api/v1";
const DETAIL_URL = `${BASE}/brew-logs/42`;

/** 이 화면이 항상 부르는 것들. 개별 테스트는 필요한 것만 덮어쓴다. */
function baseHandlers() {
  return [
    http.get(DETAIL_URL, () =>
      HttpResponse.json({ ...brewLogWithTds, id: 42, userId: 11 }),
    ),
    http.get(`${BASE}/gear/user-grinders`, () =>
      HttpResponse.json([{ ...myComandante, id: 5 }]),
    ),
  ];
}

/** PATCH 본문을 잡는다. */
function capturePatch() {
  const captured: { body: Record<string, unknown> | null; calls: number } = {
    body: null,
    calls: 0,
  };
  server.use(
    http.patch(DETAIL_URL, async ({ request }) => {
      captured.calls += 1;
      captured.body = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({ ...brewLogWithTds, id: 42, userId: 11 });
    }),
  );
  return captured;
}

/** 페이지는 async 서버 컴포넌트다 — 먼저 실행해 params를 푼 뒤 그 결과를 렌더한다. */
function renderEditPage() {
  return BrewEditPage({ params: Promise.resolve({ id: "42" }) }).then((ui) =>
    renderWithQuery(ui),
  );
}

beforeEach(() => {
  push.mockClear();
  clearSession();
  setAccessToken("a.b.c");
  server.use(...baseHandlers());
});

describe("BrewEditPage", () => {
  it("AC-WEBLOGEDIT-04 · 저장된 값이 채워진 채로 열린다", async () => {
    await renderEditPage();

    expect(await screen.findByLabelText("원두량")).toHaveValue(20);
    expect(screen.getByLabelText("물량")).toHaveValue(300);
    expect(screen.getByLabelText("물 온도")).toHaveValue(92);
    expect(screen.getByLabelText("추출 시간")).toHaveValue(210);
    expect(screen.getByLabelText("TDS")).toHaveValue(1.35);
  });

  it("AC-WEBLOGEDIT-05 · 공개범위 세 옵션이 있고 저장된 값이 골라져 있다", async () => {
    await renderEditPage();

    const select = await screen.findByLabelText("공개 범위");
    expect(select).toHaveValue("PRIVATE");
    for (const label of ["나만 보기", "맞팔로우만", "전체 공개"]) {
      expect(
        within(select).getByRole("option", { name: label }),
      ).toBeInTheDocument();
    }
  });

  it("AC-WEBLOGEDIT-06 · 레시피와 원두는 바꿀 수 없다", async () => {
    await renderEditPage();

    await screen.findByLabelText("원두량");
    expect(
      screen.queryByRole("combobox", { name: "원두" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "레시피" }),
    ).not.toBeInTheDocument();
  });

  it("AC-WEBLOGEDIT-17 · 없는 로그를 편집하려 하면 오류 화면이 뜬다", async () => {
    server.use(
      http.get(DETAIL_URL, () =>
        HttpResponse.json(
          { code: "NOT_FOUND", message: "없습니다", fieldErrors: [] },
          { status: 404 },
        ),
      ),
    );

    await renderEditPage();

    expect(
      await screen.findByRole("button", { name: "다시 시도" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("원두량")).not.toBeInTheDocument();
  });
});

describe("BrewEditPage — 저장", () => {
  it("AC-WEBLOGEDIT-07 · 바뀐 필드만 본문에 담긴다", async () => {
    const user = userEvent.setup();
    const captured = capturePatch();
    server.use(
      http.get(DETAIL_URL, () =>
        HttpResponse.json({ ...brewLogWithTds, id: 42, userId: 11, rating: 3.5 }),
      ),
    );

    await renderEditPage();
    await user.click(await screen.findByRole("button", { name: "별점 4" }));
    await user.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(captured.body).not.toBeNull());
    expect(captured.body).toEqual({ rating: 4 });
  });

  it("AC-WEBLOGEDIT-08 · 공개범위를 바꾸면 그것만 담긴다", async () => {
    const user = userEvent.setup();
    const captured = capturePatch();

    await renderEditPage();
    await user.selectOptions(await screen.findByLabelText("공개 범위"), "FRIENDS");
    await user.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(captured.body).not.toBeNull());
    expect(captured.body).toEqual({ visibility: "FRIENDS" });
  });

  it("AC-WEBLOGEDIT-09 · 저장에 성공하면 그 로그 상세로 간다", async () => {
    const user = userEvent.setup();
    capturePatch();

    await renderEditPage();
    await user.selectOptions(await screen.findByLabelText("공개 범위"), "FRIENDS");
    await user.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/brews/42"));
  });

  it("AC-WEBLOGEDIT-10 · 취소하면 그 로그 상세로 간다", async () => {
    const user = userEvent.setup();
    const captured = capturePatch();

    await renderEditPage();
    await user.click(await screen.findByRole("button", { name: "취소" }));

    expect(push).toHaveBeenCalledWith("/brews/42");
    expect(captured.calls).toBe(0);
  });

  it("AC-WEBLOGEDIT-11 · 아무것도 고치지 않고 저장하면 요청이 나가지 않는다", async () => {
    const user = userEvent.setup();
    const captured = capturePatch();

    await renderEditPage();
    await user.click(await screen.findByRole("button", { name: "저장" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/brews/42"));
    expect(captured.calls).toBe(0);
  });
});
