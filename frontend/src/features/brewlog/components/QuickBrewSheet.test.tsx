import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, delay, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession, setAccessToken } from "@/lib/session";
import {
  fritzRoaster,
  me,
  myComandante,
  yirgacheffeProduct,
} from "@/test/fixtures";
import { server } from "@/test/msw-server";
import { renderWithQuery } from "@/test/render";
import { QuickBrewSheet } from "./QuickBrewSheet";

/** docs/specs/2026-11-14-quick-brew.md — 빠른 기록 시트(Task 7~9). 픽스처는 계약 2026-11-14-quick-brew.json의 필드 그대로. */

const BASE = "http://localhost:8080/api/v1";

/** 지난번 — 카탈로그 원두(yirgacheffeProduct)·원두량 16·물량 250·코만단테 24클릭·92°C·맞팔로우. */
const last = {
  id: 501,
  userId: me.id,
  beanProductId: yirgacheffeProduct.id,
  brewedAt: "2026-11-13T23:20:00Z",
  visibility: "FRIENDS",
  actualDoseG: 16.0,
  actualWaterG: 250.0,
  actualWaterTempC: 92.0,
  userGrinderId: myComandante.id,
  actualGrindSettingValue: 24.0,
  brewRatio: 15.6,
  rating: 3.5,
  overallNote: "쓴맛",
  createdAt: "2026-11-13T23:21:00Z",
  updatedAt: "2026-11-13T23:21:00Z",
};

const nameOnly = {
  ...last,
  id: 502,
  beanProductId: undefined,
  beanName: "하늘 블렌드",
  brewedAt: "2026-11-14T00:00:00Z",
};

function page(content: object[]) {
  return {
    content,
    page: 0,
    size: content.length,
    totalElements: content.length,
    totalPages: 1,
    hasNext: false,
  };
}

/** 기본 응답. `logs`는 brewedAt 내림차순(서버 정렬)으로 넘긴다. */
function given(
  logs: object[],
  onPost?: (body: unknown) => Response | Promise<Response>,
) {
  const posted: unknown[] = [];
  server.use(
    http.get(`${BASE}/users/me`, () => HttpResponse.json(me)),
    http.get(`${BASE}/brew-logs`, ({ request }) => {
      const size = Number(new URL(request.url).searchParams.get("size"));
      return HttpResponse.json(page(logs.slice(0, size)));
    }),
    http.get(`${BASE}/bean-products`, () =>
      HttpResponse.json([yirgacheffeProduct]),
    ),
    http.get(`${BASE}/roasters`, () => HttpResponse.json([fritzRoaster])),
    http.get(`${BASE}/gear/user-grinders`, () =>
      HttpResponse.json([myComandante]),
    ),
    http.post(`${BASE}/brew-logs`, async ({ request }) => {
      const body = await request.json();
      posted.push(body);
      if (onPost) return onPost(body);
      return HttpResponse.json(
        { ...last, id: 900, ...(body as object) },
        { status: 201 },
      );
    }),
  );
  return posted;
}

function open(start: "record" | "same" = "record") {
  const onClose = vi.fn();
  renderWithQuery(<QuickBrewSheet start={start} onClose={onClose} />);
  return onClose;
}

beforeEach(() => {
  clearSession();
  setAccessToken("test.access.token");
});

describe("시작 단계", () => {
  it("AC-QUICKBREW-23 · 「기록하기」는 ①, 「이대로 기록」은 ②, 지난번이 없으면 「얼마나 내렸나요?」", async () => {
    given([last]);
    const first = renderWithQuery(
      <QuickBrewSheet start="record" onClose={vi.fn()} />,
    );
    expect(
      await screen.findByRole("heading", { name: "지난번과 같은가요?" }),
    ).toBeInTheDocument();
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    first.unmount();

    const second = renderWithQuery(
      <QuickBrewSheet start="same" onClose={vi.fn()} />,
    );
    expect(
      await screen.findByRole("heading", { name: "맛은 어땠나요?" }),
    ).toBeInTheDocument();
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    second.unmount();

    given([]);
    renderWithQuery(<QuickBrewSheet start="record" onClose={vi.fn()} />);
    expect(
      await screen.findByRole("heading", { name: "얼마나 내렸나요?" }),
    ).toBeInTheDocument();
  });
});

describe("① 원두·양", () => {
  it("AC-QUICKBREW-24 · 지난번 값을 미리 채우고 별점·메모는 비운다", async () => {
    given([last]);
    open();
    await userEvent.click(
      await screen.findByRole("button", { name: "바꿀래요" }),
    );

    expect(screen.getByLabelText("원두량")).toHaveValue("16");
    expect(screen.getByLabelText("물량")).toHaveValue("250");
    expect(screen.getByText(yirgacheffeProduct.name)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(screen.getByRole("radio", { name: "별 4" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(screen.getByLabelText("한 줄 메모 (선택)")).toHaveValue("");
    await userEvent.click(screen.getByRole("button", { name: /자세히/ }));
    expect(screen.getByLabelText("물 온도")).toHaveValue("92");
    expect(screen.getByLabelText("분쇄도")).toHaveValue("24");
  });

  it("AC-QUICKBREW-43 · 물량이 비면 「다음」이 잠기고 누르면 물량 칸으로 포커스 + 안내", async () => {
    const posted = given([]);
    open();
    await userEvent.type(await screen.findByLabelText("원두량"), "16");

    const next = screen.getByRole("button", { name: "다음" });
    expect(next).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("1:—")).toBeInTheDocument();
    await userEvent.click(next);

    expect(screen.getByLabelText("물량")).toHaveFocus();
    expect(screen.getByText("물량을 적어 주세요")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "얼마나 내렸나요?" }),
    ).toBeInTheDocument();
    expect(posted).toHaveLength(0);
  });
});

describe("원두 고르기", () => {
  it("AC-QUICKBREW-26 · 직접 입력한 원두가 최근 원두 맨 위에, 같은 원두는 한 번만", async () => {
    given([nameOnly, last, { ...last, id: 503 }]);
    open();
    await userEvent.click(
      await screen.findByRole("button", { name: "바꿀래요" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "원두 고르기" }));

    const recent = screen.getByRole("list", { name: "최근 고른 원두" });
    const items = recent.querySelectorAll("li");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("하늘 블렌드");
    expect(items[1]).toHaveTextContent(yirgacheffeProduct.name);
  });

  it("AC-QUICKBREW-27 · 카탈로그에 없으면 그 이름으로 기록한다", async () => {
    const posted = given([last]);
    open();
    await userEvent.click(
      await screen.findByRole("button", { name: "바꿀래요" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "원두 고르기" }));
    await userEvent.type(screen.getByLabelText("원두 검색"), "하늘 블렌드");
    expect(
      screen.getByText("「하늘 블렌드」를 찾지 못했어요"),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "「하늘 블렌드」로 기록" }),
    );

    expect(screen.getByText("하늘 블렌드")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "다음" }));
    await userEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).toMatchObject({ beanName: "하늘 블렌드" });
    expect(posted[0]).not.toHaveProperty("beanProductId");
  });
});

describe("② 맛 · ③ 완료", () => {
  it("AC-QUICKBREW-28 · 별 4번째의 왼쪽 절반은 3.5, 오른쪽 절반은 4.0", async () => {
    const posted = given([last]);
    open("same");
    const star4 = await screen.findByRole("radio", { name: "별 4" });
    // 별 하나가 44×44 버튼 하나다(누르는 영역 잠금). 절반 판정은 누른 x 위치로 한다 — jsdom은 박스가 0이라 직접 준다.
    vi.spyOn(star4, "getBoundingClientRect").mockReturnValue({
      left: 100,
      width: 44,
      top: 0,
      height: 44,
      right: 144,
      bottom: 44,
      x: 100,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    const user = userEvent.setup();

    await user.pointer({
      keys: "[MouseLeft]",
      target: star4,
      coords: { clientX: 105 },
    });
    expect(screen.getByText("3.5")).toBeInTheDocument();
    await user.pointer({
      keys: "[MouseLeft]",
      target: star4,
      coords: { clientX: 140 },
    });
    expect(screen.getByText("4.0")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).toMatchObject({ rating: 4 });
  });

  it("AC-QUICKBREW-25 · 공개 범위 기본값은 지난번 값, 지난번이 없으면 「나만」", async () => {
    given([{ ...last, visibility: "PUBLIC" }]);
    const view = renderWithQuery(
      <QuickBrewSheet start="same" onClose={vi.fn()} />,
    );
    await userEvent.click(
      await screen.findByRole("button", { name: /자세히/ }),
    );
    expect(screen.getByRole("radio", { name: "전체" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    view.unmount();

    given([]);
    renderWithQuery(<QuickBrewSheet start="record" onClose={vi.fn()} />);
    await userEvent.type(await screen.findByLabelText("원두량"), "16");
    await userEvent.type(screen.getByLabelText("물량"), "250");
    await userEvent.click(screen.getByRole("button", { name: "다음" }));
    await userEvent.click(screen.getByRole("button", { name: /자세히/ }));
    expect(screen.getByRole("radio", { name: "나만" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("AC-QUICKBREW-30 · 완료 화면에 「레시피로 저장」이 없다", async () => {
    given([last]);
    open("same");
    await userEvent.click(await screen.findByRole("button", { name: "저장" }));

    expect(
      await screen.findByRole("heading", { name: "기록했어요" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "레시피로 저장" })).toBeNull();
    expect(screen.queryByRole("link", { name: "레시피로 저장" })).toBeNull();
  });

  it("AC-QUICKBREW-54 · 저장이 500이면 입력을 유지하고 「다시 시도」로 같은 본문을 보낸다", async () => {
    let fail = true;
    const posted = given([last], () =>
      fail
        ? HttpResponse.json(
            { code: "INTERNAL_ERROR", message: "x" },
            { status: 500 },
          )
        : HttpResponse.json({ ...last, id: 901 }, { status: 201 }),
    );
    open("same");
    await userEvent.click(await screen.findByRole("radio", { name: "별 4" }));
    await userEvent.type(
      screen.getByLabelText("한 줄 메모 (선택)"),
      "단맛이 길게 남음",
    );
    await userEvent.click(screen.getByRole("button", { name: "저장" }));

    expect(
      await screen.findByText(
        "저장하지 못했어요. 입력한 내용은 그대로 있어요.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("한 줄 메모 (선택)")).toHaveValue(
      "단맛이 길게 남음",
    );
    fail = false;
    await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    await waitFor(() => expect(posted).toHaveLength(2));
    expect(posted[1]).toEqual(posted[0]);
    expect(
      await screen.findByRole("heading", { name: "기록했어요" }),
    ).toBeInTheDocument();
  });

  it("AC-QUICKBREW-66 · 400ms 안에 끝나면 「저장하는 중…」을 그리지 않고, 늦으면 그린다", async () => {
    let wait = 50;
    given([last], async (body) => {
      await delay(wait);
      return HttpResponse.json(
        { ...last, id: 902, ...(body as object) },
        { status: 201 },
      );
    });
    const seen: string[] = [];
    const observer = new MutationObserver(() =>
      seen.push(document.body.textContent ?? ""),
    );
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
    });

    const fast = renderWithQuery(
      <QuickBrewSheet start="same" onClose={vi.fn()} />,
    );
    await userEvent.click(await screen.findByRole("button", { name: "저장" }));
    await screen.findByRole("heading", { name: "기록했어요" });
    expect(seen.some((text) => text.includes("저장하는 중…"))).toBe(false);
    fast.unmount();

    wait = 800;
    renderWithQuery(<QuickBrewSheet start="same" onClose={vi.fn()} />);
    await userEvent.click(await screen.findByRole("button", { name: "저장" }));
    expect(
      await screen.findByText("저장하는 중…", {}, { timeout: 1000 }),
    ).toBeInTheDocument();
    await screen.findByRole(
      "heading",
      { name: "기록했어요" },
      { timeout: 2000 },
    );
    observer.disconnect();
  });
});

describe("닫기", () => {
  it("AC-QUICKBREW-44 · 바뀐 게 없으면 바로 닫고, 별점을 눌렀으면 「기록을 그만둘까요?」", async () => {
    given([last]);
    const onClose = vi.fn();
    const first = renderWithQuery(<QuickBrewSheet start="same" onClose={onClose} />);
    await userEvent.click(await screen.findByRole("button", { name: "닫기" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    first.unmount();

    const onClose2 = vi.fn();
    renderWithQuery(<QuickBrewSheet start="same" onClose={onClose2} />);
    await userEvent.click(await screen.findByRole("radio", { name: "별 4" }));
    await userEvent.click(screen.getByRole("button", { name: "닫기" }));

    expect(onClose2).not.toHaveBeenCalled();
    expect(screen.getByText("기록을 그만둘까요?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "계속 쓰기" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "그만두기" }));
    expect(onClose2).toHaveBeenCalledTimes(1);
  });
});
