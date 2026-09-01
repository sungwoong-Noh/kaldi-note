import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setAccessToken } from "@/lib/session";
import { renderWithQuery } from "@/test/render";
import { server } from "@/test/msw-server";
import { comandanteC40, hoffmann } from "@/test/fixtures";
import RecipeEditPage from "./page";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, refresh: vi.fn() }),
  usePathname: () => "/recipes/2/edit",
}));

const BASE = "http://localhost:8080/api/v1";

/** 내가 소유한 레시피. 편집 화면은 소유자만 연다. */
const mine = { ...hoffmann, ownerUserId: 7, sourceType: "USER" as const };

function baseHandlers() {
  return [
    http.get(`${BASE}/recipes/2`, () => HttpResponse.json(mine)),
    http.get(`${BASE}/gear/brewers`, () =>
      HttpResponse.json([
        { id: 2, brand: "Hario", name: "V60 02", type: "CONE", isSystem: true },
      ]),
    ),
    http.get(`${BASE}/gear/filters`, () =>
      HttpResponse.json([
        { id: 2, name: "V60 표백 필터 02", material: "PAPER_BLEACHED", isSystem: true },
      ]),
    ),
    http.get(`${BASE}/gear/grinders`, () => HttpResponse.json([comandanteC40])),
  ];
}

/** 페이지는 async 서버 컴포넌트다 — 먼저 실행해 params를 푼 뒤 그 결과를 렌더한다. */
function renderEditPage() {
  return RecipeEditPage({ params: Promise.resolve({ id: "2" }) }).then((ui) =>
    renderWithQuery(ui),
  );
}

beforeEach(() => {
  push.mockClear();
  setAccessToken("test-token");
  server.use(...baseHandlers());
});

describe("RecipeEditPage", () => {
  it("AC-WEBEDIT-09 · 편집 화면이 서버 값으로 채워진다", async () => {
    await renderEditPage();

    expect(await screen.findByLabelText("제목")).toHaveValue(
      "James Hoffmann Ultimate V60",
    );
    expect(screen.getByLabelText("원두량")).toHaveValue(30);
    expect(screen.getByLabelText("물량")).toHaveValue(500);
    expect(screen.getAllByRole("listitem", { name: /^스텝 \d+$/ })).toHaveLength(
      hoffmann.steps.length,
    );
  });

  it("AC-WEBEDIT-10 · 편집 저장은 PUT으로 스텝 배열을 통째로 보낸다", async () => {
    const user = userEvent.setup();
    let body: { steps: unknown[] } | null = null;
    server.use(
      http.put(`${BASE}/recipes/2`, async ({ request }) => {
        body = (await request.json()) as { steps: unknown[] };
        return HttpResponse.json(mine);
      }),
    );

    await renderEditPage();
    await user.click(
      await screen.findByRole("button", { name: `스텝 ${hoffmann.steps.length} 삭제` }),
    );
    await user.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body!.steps).toHaveLength(hoffmann.steps.length - 1);
    expect(push).toHaveBeenCalledWith("/recipes/2");
  });

  it("없는 레시피를 열면 안내가 보인다", async () => {
    server.use(
      http.get(`${BASE}/recipes/2`, () =>
        HttpResponse.json(
          { code: "NOT_FOUND", message: "레시피를 찾을 수 없습니다.", fieldErrors: [] },
          { status: 404 },
        ),
      ),
    );

    await renderEditPage();

    expect(
      await screen.findByText("레시피를 찾을 수 없습니다"),
    ).toBeInTheDocument();
  });

  it("AC-WEBSHELL-14 · 취소하면 그 레시피 상세로 간다", async () => {
    const user = userEvent.setup();
    // AC의 리터럴이 12다. 목적지가 편집 중인 id를 따라가는지 보려면 기본 harness의 2와
    // 달라야 한다 — 2로 두면 하드코딩된 경로도 통과해 버린다.
    server.use(
      http.get(`${BASE}/recipes/12`, () => HttpResponse.json({ ...mine, id: 12 })),
    );

    await RecipeEditPage({ params: Promise.resolve({ id: "12" }) }).then((ui) =>
      renderWithQuery(ui),
    );
    await user.click(await screen.findByRole("button", { name: "취소" }));

    expect(push).toHaveBeenCalledWith("/recipes/12");
  });
});
