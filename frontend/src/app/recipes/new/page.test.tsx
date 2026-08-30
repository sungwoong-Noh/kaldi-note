import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession, setAccessToken } from "@/lib/session";
import { renderWithQuery } from "@/test/render";
import { server } from "@/test/msw-server";
import { comandanteC40 } from "@/test/fixtures";
import RecipeNewPage from "./page";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, refresh: vi.fn() }),
  usePathname: () => "/recipes/new",
}));

const BASE = "http://localhost:8080/api/v1";

/** 폼이 마운트되면서 항상 부르는 마스터 데이터. 개별 테스트는 필요한 것만 덮어쓴다. */
function masterDataHandlers() {
  return [
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

const created = {
  id: 1,
  ownerUserId: 7,
  sourceType: "USER",
  title: "아침 레시피",
  brewMethod: "POUR_OVER",
  visibility: "PRIVATE",
  doseG: 15.0,
  waterG: 250.0,
  ratio: 16.7,
  createdAt: "2026-08-30T00:00:00Z",
  updatedAt: "2026-08-30T00:00:00Z",
  steps: [],
};

async function fillMinimum(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("제목"), "아침 레시피");
  await user.type(screen.getByLabelText("원두량"), "15");
  await user.type(screen.getByLabelText("물량"), "250");
}

function badRequest(body: Record<string, unknown>) {
  return http.post(`${BASE}/recipes`, () =>
    HttpResponse.json(body, { status: 400 }),
  );
}

beforeEach(() => {
  push.mockClear();
  replace.mockClear();
  setAccessToken("test-token");
  server.use(...masterDataHandlers());
});

describe("RecipeNewPage", () => {
  it("AC-WEBEDIT-01 · 미인증으로 생성 화면에 접근하면 경로를 보존해 로그인으로 보낸다", async () => {
    clearSession();
    server.use(
      http.post("/api/auth/refresh", () =>
        HttpResponse.json({ code: "REFRESH_TOKEN_INVALID" }, { status: 401 }),
      ),
    );

    renderWithQuery(<RecipeNewPage />);

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/login?next=%2Frecipes%2Fnew"),
    );
  });

  it("AC-WEBEDIT-07 · 최소 입력만으로 저장하면 세 필드만 담아 보낸다", async () => {
    const user = userEvent.setup();
    let body: unknown = null;
    server.use(
      http.post(`${BASE}/recipes`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(created, { status: 201 });
      }),
    );

    renderWithQuery(<RecipeNewPage />);
    await fillMinimum(user);
    await user.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/recipes/1"));
    expect(body).toEqual({
      title: "아침 레시피",
      doseG: 15,
      waterG: 250,
      visibility: "PRIVATE",
      steps: [],
    });
  });

  it("AC-WEBEDIT-08 · 저장하는 동안 버튼이 잠긴다", async () => {
    const user = userEvent.setup();
    let calls = 0;
    server.use(
      http.post(`${BASE}/recipes`, async () => {
        calls += 1;
        await new Promise((resolve) => setTimeout(resolve, 50));
        return HttpResponse.json(created, { status: 201 });
      }),
    );

    renderWithQuery(<RecipeNewPage />);
    await fillMinimum(user);
    const save = screen.getByRole("button", { name: "저장" });
    await user.click(save);

    expect(save).toBeDisabled();
    await user.click(save);

    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(calls).toBe(1);
  });

  it("AC-WEBEDIT-24 · 합계가 달라도 저장은 서버로 나간다", async () => {
    const user = userEvent.setup();
    let called = false;
    server.use(
      http.post(`${BASE}/recipes`, () => {
        called = true;
        return HttpResponse.json(created, { status: 201 });
      }),
    );

    renderWithQuery(<RecipeNewPage />);
    await fillMinimum(user);
    // 스텝 하나를 넣고 물량은 비워둔다 — 합계 0 vs 총 물량 250이라 어긋난다.
    await user.click(screen.getByRole("button", { name: "스텝 추가" }));

    const save = screen.getByRole("button", { name: "저장" });
    expect(save).toBeEnabled();
    await user.click(save);

    await waitFor(() => expect(called).toBe(true));
  });

  it("AC-WEBEDIT-30 · 필드 오류가 해당 입력칸 아래에 붙는다", async () => {
    const user = userEvent.setup();
    server.use(
      badRequest({
        code: "INVALID_REQUEST",
        message: "입력값이 올바르지 않습니다.",
        fieldErrors: [{ field: "waterG", message: "3000 이하여야 합니다" }],
      }),
    );

    renderWithQuery(<RecipeNewPage />);
    await fillMinimum(user);
    await user.click(screen.getByRole("button", { name: "저장" }));

    const waterInput = await screen.findByLabelText("물량");
    const describedBy = waterInput.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveTextContent(
      "3000 이하여야 합니다",
    );
  });

  it("AC-WEBEDIT-31 · 스텝 배열 오류가 그 스텝 행에 붙는다", async () => {
    const user = userEvent.setup();
    server.use(
      badRequest({
        code: "INVALID_REQUEST",
        message: "입력값이 올바르지 않습니다.",
        fieldErrors: [
          {
            field: "steps[2].waterG",
            message: "붓는 스텝은 물량이 0보다 커야 합니다",
          },
        ],
      }),
    );

    renderWithQuery(<RecipeNewPage />);
    await fillMinimum(user);
    for (let i = 0; i < 3; i += 1) {
      await user.click(screen.getByRole("button", { name: "스텝 추가" }));
    }
    await user.click(screen.getByRole("button", { name: "저장" }));

    const thirdStep = await screen.findByRole("listitem", { name: "스텝 3" });
    expect(thirdStep).toHaveTextContent("붓는 스텝은 물량이 0보다 커야 합니다");
  });

  it("AC-WEBEDIT-32 · 매핑되지 않는 필드 오류는 상단에 남는다", async () => {
    const user = userEvent.setup();
    server.use(
      badRequest({
        code: "INVALID_REQUEST",
        message: "입력값이 올바르지 않습니다.",
        fieldErrors: [{ field: "unknownField", message: "알 수 없는 값입니다" }],
      }),
    );

    renderWithQuery(<RecipeNewPage />);
    await fillMinimum(user);
    await user.click(screen.getByRole("button", { name: "저장" }));

    expect(
      await screen.findByText("unknownField: 알 수 없는 값입니다"),
    ).toBeInTheDocument();
  });

  it("AC-WEBEDIT-33 · 시퀀스 오류는 화면을 유지한 채 서버 문구를 보여준다", async () => {
    const user = userEvent.setup();
    server.use(
      badRequest({
        code: "RECIPE_STEP_WATER_MISMATCH",
        message: "스텝 물량 합계가 총 물량과 다릅니다.",
        fieldErrors: [],
      }),
    );

    renderWithQuery(<RecipeNewPage />);
    await fillMinimum(user);
    await user.click(screen.getByRole("button", { name: "저장" }));

    expect(
      await screen.findByText("스텝 물량 합계가 총 물량과 다릅니다."),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "저장" })).toBeEnabled();
  });

  it("AC-WEBEDIT-36 · 변경한 뒤에는 새로고침을 경고한다", async () => {
    const user = userEvent.setup();
    renderWithQuery(<RecipeNewPage />);

    await user.type(screen.getByLabelText("제목"), "아침 레시피");

    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it("AC-WEBEDIT-37 · 아무것도 고치지 않았으면 경고하지 않는다", async () => {
    renderWithQuery(<RecipeNewPage />);
    await screen.findByLabelText("제목");

    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });
});
