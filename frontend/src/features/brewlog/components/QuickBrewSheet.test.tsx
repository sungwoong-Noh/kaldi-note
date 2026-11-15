import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, delay, http } from "msw";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { closeQuickBrew, openQuickBrew } from "@/lib/quickBrew";
import { clearSession, setAccessToken } from "@/lib/session";
import {
  fritzRoaster,
  hoffmann,
  hoffmannSummary,
  me,
  myComandante,
  pageOf,
  yirgacheffeProduct,
  beanSearchPage,
  yirgacheffeSummary,
} from "@/test/fixtures";
import { server } from "@/test/msw-server";
import { renderWithQuery } from "@/test/render";
import { MIN_SEC_MESSAGE } from "../formState";
import { QuickBrewHost } from "./QuickBrewHost";
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
    http.get(`${BASE}/bean-products`, ({ request }) =>
      HttpResponse.json(beanSearchPage([yirgacheffeSummary], request.url)),
    ),
    http.get(`${BASE}/bean-products/3`, () =>
      HttpResponse.json(yirgacheffeProduct),
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

afterEach(() => {
  closeQuickBrew();
  vi.restoreAllMocks();
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
    const first = renderWithQuery(
      <QuickBrewSheet start="same" onClose={onClose} />,
    );
    await userEvent.click(await screen.findByRole("button", { name: "닫기" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    first.unmount();

    const onClose2 = vi.fn();
    renderWithQuery(<QuickBrewSheet start="same" onClose={onClose2} />);
    await userEvent.click(await screen.findByRole("radio", { name: "별 4" }));
    await userEvent.click(screen.getByRole("button", { name: "닫기" }));

    expect(onClose2).not.toHaveBeenCalled();
    expect(screen.getByText("기록을 그만둘까요?")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "계속 쓰기" }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "그만두기" }));
    expect(onClose2).toHaveBeenCalledTimes(1);
  });

  it("Esc·바깥 클릭 시 바뀐 입력이 없으면 바로 닫고, 있으면 「기록을 그만둘까요?」 확인 카드를 열고 다시 Esc로 닫는다", async () => {
    given([last]);
    const onClose = vi.fn();
    const first = renderWithQuery(
      <QuickBrewSheet start="same" onClose={onClose} />,
    );
    await screen.findByRole("dialog", { name: "빠른 기록" });
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
    first.unmount();

    const onClose2 = vi.fn();
    renderWithQuery(<QuickBrewSheet start="same" onClose={onClose2} />);
    await userEvent.click(await screen.findByRole("radio", { name: "별 4" }));
    await userEvent.keyboard("{Escape}");

    expect(onClose2).not.toHaveBeenCalled();
    expect(
      screen.getByRole("alertdialog", { name: "기록을 그만둘까요?" }),
    ).toBeInTheDocument();

    // 확인 카드 열린 상태에서 Esc를 한 번 더 누르면 계속 쓰기로 복귀한다
    await userEvent.keyboard("{Escape}");
    expect(onClose2).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("alertdialog", { name: "기록을 그만둘까요?" }),
    ).toBeNull();
  });

  it("바깥(스크림) 클릭 시 바뀐 입력 여부에 따라 바로 닫히거나 확인 카드를 연다", async () => {
    given([last]);
    const onClose = vi.fn();
    const first = renderWithQuery(
      <QuickBrewSheet start="same" onClose={onClose} />,
    );
    const dialog = await screen.findByRole("dialog", { name: "빠른 기록" });
    const scrim = dialog.previousElementSibling as HTMLElement;
    await userEvent.click(scrim);
    expect(onClose).toHaveBeenCalledTimes(1);
    first.unmount();

    const onClose2 = vi.fn();
    renderWithQuery(<QuickBrewSheet start="same" onClose={onClose2} />);
    await userEvent.click(await screen.findByRole("radio", { name: "별 4" }));
    const dialog2 = screen.getByRole("dialog", { name: "빠른 기록" });
    await userEvent.click(dialog2.previousElementSibling as HTMLElement);
    expect(onClose2).not.toHaveBeenCalled();
    expect(
      screen.getByRole("alertdialog", { name: "기록을 그만둘까요?" }),
    ).toBeInTheDocument();
  });
});

function fireAnimationEnd(element: Element) {
  // jsdom에는 window.AnimationEvent가 없어 React 19가 onAnimationEnd를 webkitAnimationEnd에 연결한다.
  fireEvent.animationEnd(element);
  fireEvent(element, new Event("webkitAnimationEnd", { bubbles: true }));
}

describe("키보드 Enter · 웹 패널 · 모바일 끌어 닫기 (Task 11)", () => {
  it("AC-QUICKBREW-67 · 오른쪽 패널·오른쪽 시트 반응형 폭과 열기/닫기 모션 클래스를 갖는다", async () => {
    given([last]);
    const onExitComplete = vi.fn();
    function ToggleHarness() {
      const [open, setOpen] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setOpen(false)}>
            테스트 닫기
          </button>
          <QuickBrewSheet
            start="same"
            open={open}
            onClose={vi.fn()}
            onExitComplete={onExitComplete}
          />
        </>
      );
    }
    renderWithQuery(<ToggleHarness />);
    const dialog = await screen.findByRole("dialog", { name: "빠른 기록" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("data-state", "open");
    expect(dialog.className).toContain("min-[760px]:w-[min(100vw,520px)]");
    expect(dialog.className).toContain("min-[1024px]:w-[400px]");
    expect(dialog.className).toContain("min-[1280px]:w-[440px]");
    expect(dialog.className).toContain("min-[760px]:h-full");
    expect(dialog.className).toContain(
      "animate-[sheet-slide-in_240ms_cubic-bezier(0.2,0.8,0.2,1)]",
    );
    expect(dialog.className).toContain(
      "min-[760px]:animate-[panel-slide-in_240ms_cubic-bezier(0.2,0.8,0.2,1)]",
    );
    expect(dialog.className).toContain("motion-reduce:animate-none");

    await userEvent.click(screen.getByRole("button", { name: "테스트 닫기" }));
    expect(dialog).toHaveAttribute("data-state", "closed");
    expect(dialog.className).toContain(
      "animate-[sheet-slide-out_200ms_cubic-bezier(0.2,0.8,0.2,1)_forwards]",
    );
    expect(dialog.className).toContain(
      "min-[760px]:animate-[panel-slide-out_200ms_cubic-bezier(0.2,0.8,0.2,1)_forwards]",
    );
    fireAnimationEnd(dialog);
    expect(onExitComplete).toHaveBeenCalledTimes(1);
  });

  it("Enter 키가 각 단계의 주 버튼을 실행하고, 완료에서 닫히며, IME 조합·로딩·원두 검색 중에는 오작동하지 않는다", async () => {
    let resolvePost!: (res: Response) => void;
    const posted = given(
      [last],
      () =>
        new Promise<Response>((resolve) => {
          resolvePost = resolve;
        }),
    );
    const onClose = vi.fn();
    renderWithQuery(<QuickBrewSheet start="record" onClose={onClose} />);

    await screen.findByRole("heading", { name: "지난번과 같은가요?" });
    // 외부 트리거 버튼에 포커스가 남아있었더라도 다이얼로그가 포커스를 받아 Enter = 「네, 같아요」
    await userEvent.keyboard("{Enter}");
    expect(
      await screen.findByRole("heading", { name: "맛은 어땠나요?" }),
    ).toBeInTheDocument();

    // IME 조합 중 Enter는 저장하지 않는다
    const memo = screen.getByLabelText("한 줄 메모 (선택)");
    memo.focus();
    fireEvent.keyDown(memo, { key: "Enter", isComposing: true });
    expect(posted).toHaveLength(0);

    // 확인 카드가 열린 상태에서 Enter = 주 버튼(「계속 쓰기」)
    const star4 = screen.getByRole("radio", { name: "별 4" });
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
      coords: { clientX: 110, clientY: 22 },
    });
    expect(screen.getByText("3.5")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(
      screen.getByRole("alertdialog", { name: "기록을 그만둘까요?" }),
    ).toBeInTheDocument();
    await userEvent.keyboard("{Enter}");
    expect(
      screen.queryByRole("alertdialog", { name: "기록을 그만둘까요?" }),
    ).toBeNull();

    // 별 4 라디오에 포커스가 남은 상태로 Enter를 눌러도 3.5를 덮어쓰지 않고 「저장」이 실행된다
    star4.focus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).toMatchObject({ rating: 3.5 });

    // 저장 진행 중 추가 Enter는 중복 요청을 보내지 않는다
    await userEvent.keyboard("{Enter}");
    expect(posted).toHaveLength(1);

    resolvePost(
      HttpResponse.json({ ...last, id: 950, rating: 3.5 }, { status: 201 }),
    );
    expect(
      await screen.findByRole("heading", { name: "기록했어요" }),
    ).toBeInTheDocument();

    // 완료 단계에서 Enter = 「확인」
    await userEvent.keyboard("{Enter}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("AmountStep과 BeanStep에서 Enter는 입력 검증·원두 검색을 존중한다", async () => {
    given([]);
    renderWithQuery(<QuickBrewSheet start="record" onClose={vi.fn()} />);

    const dose = await screen.findByLabelText("원두량");
    await userEvent.click(dose);
    await userEvent.keyboard("{Enter}");
    expect(screen.getByText("원두량을 적어 주세요")).toBeInTheDocument();

    await userEvent.type(dose, "18");
    const water = screen.getByLabelText("물량");
    await userEvent.type(water, "300");

    // 원두 고르기 진입: 검색창에서 Enter는 아무 항목도 고르지 않는다
    await userEvent.click(screen.getByRole("button", { name: /원두/ }));
    const search = await screen.findByLabelText("원두 검색");
    await userEvent.type(search, "에티오피아{Enter}");
    expect(
      screen.getByRole("heading", { name: "어떤 원두인가요?" }),
    ).toBeInTheDocument();

    // 다시 양 입력으로 돌아가 입력칸에서 Enter = 「다음」
    await userEvent.click(screen.getByRole("button", { name: "‹ 이전" }));
    const doseBack = await screen.findByLabelText("원두량");
    doseBack.focus();
    await userEvent.keyboard("{Enter}");
    expect(
      await screen.findByRole("heading", { name: "맛은 어땠나요?" }),
    ).toBeInTheDocument();
  });

  it("ConfirmStep에서 「바꿀래요」 버튼에 포커스가 있을 때 Enter는 「바꿀래요」만 실행한다", async () => {
    given([last]);
    renderWithQuery(<QuickBrewSheet start="record" onClose={vi.fn()} />);
    await screen.findByRole("heading", { name: "지난번과 같은가요?" });
    const changeBtn = screen.getByRole("button", { name: "바꿀래요" });
    changeBtn.focus();
    await userEvent.keyboard("{Enter}");
    expect(
      await screen.findByRole("heading", { name: "무엇이 달라졌나요?" }),
    ).toBeInTheDocument();
  });

  it("AC-QUICKBREW-68 · 모바일 손잡이를 시트 높이의 29% 끌면 복귀하고, 31% 끌면 닫힌다(입력 변경 시 확인)", async () => {
    given([last]);
    const onClose = vi.fn();
    const first = renderWithQuery(
      <QuickBrewSheet start="same" onClose={onClose} />,
    );
    const dialog = await screen.findByRole("dialog", { name: "빠른 기록" });
    const handle = dialog.querySelector("[data-sheet-handle]") as HTMLElement;
    expect(handle).not.toBeNull();
    vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue({
      width: 390,
      height: 500,
      top: 344,
      left: 0,
      right: 390,
      bottom: 844,
      x: 0,
      y: 344,
      toJSON: () => ({}),
    });

    // 29% (145px): 복귀
    fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientY: 360 });
    fireEvent(
      window,
      new PointerEvent("pointermove", { pointerId: 1, clientY: 505 }),
    );
    expect(dialog.style.transform).toBe("translateY(145px)");
    fireEvent(
      window,
      new PointerEvent("pointerup", { pointerId: 1, clientY: 505 }),
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(dialog.style.transform).toBe("translateY(0px)");

    // 31% (155px): 닫힘
    fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientY: 360 });
    fireEvent(
      window,
      new PointerEvent("pointermove", { pointerId: 1, clientY: 515 }),
    );
    fireEvent(
      window,
      new PointerEvent("pointerup", { pointerId: 1, clientY: 515 }),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
    first.unmount();

    // 바뀐 입력이 있으면 31% 끌어도 바로 닫히지 않고 확인 카드가 열린다
    const onCloseDirty = vi.fn();
    renderWithQuery(<QuickBrewSheet start="same" onClose={onCloseDirty} />);
    const dirtyDialog = await screen.findByRole("dialog", {
      name: "빠른 기록",
    });
    const dirtyHandle = dirtyDialog.querySelector(
      "[data-sheet-handle]",
    ) as HTMLElement;
    vi.spyOn(dirtyDialog, "getBoundingClientRect").mockReturnValue({
      width: 390,
      height: 500,
      top: 344,
      left: 0,
      right: 390,
      bottom: 844,
      x: 0,
      y: 344,
      toJSON: () => ({}),
    });
    await userEvent.click(screen.getByRole("radio", { name: "별 4" }));
    fireEvent.pointerDown(dirtyHandle, {
      pointerId: 1,
      button: 0,
      clientY: 360,
    });
    fireEvent(
      window,
      new PointerEvent("pointermove", { pointerId: 1, clientY: 515 }),
    );
    fireEvent(
      window,
      new PointerEvent("pointerup", { pointerId: 1, clientY: 515 }),
    );
    expect(onCloseDirty).not.toHaveBeenCalled();
    expect(
      screen.getByRole("alertdialog", { name: "기록을 그만둘까요?" }),
    ).toBeInTheDocument();
  });

  it("AC-QUICKBREW-60 · AC-QUICKBREW-61 · QuickBrewHost가 닫힘 애니메이션 완료 후 언마운트하고 reduced-motion이면 즉시 언마운트한다", async () => {
    given([last]);
    renderWithQuery(<QuickBrewHost />);

    act(() => openQuickBrew("same"));
    const dialog = await screen.findByRole("dialog", { name: "빠른 기록" });
    expect(dialog).toHaveAttribute("data-state", "open");

    await userEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(screen.getByRole("dialog", { name: "빠른 기록" })).toHaveAttribute(
      "data-state",
      "closed",
    );
    fireAnimationEnd(dialog);
    expect(screen.queryByRole("dialog", { name: "빠른 기록" })).toBeNull();

    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: (query: string) => ({
        matches: query.includes("prefers-reduced-motion"),
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }),
    });

    try {
      act(() => openQuickBrew("same"));
      await screen.findByRole("dialog", { name: "빠른 기록" });
      await userEvent.click(screen.getByRole("button", { name: "닫기" }));
      expect(screen.queryByRole("dialog", { name: "빠른 기록" })).toBeNull();
    } finally {
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        writable: true,
        value: originalMatchMedia,
      });
    }
  });
});

describe("다시 내리기 프리필 (Task 13)", () => {
  it("AC-QUICKBREW-33 · prefill을 넘기면 지난번 기록이 있어도 ① 입력 화면이 그 값으로 열리고 저장된다", async () => {
    const posted = given([last]);
    renderWithQuery(<QuickBrewHost />);

    act(() =>
      openQuickBrew("record", {
        beanProductId: null,
        beanName: "하늘 블렌드",
        doseG: 15,
        waterG: 240,
        waterTempC: 93,
        userGrinderId: myComandante.id,
        grindValue: 26,
        visibility: "PUBLIC",
      }),
    );

    expect(
      await screen.findByRole("heading", { name: "얼마나 내렸나요?" }),
    ).toBeInTheDocument();
    expect(screen.getByText("하늘 블렌드")).toBeInTheDocument();
    expect(screen.getByLabelText("원두량")).toHaveValue("15");
    expect(screen.getByLabelText("물량")).toHaveValue("240");

    await userEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(screen.getByRole("radio", { name: "별 4" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(screen.getByLabelText("한 줄 메모 (선택)")).toHaveValue("");

    await userEvent.click(screen.getByRole("button", { name: /자세히/ }));
    expect(screen.getByLabelText("물 온도")).toHaveValue("93");
    expect(screen.getByLabelText("그라인더")).toHaveValue(
      String(myComandante.id),
    );
    expect(screen.getByLabelText("분쇄도")).toHaveValue("26");
    expect(screen.getByRole("radio", { name: "전체" })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    await userEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).toEqual({
      actualDoseG: 15,
      actualWaterG: 240,
      beanName: "하늘 블렌드",
      actualWaterTempC: 93,
      userGrinderId: myComandante.id,
      actualGrindSettingValue: 26,
      visibility: "PUBLIC",
    });
  });
});

describe("② 「자세히」 확장 (Task 14)", () => {
  const recipe12Summary = {
    ...hoffmannSummary,
    id: 12,
    sourceType: "USER" as const,
    title: "아침 V60 15g",
    doseG: 15,
    waterG: 240,
    ratio: 16.0,
    waterTempC: 92,
    authorDisplayName: "민수",
  };

  const recipe12Detail = {
    ...hoffmann,
    ...recipe12Summary,
    steps: [],
  };

  async function openSameDetails() {
    open("same");
    await userEvent.click(
      await screen.findByRole("button", { name: /자세히/ }),
    );
  }

  function expectOrder(elements: HTMLElement[]) {
    for (let i = 0; i < elements.length - 1; i += 1) {
      const relation = elements[i].compareDocumentPosition(elements[i + 1]);
      expect(relation & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  }

  it("AC-QUICKBREW-70 · 「자세히」 칸 순서와 메모 칸 제외", async () => {
    given([{ ...last, userGrinderId: undefined }]);
    await openSameDetails();

    await userEvent.selectOptions(
      screen.getByLabelText("그라인더"),
      String(myComandante.id),
    );

    const orderLabels = [
      screen.getByText("물 온도"),
      screen.getByText("총 시간"),
      screen.getByText("드로다운"),
      screen.getByText("그라인더"),
      screen.getByText("분쇄도"),
      screen.getByText("맛 5축"),
      screen.getByText("산미"),
      screen.getByText("단맛"),
      screen.getByText("바디"),
      screen.getByText("쓴맛"),
      screen.getByText("여운"),
      screen.getByText("TDS (선택)"),
      screen.getByText("음료 중량 (선택)"),
      screen.getByText("수율"),
      screen.getByText("공개 범위"),
      screen.getByText("로스팅 날짜 (선택)"),
      screen.getByText("레시피 연결 (선택)"),
    ];
    expectOrder(orderLabels);

    const memoInputs = screen.getAllByLabelText(/메모/);
    expect(memoInputs).toHaveLength(1);
    const detailsToggle = screen.getByRole("button", { name: /자세히/ });
    expect(
      memoInputs[0].compareDocumentPosition(detailsToggle) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("AC-QUICKBREW-71 · 「자세히」 값이 저장 본문에 실리고 비운 맛 축은 빠진다", async () => {
    const posted = given([last]);
    await openSameDetails();

    await userEvent.type(screen.getByLabelText("총 시간"), "2:45");
    await userEvent.type(screen.getByLabelText("드로다운"), "0:35");
    await userEvent.click(screen.getByRole("button", { name: "산미 4" }));
    await userEvent.click(screen.getByRole("button", { name: "단맛 5" }));
    await userEvent.type(screen.getByLabelText("TDS"), "1.38");
    await userEvent.type(screen.getByLabelText("음료 중량"), "212");

    await userEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).toMatchObject({
      actualTotalTimeSeconds: 165,
      actualDrawdownSeconds: 35,
      acidity: 4,
      sweetness: 5,
      tdsPercent: 1.38,
      beverageWeightG: 212,
    });
    expect(posted[0]).not.toHaveProperty("body");
    expect(posted[0]).not.toHaveProperty("bitterness");
    expect(posted[0]).not.toHaveProperty("aftertaste");
  });

  it("AC-QUICKBREW-72 · TDS·음료 중량으로 수율을 실시간 계산하고 TDS를 지우면 안내가 뜬다", async () => {
    given([last]);
    await openSameDetails();

    await userEvent.type(screen.getByLabelText("음료 중량"), "212");
    await userEvent.type(screen.getByLabelText("TDS"), "1.38");

    const yieldRow = screen.getByText("수율").parentElement!;
    expect(yieldRow).toHaveTextContent("수율 18.3 %");

    await userEvent.clear(screen.getByLabelText("TDS"));
    expect(yieldRow).toHaveTextContent("수율 —");
    expect(
      screen.getByText("TDS가 없으면 수율을 계산할 수 없습니다."),
    ).toBeInTheDocument();
  });

  it("AC-QUICKBREW-73 · 레시피 연결은 양을 덮어쓰지 않고 저장 본문에 recipeId를 싣거나 비운다", async () => {
    const posted = given([last]);
    server.use(
      http.get(`${BASE}/recipes`, () =>
        HttpResponse.json(pageOf([recipe12Summary], { size: 50 })),
      ),
    );
    await openSameDetails();

    await userEvent.click(screen.getByRole("button", { name: /레시피 연결/ }));
    expect(
      await screen.findByText("15g → 240g · 1:16.0 · 92°C"),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /아침 V60 15g/ }));

    expect(
      screen.queryByRole("dialog", { name: "레시피 연결" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /레시피 연결/ }),
    ).toHaveTextContent("아침 V60 15g");

    await userEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).toMatchObject({
      actualDoseG: 16,
      actualWaterG: 250,
      recipeId: 12,
    });

    // 다시 열어 「연결 안 함」을 고르면 recipeId 키가 빠진다.
    const posted2 = given([last]);
    server.use(
      http.get(`${BASE}/recipes`, () =>
        HttpResponse.json(pageOf([recipe12Summary], { size: 50 })),
      ),
    );
    await openSameDetails();
    await userEvent.click(screen.getByRole("button", { name: /레시피 연결/ }));
    await userEvent.click(
      await screen.findByRole("button", { name: /아침 V60 15g/ }),
    );
    await userEvent.click(screen.getByRole("button", { name: /레시피 연결/ }));
    await userEvent.click(
      await screen.findByRole("button", { name: /연결 안 함/ }),
    );
    expect(
      screen.getByRole("button", { name: /레시피 연결/ }),
    ).toHaveTextContent("연결 안 함");

    await userEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(posted2).toHaveLength(1));
    expect(posted2[0]).not.toHaveProperty("recipeId");
  });

  it("AC-QUICKBREW-74 · 지난번 recipeId가 있어도 레시피 연결은 비어 있고 레시피를 조회하지 않는다", async () => {
    const posted = given([{ ...last, recipeId: 12 }]);
    let recipeFetches = 0;
    server.use(
      http.get(`${BASE}/recipes/12`, () => {
        recipeFetches += 1;
        return HttpResponse.json(recipe12Detail);
      }),
    );

    renderWithQuery(<QuickBrewSheet start="same" onClose={vi.fn()} />);
    await userEvent.click(
      await screen.findByRole("button", { name: /자세히/ }),
    );
    expect(
      screen.getByRole("button", { name: /레시피 연결/ }),
    ).toHaveTextContent("연결 안 함");
    await userEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).not.toHaveProperty("recipeId");
    expect(recipeFetches).toBe(0);
  });

  it("AC-QUICKBREW-76 · 레시피 목록 500 실패 후 뒤로 가도 빠른 기록 입력값은 그대로다", async () => {
    given([last]);
    server.use(
      http.get(`${BASE}/recipes`, () =>
        HttpResponse.json(
          { code: "INTERNAL_ERROR", message: "fail" },
          { status: 500 },
        ),
      ),
    );
    await openSameDetails();
    await userEvent.type(screen.getByLabelText("한 줄 메모 (선택)"), "꽃향");
    await userEvent.type(screen.getByLabelText("총 시간"), "2:45");

    await userEvent.click(screen.getByRole("button", { name: /레시피 연결/ }));
    expect(
      await screen.findByText("레시피를 불러오지 못했어요."),
    ).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(
      screen.queryByRole("dialog", { name: "레시피 연결" }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("한 줄 메모 (선택)")).toHaveValue("꽃향");
    expect(screen.getByLabelText("총 시간")).toHaveValue("2:45");
  });

  it("AC-QUICKBREW-77 · 같은 맛 점을 다시 누르면 비고 acidity 키가 빠진다", async () => {
    const posted = given([last]);
    await openSameDetails();

    const dot4 = screen.getByRole("button", { name: "산미 4" });
    await userEvent.click(dot4);
    expect(dot4).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(dot4);
    expect(dot4).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).not.toHaveProperty("acidity");
  });

  it("AC-QUICKBREW-78 · 시간·맛 5축·TDS·음료 중량은 지난번 기록에서 채우지 않는다", async () => {
    given([
      {
        ...last,
        actualTotalTimeSeconds: 165,
        actualDrawdownSeconds: 35,
        acidity: 4,
        tdsPercent: 1.38,
        beverageWeightG: 212,
      },
    ]);
    open("record");
    await userEvent.click(
      await screen.findByRole("button", { name: "바꿀래요" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "다음" }));
    await userEvent.click(screen.getByRole("button", { name: /자세히/ }));

    expect(screen.getByLabelText("총 시간")).toHaveValue("");
    expect(screen.getByLabelText("드로다운")).toHaveValue("");
    expect(screen.getByLabelText("TDS")).toHaveValue("");
    expect(screen.getByLabelText("음료 중량")).toHaveValue("");
    for (const axis of ["산미", "단맛", "바디", "쓴맛", "여운"]) {
      for (let score = 1; score <= 5; score += 1) {
        expect(
          screen.getByRole("button", { name: `${axis} ${score}` }),
        ).toHaveAttribute("aria-pressed", "false");
      }
    }
  });

  it("AC-QUICKBREW-79 · 총 시간 2:75·abc·0:00은 오류와 함께 POST를 막고 드로다운 0:00은 허용한다", async () => {
    for (const bad of ["2:75", "abc", "0:00"]) {
      const posted = given([last]);
      const view = renderWithQuery(
        <QuickBrewSheet start="same" onClose={vi.fn()} />,
      );
      await userEvent.click(
        await screen.findByRole("button", { name: /자세히/ }),
      );
      await userEvent.type(screen.getByLabelText("총 시간"), bad);
      await userEvent.click(screen.getByRole("button", { name: "저장" }));

      expect(screen.getByText(MIN_SEC_MESSAGE)).toBeInTheDocument();
      expect(screen.getByLabelText("총 시간")).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      expect(posted).toHaveLength(0);
      view.unmount();
    }

    const postedOk = given([last]);
    await openSameDetails();
    await userEvent.type(screen.getByLabelText("드로다운"), "0:00");
    await userEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(postedOk).toHaveLength(1));
    expect(postedOk[0]).toMatchObject({ actualDrawdownSeconds: 0 });
  });

  it("AC-QUICKBREW-80 · TDS [0.01, 99.99] · 음료 중량 [0.1, 9999.9] 경계 검증", async () => {
    for (const badTds of ["0", "100"]) {
      const posted = given([last]);
      const view = renderWithQuery(
        <QuickBrewSheet start="same" onClose={vi.fn()} />,
      );
      await userEvent.click(
        await screen.findByRole("button", { name: /자세히/ }),
      );
      await userEvent.type(screen.getByLabelText("TDS"), badTds);
      await userEvent.click(screen.getByRole("button", { name: "저장" }));
      const tdsInput = screen.getByLabelText("TDS");
      expect(tdsInput).toHaveAttribute("aria-invalid", "true");
      expect(tdsInput).toHaveAccessibleDescription(/.+/);
      expect(posted).toHaveLength(0);
      view.unmount();
    }

    for (const goodTds of [0.01, 99.99]) {
      const posted = given([last]);
      const view = renderWithQuery(
        <QuickBrewSheet start="same" onClose={vi.fn()} />,
      );
      await userEvent.click(
        await screen.findByRole("button", { name: /자세히/ }),
      );
      await userEvent.type(screen.getByLabelText("TDS"), String(goodTds));
      await userEvent.click(screen.getByRole("button", { name: "저장" }));
      await waitFor(() => expect(posted).toHaveLength(1));
      expect(posted[0]).toMatchObject({ tdsPercent: goodTds });
      view.unmount();
    }

    for (const badWeight of ["0", "10000"]) {
      const posted = given([last]);
      const view = renderWithQuery(
        <QuickBrewSheet start="same" onClose={vi.fn()} />,
      );
      await userEvent.click(
        await screen.findByRole("button", { name: /자세히/ }),
      );
      await userEvent.type(screen.getByLabelText("음료 중량"), badWeight);
      await userEvent.click(screen.getByRole("button", { name: "저장" }));
      const weightInput = screen.getByLabelText("음료 중량");
      expect(weightInput).toHaveAttribute("aria-invalid", "true");
      expect(weightInput).toHaveAccessibleDescription(/.+/);
      expect(posted).toHaveLength(0);
      view.unmount();
    }

    for (const goodWeight of [0.1, 9999.9]) {
      const posted = given([last]);
      const view = renderWithQuery(
        <QuickBrewSheet start="same" onClose={vi.fn()} />,
      );
      await userEvent.click(
        await screen.findByRole("button", { name: /자세히/ }),
      );
      await userEvent.type(
        screen.getByLabelText("음료 중량"),
        String(goodWeight),
      );
      await userEvent.click(screen.getByRole("button", { name: "저장" }));
      await waitFor(() => expect(posted).toHaveLength(1));
      expect(posted[0]).toMatchObject({ beverageWeightG: goodWeight });
      view.unmount();
    }
  });

  it("AC-QUICKBREW-81 · POST가 400 또는 403으로 거절해도 「자세히」 값이 그대로 남는다", async () => {
    for (const status of [400, 403]) {
      given([last], () =>
        HttpResponse.json(
          { code: status === 400 ? "INVALID" : "FORBIDDEN", message: "err" },
          { status },
        ),
      );
      server.use(
        http.get(`${BASE}/recipes`, () =>
          HttpResponse.json(pageOf([recipe12Summary], { size: 50 })),
        ),
      );

      const view = renderWithQuery(
        <QuickBrewSheet start="same" onClose={vi.fn()} />,
      );
      await userEvent.click(
        await screen.findByRole("button", { name: /자세히/ }),
      );
      await userEvent.type(screen.getByLabelText("총 시간"), "2:45");
      await userEvent.type(screen.getByLabelText("TDS"), "1.38");
      await userEvent.click(
        screen.getByRole("button", { name: /레시피 연결/ }),
      );
      await userEvent.click(
        await screen.findByRole("button", { name: /아침 V60 15g/ }),
      );
      await userEvent.click(screen.getByRole("button", { name: "저장" }));

      expect(
        await screen.findByText(
          "저장하지 못했어요. 입력한 내용은 그대로 있어요.",
        ),
      ).toBeInTheDocument();
      expect(screen.getByLabelText("총 시간")).toHaveValue("2:45");
      expect(screen.getByLabelText("TDS")).toHaveValue("1.38");
      expect(
        screen.getByRole("button", { name: /레시피 연결/ }),
      ).toHaveTextContent("아침 V60 15g");
      view.unmount();
    }
  });

  it("AC-QUICKBREW-82 · TDS·음료 중량은 decimal 키패드, 총 시간·드로다운은 inputMode 없음", async () => {
    given([last]);
    await openSameDetails();

    expect(screen.getByLabelText("TDS")).toHaveAttribute(
      "inputmode",
      "decimal",
    );
    expect(screen.getByLabelText("음료 중량")).toHaveAttribute(
      "inputmode",
      "decimal",
    );
    expect(screen.getByLabelText("총 시간")).not.toHaveAttribute("inputmode");
    expect(screen.getByLabelText("드로다운")).not.toHaveAttribute("inputmode");
  });
});
