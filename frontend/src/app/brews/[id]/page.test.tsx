import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, delay, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Recipe } from "@/features/recipe/schema";
import { clearSession, setAccessToken } from "@/lib/session";
import {
  brewers,
  brewLogWithoutTds,
  brewLogWithTds,
  fritzRoaster,
  grindedRecipe,
  kasuyaRecipe,
  myComandante,
  yirgacheffeBatch,
  yirgacheffeProduct,
} from "@/test/fixtures";
import { server } from "@/test/msw-server";
import { renderWithQuery } from "@/test/render";
import { mockViewportWidth } from "@/test/viewport";
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
    http.get(`${BASE}/gear/brewers`, () => HttpResponse.json(brewers)),
    // 내 기록일 때만 부른다 — 분쇄도 비교에 내 그라인더 모델이 필요하다(AC-BDETAIL-13·14).
    http.get(`${BASE}/gear/user-grinders`, () =>
      HttpResponse.json([myComandante]),
    ),
  );
});

/** 대표 수치는 세 클래스를 모두 가진 요소다. 하나라도 빠지면 잡히지 않는다. */
/**
 * 갱신(2026-09-17): 클래스 조합으로 찾던 것을 `data-lead`로 바꿨다.
 * 히어로 도입으로 클래스가 달라졌고, 스타일이 바뀔 때마다 셀렉터가 깨지는 것이
 * 이 훅이 존재하는 이유다.
 */
function leadElements(): Element[] {
  return [...document.querySelectorAll("[data-lead]")];
}

/** 대표 수치의 라벨. 히어로에서는 아이브로우가 그 역할을 한다. */
function leadLabel(lead: Element): string | null | undefined {
  return lead.closest("[data-hero]")?.querySelector("[data-eyebrow]")
    ?.textContent;
}

describe("BrewDetailPage", () => {
  it("AC-CONSIST-12 · h1이 하나이고 레시피 이름이다", async () => {
    await renderDetail();

    // 로그가 먼저 오고 레시피 이름이 뒤에 온다. 이름이 붙기 전의 빈 h1을 잡지 않도록
    // 이름으로 기다린 뒤 개수를 센다.
    await screen.findByRole("heading", { level: 1, name: "Kasuya 4:6" });
    const headings = screen.getAllByRole("heading", { level: 1 });

    expect(headings).toHaveLength(1);
    expect(headings[0].className).toContain("text-page-title");
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
    expect(headings[0].className).toContain("text-page-title");
    expect(headings[0].className).toContain("font-semibold");
    expect(headings[0].querySelector("a")).toBeNull();
  });

  it("AC-CONSIST-06 · 라벨이 폼 어휘를 쓴다", async () => {
    await renderDetail();
    await screen.findByText("실측값");

    // 갱신(2026-09-17): 대표 수치의 라벨은 이제 dt가 아니라 아이브로우다.
    const labels = [
      ...document.querySelectorAll("dt"),
      ...document.querySelectorAll("[data-eyebrow]"),
    ].map((el) => el.textContent);

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

  it("AC-WEBBREW-40 · AC-GRAMMAR-08 · 실측값이 서버 값 그대로 보인다", async () => {
    await renderDetail();

    expect(await screen.findByText("20 g")).toBeInTheDocument();
    expect(screen.getByText("300 g")).toBeInTheDocument();
    expect(screen.getByText("92 °C")).toBeInTheDocument();
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

    expect(await screen.findByText("20 g")).toBeInTheDocument();
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

    expect(await screen.findByRole("link", { name: "수정" })).toHaveAttribute(
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
      screen.queryByRole("link", { name: "수정" }),
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
    expect(items[0]).toHaveTextContent("50 g");
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

  it("AC-HOMECAL-54 · UTC 전날 23시 기록을 KST 날짜로 보여준다", async () => {
    server.use(
      http.get(DETAIL_URL, () =>
        HttpResponse.json({
          ...brewLogWithTds,
          id: 42,
          brewedAt: "2026-09-18T23:00:00Z",
        }),
      ),
    );

    await renderDetail();

    // 상세 부분은 AC-BDETAIL-04의 eyebrow 형식으로 본다 — UTC 09-18 23시가 KST 09-19 08시다.
    expect(await screen.findByText("09.19 토 · 08:00")).toBeInTheDocument();
  });
});

describe("다시 내리기 — docs/specs/2026-09-17-small-features.md", () => {
  it("AC-SMALL-10 · 같은 레시피로 새 기록을 여는 링크가 있다", async () => {
    await renderDetail();
    await screen.findByText("실측값");

    const link = screen.getByRole("link", { name: "다시 내리기" });

    // 좋았던 기록을 또 내리려면 지금은 레시피를 다시 찾아 들어가야 한다.
    expect(link.getAttribute("href")).toBe("/brews/new?recipeId=1");
  });
});

// ── docs/specs/2026-10-11-brew-detail-fidelity.md ───────────────────────────

/** 기록을 덮어쓴다. 값이 `undefined`인 키는 응답에서 빠진다(`non_null`). */
function logIs(
  over: Record<string, unknown> = {},
  base: object = brewLogWithTds,
) {
  return http.get(DETAIL_URL, () =>
    HttpResponse.json({ ...base, id: 42, recipeId: 1, ...over }),
  );
}

/** 히어로의 아래 줄 칸(`TDS`·`음료`·`SCA`). 없으면 `null`. */
function heroCol(label: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    `[data-hero] [data-hero-col="${label}"]`,
  );
}

describe("BrewDetailPage — 대표 수치·히어로", () => {
  it.each([
    ["수율이 있으면", {}, brewLogWithTds, "Extraction yield", "17.6 %"],
    ["TDS가 없으면 비율", {}, brewLogWithoutTds, "Ratio", "1:15.0"],
    [
      "비율도 없으면 물 온도",
      { brewRatio: undefined },
      brewLogWithoutTds,
      "물 온도",
      "92 °C",
    ],
  ] as const)(
    "AC-BDETAIL-02 · 대표 수치 — %s",
    async (_, over, base, eyebrow, value) => {
      server.use(logIs(over, base));
      await renderDetail();

      await waitFor(() => expect(leadElements()).toHaveLength(1));
      const [lead] = leadElements();
      expect(lead).toHaveTextContent(value);
      expect(leadLabel(lead)).toBe(eyebrow);
    },
  );

  it("AC-BDETAIL-03 · 히어로 아래 줄은 TDS·음료·SCA다", async () => {
    await renderDetail();
    await waitFor(() => expect(heroCol("TDS")).not.toBeNull());

    expect(heroCol("TDS")).toHaveTextContent("1.35 %");
    expect(heroCol("음료")).toHaveTextContent("260 g");
    expect(heroCol("SCA")).toHaveTextContent("추출 부족");
  });

  it("AC-BDETAIL-03 · 두 구간이 다 적정이면 SCA는 「적정」이다", async () => {
    server.use(logIs({ extractionZone: "IDEAL" }));
    await renderDetail();
    await waitFor(() => expect(heroCol("SCA")).not.toBeNull());

    expect(
      heroCol("SCA")?.querySelector("[data-hero-value]"),
    ).toHaveTextContent(/^적정$/);
  });

  it("AC-BDETAIL-16 · TDS가 없으면 TDS·SCA 칸이 없다", async () => {
    server.use(logIs({}, brewLogWithoutTds));
    await renderDetail();
    await waitFor(() => expect(leadElements()).toHaveLength(1));

    expect(heroCol("TDS")).toBeNull();
    expect(heroCol("SCA")).toBeNull();
    expect(
      screen.queryByText(
        "TDS 측정값이 없어 추출 수율을 계산할 수 없습니다. 비율과 관능 평가로 판단하세요.",
      ),
    ).toBeNull();
  });
});

describe("BrewDetailPage — 제목 영역", () => {
  it("AC-BDETAIL-04 · 제목 영역은 날짜·레시피·원두 줄이다", async () => {
    server.use(
      logIs({ recipeId: 12 }),
      http.get(`${BASE}/recipes/12`, () => HttpResponse.json(kasuyaRecipe)),
    );
    await renderDetail();

    const h1 = await screen.findByRole("heading", { level: 1 });
    const link = await within(h1).findByRole("link", {
      name: "Tetsu Kasuya 4:6 Method",
    });
    expect(link).toHaveAttribute("href", "/recipes/12");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByText("08.31 월 · 18:00")).toBeInTheDocument();
    expect(
      await screen.findByText("프릿츠 예가체프 · 로스팅 08.28 · Hario V60 02"),
    ).toBeInTheDocument();
  });
});

/** 비교표의 한 행. 없으면 `null`. */
function compareRow(label: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    `[data-compare] [data-compare-row="${label}"]`,
  );
}

function recipe1(over: Record<string, unknown>) {
  const recipe: Record<string, unknown> = {
    ...grindedRecipe,
    id: 1,
    title: "Kasuya 4:6",
    ...over,
  };
  for (const [key, value] of Object.entries(over)) {
    if (value === undefined) delete recipe[key];
  }
  return http.get(`${BASE}/recipes/1`, () => HttpResponse.json(recipe));
}

describe("BrewDetailPage — 비교표", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("AC-BDETAIL-05 · 웹 비교표는 4열이고 같으면 「같습니다.」다", async () => {
    server.use(logIs({ actualDoseG: 21.0 }));
    await renderDetail();
    await waitFor(() => expect(compareRow("분쇄도")).not.toBeNull());

    const table = document.querySelector<HTMLElement>("[data-compare]")!;
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((th) => th.textContent),
    ).toEqual(["항목", "레시피", "실제", "차이"]);
    expect(
      [...table.querySelectorAll("[data-compare-row]")].map((row) =>
        row.getAttribute("data-compare-row"),
      ),
    ).toEqual(["원두량", "물량", "물 온도", "분쇄도", "추출 시간"]);

    const dose = within(compareRow("원두량")!);
    expect(dose.getByText("20 g")).toBeInTheDocument();
    expect(dose.getByText("21 g")).toBeInTheDocument();
    expect(dose.getByText("원두를 1.0 g 더 썼습니다.")).toBeInTheDocument();
    expect(
      within(compareRow("물량")!).getByText("같습니다."),
    ).toBeInTheDocument();
  });

  it("AC-BDETAIL-07 · 모바일 비교표는 문장을 행 아래에 붙이고 같으면 비운다", async () => {
    mockViewportWidth(390);
    server.use(logIs({ actualDoseG: 21.0 }));
    await renderDetail();

    expect(
      await screen.findByText("원두를 1.0 g 더 썼습니다."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "차이" })).toBeNull();
    expect(screen.queryAllByText("같습니다.")).toHaveLength(0);
  });

  it("AC-BDETAIL-15 · 기준값이 없으면 대시다", async () => {
    server.use(recipe1({ waterTempC: undefined }));
    await renderDetail();
    await waitFor(() => expect(compareRow("물 온도")).not.toBeNull());

    const cells = within(compareRow("물 온도")!).getAllByRole("cell");
    expect(cells.map((cell) => cell.textContent)).toEqual(["—", "92 °C", "—"]);
  });

  it("AC-BDETAIL-13 · 남의 기록은 비교표에 분쇄도 행이 없다", async () => {
    server.use(logIs({ userId: 99 }));
    await renderDetail();
    await waitFor(() => expect(compareRow("원두량")).not.toBeNull());

    expect(compareRow("분쇄도")).toBeNull();
  });

  it("AC-BDETAIL-14 · 모델이 다르면 분쇄도 비교가 없다", async () => {
    server.use(recipe1({ grinderModelId: 5 }));
    await renderDetail();
    await waitFor(() => expect(compareRow("원두량")).not.toBeNull());

    expect(compareRow("분쇄도")).toBeNull();
  });
});

/** 라벨이 `label`인 원장 행. 없으면 `null`. */
function ledgerRow(label: string): HTMLElement | null {
  return (
    [
      ...document.querySelectorAll<HTMLElement>("[data-kit='ledger-field']"),
    ].find((row) => row.firstElementChild?.textContent === label) ?? null
  );
}

describe("BrewDetailPage — 원두·장비·평가·메모", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("AC-BDETAIL-08 · 원두·장비는 원장 행이다", async () => {
    await renderDetail();
    // 원두 이름·레시피 단위·내 그라인더가 각각 다른 응답이라 최종 글자를 기다린다.
    await waitFor(() =>
      expect(ledgerRow("분쇄도")).toHaveTextContent("집 · 22 클릭"),
    );
    await waitFor(() =>
      expect(ledgerRow("원두")).toHaveTextContent("프릿츠 예가체프"),
    );

    expect(ledgerRow("원두")).toHaveTextContent("로스팅 08.28 · 3일차");
  });

  it("AC-BDETAIL-08 · 레시피에 단위가 없으면 숫자만 붙인다", async () => {
    server.use(recipe1({ grindSettingUnit: undefined }));
    await renderDetail();
    await waitFor(() =>
      expect(ledgerRow("분쇄도")).toHaveTextContent("집 · 22"),
    );

    expect(ledgerRow("분쇄도")).not.toHaveTextContent("클릭");
  });

  it("AC-BDETAIL-13 · 남의 기록의 분쇄도 행에는 그라인더 이름이 없다", async () => {
    server.use(logIs({ userId: 99 }));
    await renderDetail();
    await waitFor(() =>
      expect(ledgerRow("분쇄도")).toHaveTextContent("22 클릭"),
    );

    expect(ledgerRow("분쇄도")).not.toHaveTextContent("집");
  });

  it("AC-BDETAIL-09 · 웹 평가는 별점과 읽기 전용 점이다", async () => {
    await renderDetail();
    const rating = await screen.findByText("★ 4");
    const section = rating.closest("section")!;

    expect(
      within(section)
        .getAllByRole("img")
        .map((img) => img.getAttribute("aria-label")),
    ).toEqual(["산미 4", "단맛 3", "바디 3", "쓴맛 2", "여운 4"]);
    expect(within(section).queryAllByRole("button")).toHaveLength(0);
  });

  it("AC-BDETAIL-09 · 모바일 평가는 한 줄이다", async () => {
    mockViewportWidth(390);
    await renderDetail();

    expect(await screen.findByText("★ 4")).toBeInTheDocument();
    expect(
      screen.getByText("산미 4 · 단맛 3 · 바디 3 · 쓴맛 2 · 여운 4"),
    ).toBeInTheDocument();
  });

  it("AC-BDETAIL-10 · 메모는 인용으로 보인다", async () => {
    await renderDetail();
    await waitFor(() =>
      expect(document.querySelector("[data-detail-note]")).not.toBeNull(),
    );

    expect(document.querySelector("[data-detail-note]")?.textContent).toBe(
      "“산미가 좋다”",
    );
  });

  it("AC-BDETAIL-17 · 없는 값의 블록은 그리지 않는다", async () => {
    server.use(
      logIs({
        rating: undefined,
        acidity: undefined,
        sweetness: undefined,
        body: undefined,
        bitterness: undefined,
        aftertaste: undefined,
        overallNote: undefined,
        beanBatchId: undefined,
      }),
    );
    await renderDetail();
    await waitFor(() => expect(leadElements()).toHaveLength(1));

    expect(screen.queryByText(/★/)).toBeNull();
    expect(screen.queryAllByRole("img", { name: /^산미 / })).toHaveLength(0);
    expect(document.querySelector("[data-detail-note]")).toBeNull();
    expect(ledgerRow("원두")).toBeNull();
  });
});
