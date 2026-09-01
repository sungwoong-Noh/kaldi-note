import { screen, within } from "@testing-library/react";
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
