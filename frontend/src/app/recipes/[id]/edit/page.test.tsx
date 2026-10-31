import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setAccessToken } from "@/lib/session";
import { renderWithQuery } from "@/test/render";
import { server } from "@/test/msw-server";
import { comandanteC40, hoffmann, me } from "@/test/fixtures";
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
    // 편집 화면은 소유자만 연다 — 나는 `mine`의 주인(7)이다.
    http.get(`${BASE}/users/me`, () => HttpResponse.json({ ...me, id: 7 })),
    http.get(`${BASE}/gear/brewers`, () =>
      HttpResponse.json([
        { id: 2, brand: "Hario", name: "V60 02", type: "CONE", isSystem: true },
      ]),
    ),
    http.get(`${BASE}/gear/filters`, () =>
      HttpResponse.json([
        {
          id: 2,
          name: "V60 표백 필터 02",
          material: "PAPER_BLEACHED",
          isSystem: true,
        },
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
    expect(screen.getByLabelText("원두량")).toHaveValue("30");
    expect(screen.getByLabelText("물량")).toHaveValue("500");
    expect(
      screen.getAllByRole("listitem", { name: /^스텝 \d+$/ }),
    ).toHaveLength(hoffmann.steps.length);
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
      await screen.findByRole("button", {
        name: `스텝 ${hoffmann.steps.length} 삭제`,
      }),
    );
    await user.click(screen.getByRole("button", { name: "변경 사항 저장" }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body!.steps).toHaveLength(hoffmann.steps.length - 1);
    expect(push).toHaveBeenCalledWith("/recipes/2");
  });

  it("없는 레시피를 열면 안내가 보인다", async () => {
    server.use(
      http.get(`${BASE}/recipes/2`, () =>
        HttpResponse.json(
          {
            code: "NOT_FOUND",
            message: "레시피를 찾을 수 없습니다.",
            fieldErrors: [],
          },
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
      http.get(`${BASE}/recipes/12`, () =>
        HttpResponse.json({ ...mine, id: 12 }),
      ),
    );

    await RecipeEditPage({ params: Promise.resolve({ id: "12" }) }).then((ui) =>
      renderWithQuery(ui),
    );
    await user.click(await screen.findByRole("button", { name: "취소" }));

    expect(push).toHaveBeenCalledWith("/recipes/12");
  });
});

describe("RecipeEditPage 상태", () => {
  it("AC-RECIPEEDIT-10 · 제목 「레시피 수정」, 저장 「변경 사항 저장」", async () => {
    await renderEditPage();

    expect(
      await screen.findByRole("button", { name: "변경 사항 저장" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "레시피 수정" }),
    ).toBeInTheDocument();
  });

  it("AC-RECIPEEDIT-03 · ICE · 약배전 레시피를 편집 저장하면 두 값이 그대로 간다", async () => {
    const user = userEvent.setup();
    let body: Record<string, unknown> | null = null;
    server.use(
      http.get(`${BASE}/recipes/2`, () =>
        HttpResponse.json({
          ...mine,
          temperatureType: "ICE",
          recommendedRoastLevel: "LIGHT",
        }),
      ),
      http.put(`${BASE}/recipes/2`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(mine);
      }),
    );

    await renderEditPage();
    const title = await screen.findByLabelText("제목");
    await user.type(title, " 2");
    await user.click(screen.getByRole("button", { name: "변경 사항 저장" }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({
      temperatureType: "ICE",
      recommendedRoastLevel: "LIGHT",
    });
  });

  it("AC-RECIPEEDIT-22 · 고친 뒤 취소하면 확인을 묻고, 계속 편집하면 머문다", async () => {
    const user = userEvent.setup();
    await renderEditPage();

    await user.type(await screen.findByLabelText("제목"), "!");
    await user.click(screen.getByRole("button", { name: "취소" }));
    expect(
      screen.getByRole("dialog", { name: "저장하지 않고 나갈까요?" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "계속 편집" }));
    expect(push).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("AC-RECIPEEDIT-22 · 고친 게 없으면 바로 상세로 간다", async () => {
    const user = userEvent.setup();
    await renderEditPage();

    await user.click(await screen.findByRole("button", { name: "취소" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(push).toHaveBeenCalledWith("/recipes/2");
  });

  it("AC-RECIPEEDIT-32 · 불러오기가 500이면 안내하고 다시 시도로 재조회한다", async () => {
    const user = userEvent.setup();
    let calls = 0;
    server.use(
      http.get(`${BASE}/recipes/2`, () => {
        calls += 1;
        return HttpResponse.json(
          { code: "INTERNAL_ERROR", message: "서버 오류" },
          { status: 500 },
        );
      }),
    );

    await renderEditPage();

    expect(
      await screen.findByText("레시피를 불러오지 못했습니다."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "다시 시도" }));
    await waitFor(() => expect(calls).toBe(2));
  });
});

describe("RecipeEditPage 원본 · 소유자", () => {
  const forked = {
    ...mine,
    parentRecipeId: 3,
    sourceAuthorName: "지연",
  };
  const original = {
    ...hoffmann,
    id: 3,
    title: "아침에 마시는 밝은 워시드",
    doseG: 15.0,
  };

  it("AC-RECIPEEDIT-08 · 담아온 레시피 편집에 원본 배너와 원본 원두량이 붙는다", async () => {
    server.use(
      http.get(`${BASE}/recipes/2`, () => HttpResponse.json(forked)),
      http.get(`${BASE}/recipes/3`, () => HttpResponse.json(original)),
    );

    await renderEditPage();

    expect(
      await screen.findByText("지연 님의 레시피 · 아침에 마시는 밝은 워시드"),
    ).toBeInTheDocument();
    expect(screen.getByText("원본")).toBeInTheDocument();
    expect(await screen.findByText("원본 15.0 g")).toBeInTheDocument();
  });

  it("AC-RECIPEEDIT-09 · 원본을 읽지 못하면 작성자만 남는다", async () => {
    server.use(
      http.get(`${BASE}/recipes/2`, () => HttpResponse.json(forked)),
      http.get(`${BASE}/recipes/3`, () =>
        HttpResponse.json(
          { code: "FORBIDDEN", message: "볼 수 없는 레시피입니다." },
          { status: 403 },
        ),
      ),
    );

    await renderEditPage();

    expect(await screen.findByText("지연 님의 레시피")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText(/^원본 .* g$/)).not.toBeInTheDocument(),
    );
    expect(screen.getByLabelText("제목")).toBeInTheDocument();
  });

  it("AC-RECIPEEDIT-23 · 내 것이 아닌 레시피(CURATED)는 폼 대신 담아서 편집을 안내한다", async () => {
    const user = userEvent.setup();
    let forkCalls = 0;
    server.use(
      http.get(`${BASE}/recipes/2`, () =>
        HttpResponse.json({
          ...hoffmann,
          ownerUserId: undefined,
          sourceType: "CURATED",
        }),
      ),
      http.post(`${BASE}/recipes/2/fork`, () => {
        forkCalls += 1;
        return HttpResponse.json({ ...mine, id: 40 }, { status: 201 });
      }),
    );

    await renderEditPage();

    expect(
      await screen.findByText("내 레시피만 편집할 수 있습니다."),
    ).toBeInTheDocument();
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "담아서 편집" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/recipes/40/edit"));
    expect(forkCalls).toBe(1);
  });

  it("AC-RECIPEEDIT-23 · 다른 사람 소유 레시피도 같은 안내", async () => {
    server.use(
      http.get(`${BASE}/recipes/2`, () =>
        HttpResponse.json({ ...mine, ownerUserId: 2 }),
      ),
    );

    await renderEditPage();

    expect(
      await screen.findByText("내 레시피만 편집할 수 있습니다."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "레시피로 돌아가기" }),
    ).toHaveAttribute("href", "/recipes/2");
  });
});
