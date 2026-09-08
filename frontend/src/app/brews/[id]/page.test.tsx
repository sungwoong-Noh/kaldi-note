import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, delay, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Recipe } from "@/features/recipe/schema";
import { clearSession, setAccessToken } from "@/lib/session";
import {
  brewLogWithoutTds,
  brewLogWithTds,
  fritzRoaster,
  grindedRecipe,
  kasuyaRecipe,
  yirgacheffeBatch,
  yirgacheffeProduct,
} from "@/test/fixtures";
import { server } from "@/test/msw-server";
import { renderWithQuery } from "@/test/render";
import BrewDetailPage from "./page";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, refresh: vi.fn() }),
  usePathname: () => "/brews/42",
}));

const BASE = "http://localhost:8080/api/v1";
const DETAIL_URL = `${BASE}/brew-logs/42`;

/** 실제 `GET /users/me` 응답에서 뜬 것. `brewLogWithTds.userId`와 같은 11이라 기본은 소유 상태다. */
const me = {
  id: 11,
  nickname: "테스터",
  role: "USER",
  createdAt: "2026-08-21T00:00:00Z",
};

/** 이 로그를 누가 남겼는지 바꾼다. `undefined`면 소유자 그대로다. */
function loggedBy(userId: number) {
  return http.get(DETAIL_URL, () =>
    HttpResponse.json({ ...brewLogWithTds, id: 42, recipeId: 1, userId }),
  );
}

function renderDetail() {
  return BrewDetailPage({ params: Promise.resolve({ id: "42" }) }).then((ui) =>
    renderWithQuery(ui),
  );
}

beforeEach(() => {
  push.mockClear();
  replace.mockClear();
  clearSession();
  setAccessToken("a.b.c");
  server.use(
    http.get(DETAIL_URL, () =>
      HttpResponse.json({ ...brewLogWithTds, id: 42, recipeId: 1 }),
    ),
    http.get(`${BASE}/recipes/1`, () =>
      HttpResponse.json({ ...grindedRecipe, id: 1, title: "Kasuya 4:6" }),
    ),
    http.get(`${BASE}/users/me`, () => HttpResponse.json(me)),
    // 원두 이름은 배치 → 제품 → 로스터 3단으로 만든다.
    // `onUnhandledRequest: "error"`라 여기 빠지면 이 파일의 모든 테스트가 깨진다.
    http.get(`${BASE}/bean-batches/3`, () =>
      HttpResponse.json(yirgacheffeBatch),
    ),
    http.get(`${BASE}/bean-products/3`, () =>
      HttpResponse.json(yirgacheffeProduct),
    ),
    http.get(`${BASE}/roasters`, () => HttpResponse.json([fritzRoaster])),
  );
});

/** 대표 수치는 세 클래스를 모두 가진 요소다. 하나라도 빠지면 잡히지 않는다. */
function leadElements(): Element[] {
  return [...document.querySelectorAll(".text-lg.font-semibold.tabular-nums")];
}

/** 비율 없는 로그. `JSON.stringify`가 `undefined` 키를 지우므로 응답에서 통째로 빠진다. */
function withoutRatio() {
  return http.get(DETAIL_URL, () =>
    HttpResponse.json({
      ...brewLogWithTds,
      id: 42,
      recipeId: 1,
      brewRatio: undefined,
    }),
  );
}

/** 실측값 절. `stepSection()`과 같은 방식이다 — 이 파일이 이미 쓰는 패턴. */
async function measureSection(): Promise<HTMLElement> {
  const heading = await screen.findByText("실측값");
  const section = heading.closest("section");
  expect(section).not.toBeNull();
  return section as HTMLElement;
}

/** 실측값 절의 라벨. 대표로 올라간 항목은 여기서 빠져 있어야 한다. */
async function measureLabels(): Promise<(string | null)[]> {
  return [...(await measureSection()).querySelectorAll("dt")].map(
    (dt) => dt.textContent,
  );
}

describe("BrewDetailPage", () => {
  it("AC-CONSIST-12 · h1이 하나이고 레시피 이름이다", async () => {
    await renderDetail();

    // 로그가 먼저 오고 레시피 이름이 뒤에 온다. 이름이 붙기 전의 빈 h1을 잡지 않도록
    // 이름으로 기다린 뒤 개수를 센다.
    await screen.findByRole("heading", { level: 1, name: "Kasuya 4:6" });
    const headings = screen.getAllByRole("heading", { level: 1 });

    expect(headings).toHaveLength(1);
    expect(headings[0].className).toContain("text-xl");
    expect(headings[0].className).toContain("font-semibold");
  });

  it("AC-CONSIST-13 · 레시피를 못 읽어도 h1이 하나다", async () => {
    // `AC-WEBNAME-31`이 쓰는 403 폴백을 그대로 쓴다.
    server.use(
      http.get(`${BASE}/recipes/1`, () =>
        HttpResponse.json(
          { code: "FORBIDDEN", message: "권한이 없습니다." },
          { status: 403 },
        ),
      ),
    );

    await renderDetail();

    await screen.findByRole("heading", { level: 1, name: "비공개 레시피" });
    const headings = screen.getAllByRole("heading", { level: 1 });

    expect(headings).toHaveLength(1);
    expect(headings[0].className).toContain("text-xl");
    expect(headings[0].className).toContain("font-semibold");
    expect(headings[0].querySelector("a")).toBeNull();
  });

  it("AC-CONSIST-09 · 대표 수치가 하나이고 1:15.0이다", async () => {
    await renderDetail();
    // `h1`은 Task 4에서 생긴다. 지금 확실히 있는 것을 기다린다.
    await screen.findByText("실측값");

    const leads = leadElements();

    expect(leads).toHaveLength(1);
    expect(leads[0].textContent).toBe("비율1:15.0");
    expect(leads[0].querySelector("dt")?.className).toContain("sr-only");
  });

  it("AC-CONSIST-10 · 비율이 없으면 물 온도가 대표로 승격한다", async () => {
    server.use(withoutRatio());

    await renderDetail();
    // `h1`은 Task 4에서 생긴다. 지금 확실히 있는 것을 기다린다.
    await screen.findByText("실측값");

    const leads = leadElements();

    expect(leads).toHaveLength(1);
    expect(leads[0].textContent).toBe("물 온도92°C");
  });

  it("AC-CONSIST-11 · 대표로 올린 비율은 실측값에 없다", async () => {
    await renderDetail();

    const labels = await measureLabels();

    expect(labels).not.toContain("비율");
    expect(labels).toContain("물 온도");
  });

  it("AC-CONSIST-11 · 승격된 물 온도도 실측값에서 빠진다", async () => {
    server.use(withoutRatio());

    await renderDetail();

    const labels = await measureLabels();

    expect(labels).not.toContain("물 온도");
    expect(labels).not.toContain("비율");
  });

  it("AC-CONSIST-06 · 라벨이 폼 어휘를 쓴다", async () => {
    await renderDetail();
    await screen.findByText("실측값");

    const labels = [...document.querySelectorAll("dt")].map(
      (dt) => dt.textContent,
    );

    // 순서가 아니라 어휘를 본다. Task 3에서 `비율`이 대표로 올라가며 자리가 바뀐다.
    expect(labels).toEqual(
      expect.arrayContaining([
        "원두량",
        "물량",
        "물 온도",
        "추출 시간",
        "비율",
        "분쇄도",
      ]),
    );
    for (const stale of ["물", "온도", "시간"]) {
      expect(labels).not.toContain(stale);
    }
  });

  it("AC-WEBBREW-40 · 실측값이 서버 값 그대로 보인다", async () => {
    await renderDetail();

    expect(await screen.findByText("20.0g")).toBeInTheDocument();
    expect(screen.getByText("300.0g")).toBeInTheDocument();
    expect(screen.getByText("92°C")).toBeInTheDocument();
  });

  it("AC-WEBBREW-41 · TDS가 있으면 추출 분석이 보인다", async () => {
    server.use(
      http.get(DETAIL_URL, () =>
        HttpResponse.json({
          ...brewLogWithTds,
          id: 42,
          recipeId: 1,
          tdsPercent: 1.35,
          extractionYieldPercent: 20.5,
          strengthZone: "IDEAL",
          extractionZone: "IDEAL",
          diagnosis: "균형 있는 추출입니다",
        }),
      ),
    );

    await renderDetail();

    expect(await screen.findByText("20.5 %")).toBeInTheDocument();
    expect(screen.getByText("균형 있는 추출입니다")).toBeInTheDocument();
  });

  it("AC-WEBBREW-42 · TDS가 없으면 추출 분석 영역이 아예 없다", async () => {
    server.use(
      http.get(DETAIL_URL, () =>
        HttpResponse.json({ ...brewLogWithoutTds, id: 42, recipeId: 1 }),
      ),
    );

    await renderDetail();

    expect(await screen.findByText("20.0g")).toBeInTheDocument();
    expect(screen.queryByText("추출 분석")).not.toBeInTheDocument();
  });

  it("AC-WEBBREW-43 · 어떤 레시피로 내렸는지 링크된다", async () => {
    await renderDetail();

    expect(
      await screen.findByRole("link", { name: "Kasuya 4:6" }),
    ).toHaveAttribute("href", "/recipes/1");
  });

  it("AC-WEBBREW-44 · 삭제를 확인하면 요청 후 목록으로 간다", async () => {
    const user = userEvent.setup();
    let deletes = 0;
    server.use(
      http.delete(DETAIL_URL, () => {
        deletes += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await renderDetail();
    await user.click(await screen.findByRole("button", { name: "삭제" }));
    await user.click(screen.getByRole("button", { name: "삭제합니다" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/brews"));
    expect(deletes).toBe(1);
  });

  it("AC-WEBBREW-45 · 삭제를 취소하면 아무 요청도 나가지 않는다", async () => {
    const user = userEvent.setup();
    let deletes = 0;
    server.use(
      http.delete(DETAIL_URL, () => {
        deletes += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await renderDetail();
    await user.click(await screen.findByRole("button", { name: "삭제" }));
    await user.click(screen.getByRole("button", { name: "취소" }));

    expect(deletes).toBe(0);
    expect(push).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: "삭제합니다" }),
    ).not.toBeInTheDocument();
  });
});

describe("BrewDetailPage — 소유 판정", () => {
  it("AC-WEBLOGEDIT-01 · 내 로그 상세에 편집 링크가 있다", async () => {
    await renderDetail();

    expect(await screen.findByRole("link", { name: "편집" })).toHaveAttribute(
      "href",
      "/brews/42/edit",
    );
  });

  it("AC-WEBLOGEDIT-02 · 남의 로그에는 편집도 삭제도 없다", async () => {
    server.use(loggedBy(99));

    await renderDetail();

    // 본문이 그려진 뒤에 부재를 본다 — 로딩 중이면 무엇이든 없다
    await screen.findByText("실측값");
    expect(
      screen.queryByRole("link", { name: "편집" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "삭제" }),
    ).not.toBeInTheDocument();
  });

  it("AC-WEBLOGEDIT-03 · 내 로그에는 삭제가 그대로 있다", async () => {
    await renderDetail();

    expect(
      await screen.findByRole("button", { name: "삭제" }),
    ).toBeInTheDocument();
  });
});

describe("BrewDetailPage — 레시피·원두 이름", () => {
  /** 스펙의 화면 표에 맞춰 `recipeId: 12`인 로그를 쓴다. */
  function logWithRecipe12() {
    return http.get(DETAIL_URL, () =>
      HttpResponse.json({ ...brewLogWithTds, id: 42, recipeId: 12 }),
    );
  }

  it("AC-WEBNAME-03 · 상세 화면에 원두 줄이 있다", async () => {
    await renderDetail();

    expect(await screen.findByText("프릿츠 예가체프")).toBeInTheDocument();
    expect(screen.getByText("원두")).toBeInTheDocument();
  });

  it("AC-WEBNAME-30 · 제목을 읽었으면 상세의 제목이 레시피 링크다", async () => {
    server.use(
      logWithRecipe12(),
      http.get(`${BASE}/recipes/12`, () => HttpResponse.json(kasuyaRecipe)),
    );

    await renderDetail();

    const link = await screen.findByRole("link", {
      name: "Tetsu Kasuya 4:6 Method",
    });
    expect(link).toHaveAttribute("href", "/recipes/12");
  });

  it("AC-WEBNAME-31 · 폴백 문구는 링크가 아니다", async () => {
    server.use(
      logWithRecipe12(),
      http.get(`${BASE}/recipes/12`, () =>
        HttpResponse.json(
          { code: "FORBIDDEN", message: "권한이 없습니다." },
          { status: 403 },
        ),
      ),
    );

    await renderDetail();

    expect(await screen.findByText("비공개 레시피")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "비공개 레시피" }),
    ).not.toBeInTheDocument();
  });
});

describe("BrewDetailPage — 푸어 스텝", () => {
  /** 스펙의 화면 표에 맞춰 `recipeId: 12`인 로그를 쓴다. */
  function logWithRecipe12() {
    return http.get(DETAIL_URL, () =>
      HttpResponse.json({ ...brewLogWithTds, id: 42, recipeId: 12 }),
    );
  }

  /** 레시피 12를 스텝 6개짜리 Kasuya로 준다. `steps`만 갈아끼울 수 있다. */
  function recipe12(steps: Recipe["steps"] = kasuyaRecipe.steps) {
    return http.get(`${BASE}/recipes/12`, () =>
      HttpResponse.json({ ...kasuyaRecipe, steps }),
    );
  }

  /** 스텝 절. AC-07은 이 안쪽만 본다 — 화면 전체에는 편집·삭제 버튼이 있다. */
  async function stepSection(): Promise<HTMLElement> {
    const heading = await screen.findByText("푸어 스텝");
    const section = heading.closest("section");
    expect(section).not.toBeNull();
    return section as HTMLElement;
  }

  it("AC-WEBLOGSTEP-01 · 레시피를 읽었으면 스텝이 순서대로 보인다", async () => {
    server.use(logWithRecipe12(), recipe12());

    await renderDetail();

    const items = within(await stepSection()).getAllByRole("listitem");
    expect(items).toHaveLength(6);
    expect(within(items[0]).getByText("블룸")).toBeInTheDocument();
    expect(items[0]).toHaveTextContent("50g");
  });

  it("AC-WEBLOGSTEP-02 · 스텝 절은 실측값 뒤, 추출 분석 앞에 온다", async () => {
    server.use(logWithRecipe12(), recipe12());

    await renderDetail();

    const measured = await screen.findByText("실측값");
    const steps = await screen.findByText("푸어 스텝");
    const extraction = screen.getByText("추출 분석");
    expect(
      measured.compareDocumentPosition(steps) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      steps.compareDocumentPosition(extraction) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("AC-WEBLOGSTEP-06 · 스텝이 없는 레시피면 그 사실이 보인다", async () => {
    server.use(logWithRecipe12(), recipe12([]));

    await renderDetail();

    expect(await screen.findByText("푸어 스텝")).toBeInTheDocument();
    expect(screen.getByText("등록된 스텝이 없습니다")).toBeInTheDocument();
  });

  it("AC-WEBLOGSTEP-07 · 스텝 절은 읽기 전용이다", async () => {
    server.use(logWithRecipe12(), recipe12());

    await renderDetail();

    const section = within(await stepSection());
    expect(section.queryAllByRole("button")).toHaveLength(0);
    expect(section.queryAllByRole("textbox")).toHaveLength(0);
    expect(section.queryAllByRole("combobox")).toHaveLength(0);
  });

  /*
    아래 셋은 회귀 방지다. 절을 감싼 조건이 `isReady`인 한 처음부터 통과한다 —
    세 경우가 한 갈래로 처리되는 것이 이 설계의 요점이기 때문이다. 누군가 조건을
    `steps.length > 0`으로 바꾸면 못 읽을 때도 빈 절이 그려지는데, 그것을 잡는 것은
    이 세 조건뿐이다.
  */

  it("AC-WEBLOGSTEP-03 · 권한이 없으면 스텝 절이 없다", async () => {
    server.use(
      logWithRecipe12(),
      http.get(`${BASE}/recipes/12`, () =>
        HttpResponse.json(
          { code: "FORBIDDEN", message: "권한이 없습니다." },
          { status: 403 },
        ),
      ),
    );

    await renderDetail();

    // 폴백 문구가 뜬 시점이 곧 「조회가 끝났다」다. 그 뒤에 부재를 본다
    expect(await screen.findByText("비공개 레시피")).toBeInTheDocument();
    expect(screen.queryByText("푸어 스텝")).not.toBeInTheDocument();
  });

  it("AC-WEBLOGSTEP-04 · 삭제된 레시피면 스텝 절이 없다", async () => {
    server.use(
      logWithRecipe12(),
      http.get(`${BASE}/recipes/12`, () =>
        HttpResponse.json(
          { code: "NOT_FOUND", message: "레시피를 찾을 수 없습니다." },
          { status: 404 },
        ),
      ),
    );

    await renderDetail();

    expect(await screen.findByText("삭제된 레시피")).toBeInTheDocument();
    expect(screen.queryByText("푸어 스텝")).not.toBeInTheDocument();
  });

  it("AC-WEBLOGSTEP-05 · 조회 중에는 스텝 절이 없다", async () => {
    server.use(
      logWithRecipe12(),
      // 레시피 응답만 영영 도착하지 않게 한다. 로그 응답은 그대로 온다
      http.get(`${BASE}/recipes/12`, async () => {
        await delay("infinite");
        return HttpResponse.json(kasuyaRecipe);
      }),
    );

    await renderDetail();

    // 로그가 도착한 시점의 화면이다 — 실측값은 있는데 스텝 절은 아직 없어야 한다
    expect(await screen.findByText("실측값")).toBeInTheDocument();
    expect(screen.queryByText("푸어 스텝")).not.toBeInTheDocument();
  });
});
