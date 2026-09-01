import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RecipeDetailPage from "./page";
import { clearSession, setAccessToken } from "@/lib/session";
import { hoffmann } from "@/test/fixtures";
import { renderWithQuery } from "@/test/render";
import { server } from "@/test/msw-server";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, refresh: vi.fn() }),
  usePathname: () => "/recipes/2",
}));

const BASE = "http://localhost:8080/api/v1";

/** 상세 화면이 항상 함께 부르는 것들. 개별 테스트는 필요한 것만 덮어쓴다. */
function baseHandlers() {
  return [
    http.get(`${BASE}/recipes/2`, () => HttpResponse.json(hoffmann)),
    http.get(`${BASE}/users/me`, () =>
      HttpResponse.json({
        id: 7,
        nickname: "테스터",
        role: "USER",
        createdAt: "2026-08-21T00:00:00Z",
      }),
    ),
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
          shape: "CONE",
          isSystem: true,
        },
      ]),
    ),
  ];
}

/** 내가 소유한 레시피. `GET /users/me`의 id가 7이다. */
const mineRecipe = { ...hoffmann, ownerUserId: 7, sourceType: "USER" as const };

function renderDetail() {
  return RecipeDetailPage({ params: Promise.resolve({ id: "2" }) }).then((ui) =>
    renderWithQuery(ui),
  );
}

beforeEach(() => {
  push.mockClear();
  replace.mockClear();
  clearSession();
  setAccessToken("a.b.c");
  server.use(...baseHandlers());
});

describe("RecipeDetailPage", () => {
  it("AC-WEB-14 · 제목과 출처와 파라미터가 표시된다", async () => {
    await renderDetail();

    expect(
      await screen.findByText("James Hoffmann Ultimate V60"),
    ).toBeInTheDocument();
    expect(screen.getByText("James Hoffmann")).toBeInTheDocument();
    expect(screen.getByText("30.0g")).toBeInTheDocument();
    expect(screen.getByText("500.0g")).toBeInTheDocument();
    expect(screen.getByText("1:16.7")).toBeInTheDocument();
  });

  it("AC-WEB-18 · 분쇄도가 없으면 그 영역이 렌더링되지 않는다", async () => {
    await renderDetail();

    await screen.findByText("James Hoffmann Ultimate V60");
    expect(screen.queryByText("분쇄도")).not.toBeInTheDocument();
  });

  it("분쇄도가 있으면 추정치 표기와 함께 보여준다", async () => {
    // AC-WEB-18은 "없으면 안 보인다"만 본다. 이 테스트가 없으면 영역을 아예 만들지
    // 않아도 AC-WEB-18이 통과해버린다 — 부재 검증을 헛되지 않게 하는 짝이다.
    server.use(
      http.get(`${BASE}/recipes/2`, () =>
        HttpResponse.json({
          ...hoffmann,
          grinderModelId: 1,
          grindSettingValue: 22,
          grindSettingUnit: "CLICK",
          grindMicronEstimated: 660,
        }),
      ),
    );

    await renderDetail();

    expect(await screen.findByText("분쇄도")).toBeInTheDocument();
    expect(screen.getByText(/660µm/)).toBeInTheDocument();
    // 환산값은 언제나 추정치다 (CLAUDE.md 설계 결정 3번).
    expect(screen.getByText("(추정치)")).toBeInTheDocument();
  });

  it("AC-WEB-19 · 장비가 id가 아니라 이름으로 표시된다", async () => {
    await renderDetail();

    expect(await screen.findByText("Hario V60 02")).toBeInTheDocument();
    expect(screen.getByText("V60 표백 필터 02")).toBeInTheDocument();
  });

  it("AC-WEB-20 · CURATED 레시피에 배지가 붙는다", async () => {
    await renderDetail();

    expect(await screen.findByText("CURATED")).toBeInTheDocument();
  });

  it("AC-WEB-21 · 없는 레시피를 열면 안내를 보여준다", async () => {
    server.use(
      http.get(`${BASE}/recipes/2`, () =>
        HttpResponse.json(
          { code: "NOT_FOUND", message: "대상을 찾을 수 없습니다." },
          { status: 404 },
        ),
      ),
    );

    await renderDetail();

    expect(
      await screen.findByText("레시피를 찾을 수 없습니다"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "다시 시도" }),
    ).not.toBeInTheDocument();
  });

  it("AC-WEB-22 · 남의 레시피에는 포크 버튼이 보인다", async () => {
    await renderDetail();

    expect(
      await screen.findByRole("button", { name: "내 레시피로 가져오기" }),
    ).toBeInTheDocument();
  });

  it("AC-WEB-23 · 내 레시피에는 포크 버튼이 없다", async () => {
    server.use(
      http.get(`${BASE}/recipes/2`, () =>
        HttpResponse.json({ ...hoffmann, ownerUserId: 7 }),
      ),
    );

    await renderDetail();

    await screen.findByText("James Hoffmann Ultimate V60");
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "내 레시피로 가져오기" }),
      ).not.toBeInTheDocument(),
    );
  });

  // 이름에 두 ID를 함께 남긴다 — AC-WEBEDIT-06이 AC-WEB-24를 대체했고,
  // 이 테스트 하나가 "그 자리에서 무엇이 일어나는가"를 검증한다.
  it("AC-WEBEDIT-06 · 포크에 성공하면 새 레시피의 편집 화면으로 간다 (AC-WEB-24 대체)", async () => {
    server.use(
      http.post(`${BASE}/recipes/2/fork`, () =>
        HttpResponse.json(
          {
            ...hoffmann,
            id: 42,
            ownerUserId: 7,
            sourceType: "USER",
            visibility: "PRIVATE",
          },
          { status: 201 },
        ),
      ),
    );

    await renderDetail();

    await userEvent.click(
      await screen.findByRole("button", { name: "내 레시피로 가져오기" }),
    );

    // 상세가 아니라 편집 화면으로 간다.
    await waitFor(() => expect(push).toHaveBeenCalledWith("/recipes/42/edit"));
  });

  it("AC-WEB-25 · 포크에 실패하면 페이지가 유지되고 메시지가 보인다", async () => {
    server.use(
      http.post(`${BASE}/recipes/2/fork`, () =>
        HttpResponse.json(
          { code: "FORBIDDEN", message: "권한이 없습니다." },
          { status: 403 },
        ),
      ),
    );

    await renderDetail();

    const button = await screen.findByRole("button", {
      name: "내 레시피로 가져오기",
    });
    await userEvent.click(button);

    expect(await screen.findByText("권한이 없습니다.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "내 레시피로 가져오기" }),
    ).toBeEnabled();
  });
});

describe("RecipeDetailPage — 편집과 삭제", () => {
  /** 내가 소유한 레시피. 편집·삭제는 소유자에게만 보인다. */
  function ownedByMe() {
    return http.get(`${BASE}/recipes/2`, () =>
      HttpResponse.json({ ...hoffmann, ownerUserId: 7, sourceType: "USER" }),
    );
  }

  it("AC-WEBEDIT-02 · 내 레시피 상세에 편집·삭제가 보인다", async () => {
    server.use(ownedByMe());

    await renderDetail();

    expect(await screen.findByRole("link", { name: "편집" })).toHaveAttribute(
      "href",
      "/recipes/2/edit",
    );
    expect(screen.getByRole("button", { name: "삭제" })).toBeInTheDocument();
  });

  it("AC-WEBEDIT-03 · 남의 레시피 상세에는 편집·삭제가 없다", async () => {
    server.use(
      http.get(`${BASE}/recipes/2`, () =>
        HttpResponse.json({ ...hoffmann, ownerUserId: 9, sourceType: "USER" }),
      ),
    );

    await renderDetail();
    await screen.findByRole("button", { name: "내 레시피로 가져오기" });

    expect(screen.queryByRole("link", { name: "편집" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "삭제" })).not.toBeInTheDocument();
  });

  it("AC-WEBEDIT-34 · 삭제를 확인하면 요청 후 목록으로 간다", async () => {
    const user = userEvent.setup();
    let deleted = 0;
    server.use(
      ownedByMe(),
      http.delete(`${BASE}/recipes/2`, () => {
        deleted += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await renderDetail();
    await user.click(await screen.findByRole("button", { name: "삭제" }));
    await user.click(screen.getByRole("button", { name: "삭제합니다" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/recipes"));
    expect(deleted).toBe(1);
  });

  it("AC-WEBEDIT-35 · 삭제를 취소하면 아무 요청도 나가지 않는다", async () => {
    const user = userEvent.setup();
    let deleted = 0;
    server.use(
      ownedByMe(),
      http.delete(`${BASE}/recipes/2`, () => {
        deleted += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await renderDetail();
    await user.click(await screen.findByRole("button", { name: "삭제" }));
    await user.click(screen.getByRole("button", { name: "취소" }));

    expect(deleted).toBe(0);
    expect(push).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: "삭제합니다" }),
    ).not.toBeInTheDocument();
  });

  it("AC-WEBBREW-46 · 레시피 상세에서 기록을 시작할 수 있다", async () => {
    // 기록은 내 레시피에서만 시작할 수 있다(AC-WEBSHELL-16·17). 기본 픽스처는
    // CURATED라 소유 레시피로 바꿔야 이 진입점이 나타난다.
    server.use(http.get(`${BASE}/recipes/2`, () => HttpResponse.json(mineRecipe)));

    await renderDetail();

    expect(
      await screen.findByRole("link", { name: "이 레시피로 내렸다" }),
    ).toHaveAttribute("href", "/brews/new?recipeId=2");
  });

  it("AC-WEBSHELL-16 · 내 레시피에는 기록 버튼이 있다", async () => {
    server.use(http.get(`${BASE}/recipes/2`, () => HttpResponse.json(mineRecipe)));

    await renderDetail();

    expect(
      await screen.findByRole("link", { name: "이 레시피로 내렸다" }),
    ).toHaveAttribute("href", "/brews/new?recipeId=2");
  });

  it("AC-WEBSHELL-17 · 남의 레시피에는 안내만 있다", async () => {
    // 기본 픽스처가 CURATED이고 ownerUserId 키가 없다.
    await renderDetail();

    expect(
      await screen.findByText("포크한 뒤 기록할 수 있습니다"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "이 레시피로 내렸다" }),
    ).not.toBeInTheDocument();
  });
});
