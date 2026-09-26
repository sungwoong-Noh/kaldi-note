import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse, delay } from "msw";
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

/**
 * 대표 수치는 세 클래스를 **모두** 가진 요소다. 하나라도 빠지면 잡히지 않는다.
 * 클래스 이름을 틀렸는지까지는 잡지 못한다 — 그것은 e2e가 잰다.
 */
/**
 * 갱신(2026-09-17): 클래스 조합으로 찾던 것을 `data-lead`로 바꿨다.
 * 히어로 도입으로 클래스가 달라졌고, 스타일이 바뀔 때마다 셀렉터가 깨지는 것이
 * 이 훅이 존재하는 이유다.
 */
function leadElements(): Element[] {
  return [...document.querySelectorAll("[data-lead]")];
}

describe("RecipeDetailPage", () => {
  // AC-CONSIST-08(대표 수치가 비율)을 대체한다 — 레시피 서랍 화면 스펙이 상세 히어로를
  // 원두량·Hot/Ice·추천 배전도로 재설계했다(docs/specs/2026-09-25-recipe-drawer-screens.md).
  it("AC-RECIPESBREWS-73 · 상세 화면에 히어로·원장·스텝이 있다", async () => {
    await renderDetail();
    await screen.findByRole("heading", { level: 1 });

    const leads = leadElements();

    expect(leads).toHaveLength(1);
    expect(leads[0].textContent).toBe("30.0g");
    expect(
      leads[0].closest("[data-hero]")?.querySelector("[data-eyebrow]")
        ?.textContent,
    ).toBe("원두량");
    // hoffmann은 temperatureType HOT, recommendedRoastLevel MEDIUM이다.
    expect(screen.getByText("Hot")).toBeInTheDocument();
    expect(screen.getByText("중배전")).toBeInTheDocument();
    // 원장 — 기구.
    expect(screen.getByText("Hario V60 02")).toBeInTheDocument();
    // 스텝 목록.
    expect(screen.getByText("푸어 스텝")).toBeInTheDocument();
  });

  it("AC-CONSIST-05 · 상세 메타줄의 라벨이 화면에 보인다", async () => {
    await renderDetail();

    // hoffmann은 waterTempC 100.0 · totalTimeSeconds 210이라 세 라벨이 전부 그려진다.
    // 갱신(2026-09-15): 「비율」이 대표 수치로 올라가고 절대량이 메타줄로 내려왔다.
    for (const label of ["원두량", "물량", "물 온도", "총 시간"]) {
      const dt = await screen.findByText(label);

      // jsdom은 Tailwind를 읽지 않아 `sr-only`가 걸려 있어도 toBeVisible()이 통과한다.
      // 실제로 일을 하는 것은 아래 className 검사다.
      expect(dt).toBeVisible();
      expect(dt.className).not.toContain("sr-only");
    }
  });

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

  it("AC-SKIN-11 · 분쇄도가 있으면 추정치 표기와 함께 보여준다", async () => {
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

    expect(await screen.findByText("기본 제공")).toBeInTheDocument();
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

  it("AC-RECIPESBREWS-95 · 가시성 없는 레시피 상세는 403 화면이다", async () => {
    server.use(
      http.get(`${BASE}/recipes/2`, () =>
        HttpResponse.json(
          { code: "FORBIDDEN", message: "이 레시피를 볼 권한이 없습니다." },
          { status: 403 },
        ),
      ),
    );

    await renderDetail();

    expect(
      await screen.findByText("이 레시피를 볼 권한이 없습니다."),
    ).toBeInTheDocument();
  });

  // AC-WEB-22를 대체한다 — 버튼 이름이 "내 서랍에 담기"로 바뀌었다.
  it("AC-RECIPESBREWS-74 · 남의 레시피 상세에는 담기 버튼이 보인다", async () => {
    await renderDetail();

    expect(
      await screen.findByRole("button", { name: "내 서랍에 담기" }),
    ).toBeInTheDocument();
  });

  // AC-WEB-23을 대체한다 — 같은 시나리오, 새 버튼 이름(AC-RECIPESBREWS-75).
  it("AC-RECIPESBREWS-75 · 내 레시피 상세에는 담기 버튼이 없다", async () => {
    server.use(
      http.get(`${BASE}/recipes/2`, () =>
        HttpResponse.json({ ...hoffmann, ownerUserId: 7 }),
      ),
    );

    await renderDetail();

    await screen.findByText("James Hoffmann Ultimate V60");
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "내 서랍에 담기" }),
      ).not.toBeInTheDocument(),
    );
  });

  // AC-WEBEDIT-06(그 전의 AC-WEB-24)을 대체한다 — 담긴 레시피는 이제 편집이 아니라
  // 상세로 이동한다(AC-RECIPESBREWS-74).
  it("AC-RECIPESBREWS-74 · 담기는 바디 없이 즉시 담기고 담긴 레시피로 이동한다", async () => {
    let forkBody: unknown;
    server.use(
      http.post(`${BASE}/recipes/2/fork`, async ({ request }) => {
        forkBody = await request.text();
        return HttpResponse.json(
          {
            ...hoffmann,
            id: 42,
            ownerUserId: 7,
            sourceType: "USER",
            visibility: "PRIVATE",
          },
          { status: 201 },
        );
      }),
    );

    await renderDetail();

    await userEvent.click(
      await screen.findByRole("button", { name: "내 서랍에 담기" }),
    );

    expect(forkBody).toBe("");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/recipes/42"));
  });

  // AC-WEB-25를 대체한다 — 같은 시나리오, 새 버튼 이름. 정식 AC ID는 이후 Task 10이
  // AC-RECIPESBREWS-96으로 붙인다(레시피 서랍 화면 스펙, 아직 승인 단계라 지금은 없어도 된다).
  it("AC-RECIPESBREWS-96 · 담기가 실패하면 페이지가 유지되고 메시지가 보인다", async () => {
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
      name: "내 서랍에 담기",
    });
    await userEvent.click(button);

    expect(await screen.findByText("권한이 없습니다.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "내 서랍에 담기" }),
    ).toBeEnabled();
  });

  it("AC-RECIPESBREWS-96 · 네트워크가 끊기면 고정 문구가 보인다", async () => {
    server.use(
      http.post(`${BASE}/recipes/2/fork`, () => HttpResponse.error()),
    );

    await renderDetail();

    await userEvent.click(
      await screen.findByRole("button", { name: "내 서랍에 담기" }),
    );

    expect(
      await screen.findByText("일시적인 오류가 발생했습니다."),
    ).toBeInTheDocument();
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
    await screen.findByRole("button", { name: "내 서랍에 담기" });

    expect(
      screen.queryByRole("link", { name: "편집" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "삭제" }),
    ).not.toBeInTheDocument();
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
    server.use(
      http.get(`${BASE}/recipes/2`, () => HttpResponse.json(mineRecipe)),
    );

    await renderDetail();

    expect(
      await screen.findByRole("link", { name: "이 레시피로 내렸다" }),
    ).toHaveAttribute("href", "/brews/new?recipeId=2");
  });

  it("AC-WEBSHELL-16 · 내 레시피에는 기록 버튼이 있다", async () => {
    server.use(
      http.get(`${BASE}/recipes/2`, () => HttpResponse.json(mineRecipe)),
    );

    await renderDetail();

    expect(
      await screen.findByRole("link", { name: "이 레시피로 내렸다" }),
    ).toHaveAttribute("href", "/brews/new?recipeId=2");
  });

  // AC-WEBSHELL-17을 대체한다 — 안내 문구 대신 실제로 기록을 시작하는 링크가 있다
  // (AC-RECIPESBREWS-81). 백엔드가 담지 않은 레시피로도 기록을 받는다
  // (RecipeService.requireViewable).
  it("AC-RECIPESBREWS-81 · 바로 내리기는 기록 작성 화면을 연다", async () => {
    // 기본 픽스처가 CURATED이고 ownerUserId 키가 없다.
    await renderDetail();

    expect(
      await screen.findByRole("link", { name: "이 레시피로 바로 내리기" }),
    ).toHaveAttribute("href", "/brews/new?recipeId=2");
    expect(
      screen.queryByRole("link", { name: "이 레시피로 내렸다" }),
    ).not.toBeInTheDocument();
  });

  it("AC-RECIPESBREWS-101 · 조회 중에는 로딩 상태가 표시된다", async () => {
    server.use(
      http.get(`${BASE}/recipes/2`, async () => {
        await delay(300);
        return HttpResponse.json(hoffmann);
      }),
    );

    await renderDetail();

    expect(
      await screen.findByRole("status", { name: "불러오는 중" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("James Hoffmann Ultimate V60"),
    ).not.toBeInTheDocument();
  });
});
