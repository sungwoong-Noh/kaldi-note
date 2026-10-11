import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession, setAccessToken } from "@/lib/session";
import {
  brewLogWithTds,
  comandanteC40,
  fritzRoaster,
  grindedRecipe,
  myComandante,
  yirgacheffeBatch,
  yirgacheffeProduct,
} from "@/test/fixtures";
import { server } from "@/test/msw-server";
import { renderWithQuery } from "@/test/render";
import { mockViewportWidth } from "@/test/viewport";
import BrewNewPage from "./page";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, refresh: vi.fn() }),
  usePathname: () => "/brews/new",
}));

const BASE = "http://localhost:8080/api/v1";

/** 이 화면이 항상 부르는 것들. 개별 테스트는 필요한 것만 덮어쓴다. */
function baseHandlers() {
  return [
    http.get(`${BASE}/recipes/1`, () =>
      HttpResponse.json({ ...grindedRecipe, id: 1 }),
    ),
    http.get(`${BASE}/gear/user-grinders`, () =>
      HttpResponse.json([{ ...myComandante, id: 5 }]),
    ),
    http.get(`${BASE}/gear/grinders`, () => HttpResponse.json([comandanteC40])),
    http.get(`${BASE}/bean-batches`, () =>
      HttpResponse.json([yirgacheffeBatch]),
    ),
    http.get(`${BASE}/bean-products`, () =>
      HttpResponse.json([yirgacheffeProduct]),
    ),
    http.get(`${BASE}/roasters`, () => HttpResponse.json([fritzRoaster])),
  ];
}

function userGrindersReturn(...grinders: object[]) {
  return http.get(`${BASE}/gear/user-grinders`, () =>
    HttpResponse.json(grinders),
  );
}

/** 원두 등록 모달의 3단 생성을 끝까지 채운다. 세부 검증은 BeanBatchDialog.test.tsx가 한다. */
async function fillBeanDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText("로스터 이름"), "프릿츠");
  await user.type(screen.getByLabelText("제품 이름"), "예가체프");
  await user.selectOptions(screen.getByLabelText("배전도"), "LIGHT");
  await user.type(screen.getByLabelText("원산지 국가"), "에티오피아");
  await user.type(screen.getByLabelText("중량"), "200");
  await user.type(screen.getByLabelText("로스팅일"), "2026-08-28");
  await user.click(screen.getByRole("button", { name: "등록" }));
}

/** 원두 행의 `변경`으로 다이얼로그를 연다. */
async function openBeanPicker(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "원두 변경" }));
  return within(await screen.findByRole("dialog", { name: "원두 고르기" }));
}

/** 다이얼로그를 열어 `+ 새 원두`로 3단 생성을 끝까지 채운다. */
async function registerBeanViaPicker(user: ReturnType<typeof userEvent.setup>) {
  const picker = await openBeanPicker(user);
  await user.click(picker.getByRole("button", { name: "+ 새 원두" }));
  await fillBeanDialog(user);
}

function renderNewPage() {
  return BrewNewPage({
    searchParams: Promise.resolve({ recipeId: "1" }),
  }).then((ui) => renderWithQuery(ui));
}

beforeEach(() => {
  push.mockClear();
  replace.mockClear();
  clearSession();
  setAccessToken("a.b.c");
  server.use(...baseHandlers());
});

afterEach(() => {
  // 되돌리지 않으면 뒤 테스트가 멈춘 시간을 물려받는다.
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** 라벨이 `label`인 원장 행. */
function ledgerRow(label: string): HTMLElement {
  const row = [
    ...document.querySelectorAll<HTMLElement>("[data-kit='ledger-field']"),
  ].find((el) => el.firstElementChild?.textContent === label);
  if (row === undefined) throw new Error(`${label} 원장 행이 없다`);
  return row;
}

describe("BrewNewPage", () => {
  it("AC-WEBBREW-11 · 레시피의 원두량·물량·물온도가 미리 채워진다", async () => {
    await renderNewPage();

    expect(await screen.findByLabelText("원두량")).toHaveValue("20");
    expect(screen.getByLabelText("물량")).toHaveValue("300");
    expect(screen.getByLabelText("물 온도")).toHaveValue("92");
  });

  it("AC-WEBBREW-12 · 추출 시간은 빈칸으로 시작한다", async () => {
    await renderNewPage();

    expect(await screen.findByLabelText("추출 시간")).toHaveValue("");
  });

  it("AC-WEBBREW-13 · 내린 시각의 기본값은 화면이 열린 시각이다", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-08-31T09:00:00Z"));

    await renderNewPage();

    expect(await screen.findByLabelText("내린 시각")).toHaveValue(
      "2026-08-31T09:00",
    );
  });

  it("AC-WEBBREW-14 · 레시피와 같은 모델의 그라인더가 자동 선택된다", async () => {
    server.use(
      userGrindersReturn(
        { ...myComandante, id: 5, grinderModelId: 1 },
        { ...myComandante, id: 6, grinderModelId: 2 },
      ),
    );

    await renderNewPage();

    expect(await screen.findByLabelText("그라인더")).toHaveValue("5");
  });

  it("AC-WEBBREW-15 · 같은 모델이 없으면 비어 있다", async () => {
    server.use(
      userGrindersReturn({ ...myComandante, id: 6, grinderModelId: 2 }),
    );

    await renderNewPage();

    expect(await screen.findByLabelText("그라인더")).toHaveValue("");
  });

  it("AC-WEBBREW-16 · 같은 모델이 둘이면 먼저 등록한 것을 고른다", async () => {
    server.use(
      userGrindersReturn(
        { ...myComandante, id: 8, nickname: "사무실" },
        { ...myComandante, id: 5, nickname: "집" },
      ),
    );

    await renderNewPage();

    expect(await screen.findByLabelText("그라인더")).toHaveValue("5");
  });

  it("AC-WEBBREW-17 · 레시피의 분쇄도 설정값이 복사된다", async () => {
    await renderNewPage();

    expect(await screen.findByLabelText("분쇄도 값")).toHaveValue("22");
  });

  it("AC-WEBBREW-01 · 등록된 그라인더가 없으면 그 사실을 알린다", async () => {
    server.use(userGrindersReturn());

    await renderNewPage();

    expect(
      await screen.findByText("등록된 그라인더가 없습니다"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "+ 그라인더 등록" }),
    ).toBeInTheDocument();
  });

  it("AC-WEBBREW-03 · 등록에 성공하면 그 그라인더가 선택된 상태가 된다", async () => {
    const user = userEvent.setup();
    // 실제 서버처럼 굴어야 한다 — 등록에 성공하면 그다음 목록 조회에 그것이 들어 있다.
    // 빈 배열을 계속 돌려주면 선택란에 고를 항목이 없어 "선택 상태"를 확인할 수 없다.
    const registered = { ...myComandante, id: 5 };
    let hasGrinder = false;
    server.use(
      http.get(`${BASE}/gear/user-grinders`, () =>
        HttpResponse.json(hasGrinder ? [registered] : []),
      ),
      http.post(`${BASE}/gear/user-grinders`, () => {
        hasGrinder = true;
        return HttpResponse.json(registered, { status: 201 });
      }),
    );

    await renderNewPage();
    await user.click(
      await screen.findByRole("button", { name: "+ 그라인더 등록" }),
    );
    await screen.findByRole("option", { name: "Comandante C40 MK4" });
    await user.selectOptions(screen.getByLabelText("모델"), "1");
    await user.click(screen.getByRole("button", { name: "등록" }));

    expect(await screen.findByLabelText("그라인더")).toHaveValue("5");
  });

  it("AC-BREWFORM-07 · 원두 다이얼로그는 재고를 로스팅일 최신순으로 보여준다", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`${BASE}/bean-batches`, () =>
        HttpResponse.json([
          {
            ...yirgacheffeBatch,
            id: 9,
            roastedAt: "2026-09-05",
            daysOffRoast: 7,
            remainingG: 180,
          },
          {
            ...yirgacheffeBatch,
            id: 8,
            roastedAt: "2026-09-10",
            daysOffRoast: 2,
            remainingG: 200,
          },
          // 로스팅일이 같으면 id가 큰 것이 먼저다
          {
            ...yirgacheffeBatch,
            id: 7,
            roastedAt: "2026-09-05",
            daysOffRoast: 7,
            remainingG: 50,
          },
        ]),
      ),
    );

    await renderNewPage();
    const picker = await openBeanPicker(user);
    const rows = picker.getAllByRole("button", { name: /프릿츠 예가체프/ });

    expect(rows.map((row) => row.textContent)).toEqual([
      "프릿츠 예가체프로스팅 09.10 · 2일차 · 남은 200 g",
      "프릿츠 예가체프로스팅 09.05 · 7일차 · 남은 180 g",
      "프릿츠 예가체프로스팅 09.05 · 7일차 · 남은 50 g",
    ]);
  });

  it("AC-BREWFORM-08 · 다이얼로그에서 고르면 닫히고 선택이 반영된다", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`${BASE}/bean-batches`, () =>
        HttpResponse.json([
          {
            ...yirgacheffeBatch,
            id: 9,
            roastedAt: "2026-09-05",
            daysOffRoast: 7,
            remainingG: 180,
          },
          {
            ...yirgacheffeBatch,
            id: 8,
            roastedAt: "2026-09-10",
            daysOffRoast: 2,
            remainingG: 200,
          },
        ]),
      ),
    );
    const captured = captureCreate();

    await renderNewPage();
    const picker = await openBeanPicker(user);
    await user.click(
      picker.getAllByRole("button", { name: /프릿츠 예가체프/ })[1],
    );

    expect(screen.queryByRole("dialog", { name: "원두 고르기" })).toBeNull();
    // 원장 행 — 값 `프릿츠 예가체프`, 보조줄에 로스팅일·경과일(docs/specs/2026-10-11-brew-form-fidelity.md)
    const beanRow = ledgerRow("원두");
    expect(beanRow).toHaveTextContent("프릿츠 예가체프");
    expect(beanRow).toHaveTextContent("로스팅 09.05 · 7일차");

    await user.click(screen.getByRole("button", { name: "기록하기" }));
    await waitFor(() => expect(captured.body?.beanBatchId).toBe(9));
  });

  it("AC-BREWFORM-15 · 원두 재고가 없을 때", async () => {
    const user = userEvent.setup();
    server.use(http.get(`${BASE}/bean-batches`, () => HttpResponse.json([])));

    await renderNewPage();
    const picker = await openBeanPicker(user);

    expect(picker.getByText("등록된 원두가 없습니다.")).toBeInTheDocument();
    expect(
      picker.getByRole("button", { name: "+ 새 원두" }),
    ).toBeInTheDocument();
  });

  it("AC-BREWFORM-09 · 다이얼로그 안에서 새 원두를 등록하면 선택된 채 닫힌다", async () => {
    const user = userEvent.setup();
    const registered = { ...yirgacheffeBatch, id: 11, beanProductId: 3 };
    let hasBatch = false;
    server.use(
      http.get(`${BASE}/bean-batches`, () =>
        HttpResponse.json(hasBatch ? [registered] : []),
      ),
      http.post(`${BASE}/roasters`, () =>
        HttpResponse.json(fritzRoaster, { status: 201 }),
      ),
      http.post(`${BASE}/bean-products`, () =>
        HttpResponse.json(yirgacheffeProduct, { status: 201 }),
      ),
      http.post(`${BASE}/bean-batches`, () => {
        hasBatch = true;
        return HttpResponse.json(registered, { status: 201 });
      }),
    );
    const captured = captureCreate();

    await renderNewPage();
    const dose = await screen.findByLabelText("원두량");
    await user.clear(dose);
    await user.type(dose, "21");
    await registerBeanViaPicker(user);

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByLabelText("원두량")).toHaveValue("21");
    await user.click(screen.getByRole("button", { name: "기록하기" }));
    await waitFor(() => expect(captured.body?.beanBatchId).toBe(11));
  });

  it("AC-WEBBREW-24 · 그라인더를 모달에서 등록해도 작성 중인 값이 남는다", async () => {
    const user = userEvent.setup();
    const registered = { ...myComandante, id: 5 };
    let hasGrinder = false;
    server.use(
      http.get(`${BASE}/gear/user-grinders`, () =>
        HttpResponse.json(hasGrinder ? [registered] : []),
      ),
      http.post(`${BASE}/gear/user-grinders`, () => {
        hasGrinder = true;
        return HttpResponse.json(registered, { status: 201 });
      }),
    );

    await renderNewPage();
    const dose = await screen.findByLabelText("원두량");
    await user.clear(dose);
    await user.type(dose, "21");

    await user.click(screen.getByRole("button", { name: "+ 그라인더 등록" }));
    await screen.findByRole("option", { name: "Comandante C40 MK4" });
    await user.selectOptions(screen.getByLabelText("모델"), "1");
    await user.click(screen.getByRole("button", { name: "등록" }));

    await screen.findByLabelText("그라인더");
    expect(screen.getByLabelText("원두량")).toHaveValue("21");
  });

  it("AC-WEBBREW-25 · 원두를 모달에서 등록해도 작성 중인 값이 남는다", async () => {
    const user = userEvent.setup();
    const registered = { ...yirgacheffeBatch, id: 9, beanProductId: 3 };
    let hasBatch = false;
    server.use(
      http.get(`${BASE}/bean-batches`, () =>
        HttpResponse.json(hasBatch ? [registered] : []),
      ),
      http.post(`${BASE}/roasters`, () =>
        HttpResponse.json(fritzRoaster, { status: 201 }),
      ),
      http.post(`${BASE}/bean-products`, () =>
        HttpResponse.json(yirgacheffeProduct, { status: 201 }),
      ),
      http.post(`${BASE}/bean-batches`, () => {
        hasBatch = true;
        return HttpResponse.json(registered, { status: 201 });
      }),
    );

    await renderNewPage();
    await user.type(await screen.findByLabelText("메모"), "단맛이 좋았다");

    await registerBeanViaPicker(user);

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByLabelText("메모")).toHaveValue("단맛이 좋았다");
  });
});

/**
 * 저장 응답은 **실제 응답 픽스처로 스텁한다.** `{ id: 42 }`만 돌려주면 Zod 스키마가 거부해서
 * 화면은 성공을 성공으로 못 본다 — 지어낸 응답으로 테스트하면 그 사실이 드러나지 않는다.
 */
function captureCreate(respond?: () => Response) {
  const captured: { body: Record<string, unknown> | null; calls: number } = {
    body: null,
    calls: 0,
  };
  server.use(
    http.post(`${BASE}/brew-logs`, async ({ request }) => {
      captured.calls += 1;
      captured.body = (await request.json()) as Record<string, unknown>;
      return (
        respond?.() ??
        HttpResponse.json({ ...brewLogWithTds, id: 42 }, { status: 201 })
      );
    }),
  );
  return captured;
}

function badRequest(field: string, message: string) {
  return () =>
    HttpResponse.json(
      {
        code: "INVALID_REQUEST",
        message: "입력값이 올바르지 않습니다.",
        fieldErrors: [{ field, message }],
      },
      { status: 400 },
    );
}

describe("BrewNewPage — 저장과 평가", () => {
  it("AC-WEBBREW-18 · 필수값만 채워 저장하면 그 본문으로 요청한다", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-08-31T09:00:00Z"));
    const user = userEvent.setup();
    server.use(
      http.get(`${BASE}/bean-batches`, () =>
        HttpResponse.json([{ ...yirgacheffeBatch, id: 9 }]),
      ),
    );
    const captured = captureCreate();

    await renderNewPage();
    const picker = await openBeanPicker(user);
    await user.click(picker.getByRole("button", { name: /프릿츠 예가체프/ }));
    await user.click(screen.getByRole("button", { name: "기록하기" }));

    await waitFor(() => expect(captured.body).not.toBeNull());
    expect(captured.body).toEqual({
      recipeId: 1,
      beanBatchId: 9,
      visibility: "PRIVATE",
      brewedAt: "2026-08-31T09:00:00.000Z",
      actualDoseG: 20,
      actualWaterG: 300,
      actualWaterTempC: 92,
      userGrinderId: 5,
      actualGrindSettingValue: 22,
    });
  });

  it("AC-WEBBREW-19 · 저장하는 동안 버튼이 잠긴다", async () => {
    const user = userEvent.setup();
    let release = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const captured = captureCreate();
    server.use(
      http.post(`${BASE}/brew-logs`, async ({ request }) => {
        captured.calls += 1;
        captured.body = (await request.json()) as Record<string, unknown>;
        await held;
        return HttpResponse.json(
          { ...brewLogWithTds, id: 42 },
          { status: 201 },
        );
      }),
    );

    await renderNewPage();
    const submit = await screen.findByRole("button", { name: "기록하기" });
    await user.click(submit);

    await waitFor(() => expect(submit).toBeDisabled());
    await user.click(submit);
    expect(captured.calls).toBe(1);

    release();
  });

  it("AC-WEBBREW-20 · 성공하면 그 로그의 상세로 간다", async () => {
    const user = userEvent.setup();
    captureCreate();

    await renderNewPage();
    await user.click(await screen.findByRole("button", { name: "기록하기" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/brews/42"));
  });

  it("AC-WEBBREW-21 · 빈칸인 선택 항목은 본문에서 빠진다", async () => {
    const user = userEvent.setup();
    const captured = captureCreate();

    await renderNewPage();
    await user.click(await screen.findByRole("button", { name: "기록하기" }));

    await waitFor(() => expect(captured.body).not.toBeNull());
    expect(captured.body).not.toHaveProperty("actualTotalTimeSeconds");
    expect(captured.body).not.toHaveProperty("tdsPercent");
    expect(captured.body).not.toHaveProperty("overallNote");
  });

  it("AC-WEBBREW-22 · 미래 시각이면 서버 문구가 보이고 화면이 유지된다", async () => {
    const user = userEvent.setup();
    captureCreate(badRequest("brewedAt", "과거 또는 현재여야 합니다"));

    await renderNewPage();
    const submit = await screen.findByRole("button", { name: "기록하기" });
    await user.click(submit);

    const input = await screen.findByLabelText("내린 시각");
    const describedBy = await waitFor(() => {
      const id = input.getAttribute("aria-describedby");
      expect(id).not.toBeNull();
      return id as string;
    });
    expect(document.getElementById(describedBy)).toHaveTextContent(
      "과거 또는 현재여야 합니다",
    );
    expect(push).not.toHaveBeenCalled();
    expect(submit).not.toBeDisabled();
  });

  it("AC-WEBBREW-27 · 별 네 번째를 누르면 별점이 4가 된다", async () => {
    const user = userEvent.setup();
    const captured = captureCreate();

    await renderNewPage();
    await user.click(await screen.findByRole("button", { name: "별점 4" }));
    await user.click(screen.getByRole("button", { name: "기록하기" }));

    await waitFor(() => expect(captured.body).not.toBeNull());
    expect(captured.body?.rating).toBe(4);
  });

  // 모바일에서만 접힌다 — 웹은 늘 펼침(AC-BREWFIT-15).
  it("AC-WEBBREW-28 · 5축은 접혀 있다(모바일)", async () => {
    mockViewportWidth(390);
    await renderNewPage();

    expect(
      await screen.findByRole("button", { name: "맛 자세히" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("산미")).not.toBeInTheDocument();
  });

  it("AC-WEBBREW-29 · 펼치지 않으면 5축 키를 보내지 않는다", async () => {
    const user = userEvent.setup();
    const captured = captureCreate();

    await renderNewPage();
    await user.click(await screen.findByRole("button", { name: "기록하기" }));

    await waitFor(() => expect(captured.body).not.toBeNull());
    for (const key of [
      "acidity",
      "sweetness",
      "body",
      "bitterness",
      "aftertaste",
    ]) {
      expect(captured.body).not.toHaveProperty(key);
    }
  });

  it("AC-WEBBREW-31 · 메모 길이 초과는 서버 문구로 알린다", async () => {
    const user = userEvent.setup();
    captureCreate(badRequest("overallNote", "1000자 이하여야 합니다"));

    await renderNewPage();
    await user.click(await screen.findByRole("button", { name: "기록하기" }));

    const input = await screen.findByLabelText("메모");
    const describedBy = await waitFor(() => {
      const id = input.getAttribute("aria-describedby");
      expect(id).not.toBeNull();
      return id as string;
    });
    expect(document.getElementById(describedBy)).toHaveTextContent(
      "1000자 이하여야 합니다",
    );
  });
});

describe("BrewNewPage — 드로다운·음료 중량·TDS", () => {
  it("AC-WEBSHELL-18 · 세 입력칸이 빈 채로 있다", async () => {
    await renderNewPage();

    expect(await screen.findByLabelText("드로다운 시간")).toHaveValue("");
    expect(screen.getByLabelText("음료 중량")).toHaveValue("");
    expect(screen.getByLabelText("TDS")).toHaveValue("");
  });

  it("AC-WEBSHELL-19 · 채운 값이 저장 본문에 담긴다", async () => {
    const user = userEvent.setup();
    const captured = captureCreate();

    await renderNewPage();
    await user.type(await screen.findByLabelText("드로다운 시간"), "0:35");
    await user.type(screen.getByLabelText("음료 중량"), "260");
    await user.type(screen.getByLabelText("TDS"), "1.35");
    await user.click(screen.getByRole("button", { name: "기록하기" }));

    await waitFor(() => expect(captured.body).not.toBeNull());
    expect(captured.body?.actualDrawdownSeconds).toBe(35);
    expect(captured.body?.beverageWeightG).toBe(260);
    expect(captured.body?.tdsPercent).toBe(1.35);
  });

  it("AC-WEBSHELL-20 · TDS 오류는 그 입력칸에 붙는다", async () => {
    const user = userEvent.setup();
    captureCreate(badRequest("tdsPercent", "100 미만이어야 합니다"));

    await renderNewPage();
    await user.click(await screen.findByRole("button", { name: "기록하기" }));

    const input = await screen.findByLabelText("TDS");
    const describedBy = await waitFor(() => {
      const id = input.getAttribute("aria-describedby");
      expect(id).not.toBeNull();
      return id as string;
    });
    expect(document.getElementById(describedBy)).toHaveTextContent(
      "100 미만이어야 합니다",
    );
  });
});

describe("BrewNewPage — 취소", () => {
  it("AC-WEBSHELL-15 · 취소하면 출발한 레시피로 간다", async () => {
    const user = userEvent.setup();

    await renderNewPage();
    await user.click(await screen.findByRole("button", { name: "취소" }));

    expect(push).toHaveBeenCalledWith("/recipes/1");
  });
});

describe("BrewNewPage — 에러 필드로 포커스 이동", () => {
  it("AC-ERRFOCUS-01 · 여러 필드가 틀리면 DOM 순서상 첫 번째로 포커스가 간다", async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${BASE}/brew-logs`, () =>
        HttpResponse.json(
          {
            code: "INVALID_REQUEST",
            message: "입력값이 올바르지 않습니다.",
            fieldErrors: [
              { field: "actualDoseG", message: "0보다 커야 합니다" },
              { field: "actualWaterG", message: "0보다 커야 합니다" },
            ],
          },
          { status: 400 },
        ),
      ),
    );

    await renderNewPage();
    await user.click(await screen.findByRole("button", { name: "기록하기" }));

    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByLabelText("원두량")),
    );
  });

  it("AC-ERRFOCUS-04 · 어떤 필드에도 안 붙는 에러는 하단 문구가 포커스를 받는다", async () => {
    const user = userEvent.setup();
    captureCreate(badRequest("quantity", "이상한 값입니다"));

    await renderNewPage();
    await user.click(await screen.findByRole("button", { name: "기록하기" }));

    const message = await screen.findByText("입력값이 올바르지 않습니다.");
    await waitFor(() => expect(document.activeElement).toBe(message));
    expect(message).toHaveAttribute("tabindex", "-1");
  });

  it("AC-ERRFOCUS-07 · 필드 에러가 있으면 하단 문구가 보여도 필드가 포커스를 받는다", async () => {
    const user = userEvent.setup();
    captureCreate(badRequest("actualDoseG", "0보다 커야 합니다"));

    await renderNewPage();
    await user.click(await screen.findByRole("button", { name: "기록하기" }));

    expect(
      await screen.findByText("입력값이 올바르지 않습니다."),
    ).toBeVisible();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByLabelText("원두량")),
    );
  });

  it("AC-ERRFOCUS-08 · 재시도가 다른 필드에서 실패하면 포커스가 그 필드로 다시 이동한다", async () => {
    const user = userEvent.setup();
    let call = 0;
    server.use(
      http.post(`${BASE}/brew-logs`, () => {
        call += 1;
        return call === 1
          ? badRequest("actualDoseG", "0보다 커야 합니다")()
          : badRequest("actualWaterG", "0보다 커야 합니다")();
      }),
    );

    await renderNewPage();
    const submit = await screen.findByRole("button", { name: "기록하기" });

    await user.click(submit);
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByLabelText("원두량")),
    );

    await user.click(submit);
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByLabelText("물량")),
    );
  });
});

describe("BrewNewPage — 시간 m:ss", () => {
  it("AC-BREWFORM-05 · 시간은 m:ss로 넣고 초로 보낸다", async () => {
    const user = userEvent.setup();
    const captured = captureCreate();

    await renderNewPage();
    await user.type(await screen.findByLabelText("추출 시간"), "3:30");
    await user.type(screen.getByLabelText("드로다운 시간"), "0:45");
    await user.click(screen.getByRole("button", { name: "기록하기" }));

    await waitFor(() => expect(captured.body).not.toBeNull());
    expect(captured.body?.actualTotalTimeSeconds).toBe(210);
    expect(captured.body?.actualDrawdownSeconds).toBe(45);
  });

  it.each(["3:5", "60:00", "abc", "3:60"])(
    "AC-BREWFORM-13 · %s는 요청을 보내지 않고 형식 안내를 붙인다",
    async (bad) => {
      const user = userEvent.setup();
      const captured = captureCreate();

      await renderNewPage();
      const input = await screen.findByLabelText("추출 시간");
      await user.type(input, bad);
      await user.click(screen.getByRole("button", { name: "기록하기" }));

      const describedBy = input.getAttribute("aria-describedby") ?? "";
      await waitFor(() =>
        expect(document.getElementById(describedBy)).toHaveTextContent(
          "0:00 형식으로 입력해 주세요.",
        ),
      );
      expect(captured.calls).toBe(0);
    },
  );

  it("AC-BREWFORM-13 · 경계값 0:00과 59:59는 그대로 보낸다", async () => {
    const user = userEvent.setup();
    const captured = captureCreate();

    await renderNewPage();
    await user.type(await screen.findByLabelText("추출 시간"), "59:59");
    await user.type(screen.getByLabelText("드로다운 시간"), "0:00");
    await user.click(screen.getByRole("button", { name: "기록하기" }));

    await waitFor(() => expect(captured.body).not.toBeNull());
    expect(captured.body?.actualTotalTimeSeconds).toBe(3599);
    expect(captured.body?.actualDrawdownSeconds).toBe(0);
  });
});

/** 히어로 판. 넓은 폭에서는 오른쪽, 좁은 폭에서는 위에 오지만 DOM은 하나다. */
async function hero() {
  await screen.findByLabelText("원두량");
  const el = document.querySelector<HTMLElement>("[data-hero]");
  if (el === null) throw new Error("히어로가 없다");
  return within(el);
}

describe("BrewNewPage — 히어로", () => {
  it("AC-BREWFORM-02 · 히어로가 실측 비율을 실시간으로 보여준다", async () => {
    const user = userEvent.setup();
    await renderNewPage();
    const dose = await screen.findByLabelText("원두량");
    const water = screen.getByLabelText("물량");

    await user.clear(dose);
    await user.type(dose, "16");
    await user.clear(water);
    await user.type(water, "250");
    expect((await hero()).getByText("1:15.6")).toBeInTheDocument();

    await user.clear(dose);
    expect((await hero()).getByText("1:—")).toBeInTheDocument();

    await user.type(dose, "0");
    expect((await hero()).getByText("1:—")).toBeInTheDocument();
  });
});

describe("BrewNewPage — 공개 범위", () => {
  it("AC-BREWFORM-10 · 공개 범위 3분할, 기본은 나만 보기", async () => {
    const user = userEvent.setup();
    const captured = captureCreate();

    await renderNewPage();
    const group = await screen.findByRole("radiogroup", { name: "공개 범위" });
    expect(
      within(group)
        .getAllByRole("radio")
        .map((radio) => radio.textContent),
    ).toEqual(["나만 보기", "맞팔로우 친구", "전체"]);
    expect(
      within(group).getByRole("radio", { name: "나만 보기" }),
    ).toBeChecked();

    await user.click(screen.getByRole("button", { name: "기록하기" }));
    await waitFor(() => expect(captured.body?.visibility).toBe("PRIVATE"));
  });

  it("AC-BREWFORM-10 · 전체를 고르면 PUBLIC으로 보낸다", async () => {
    const user = userEvent.setup();
    const captured = captureCreate();

    await renderNewPage();
    await user.click(await screen.findByRole("radio", { name: "전체" }));
    await user.click(screen.getByRole("button", { name: "기록하기" }));

    await waitFor(() => expect(captured.body?.visibility).toBe("PUBLIC"));
  });
});

function serverError(status: number, code: string, message: string) {
  return () => HttpResponse.json({ code, message }, { status });
}

describe("BrewNewPage — 상태", () => {
  it.each([undefined, "abc"])(
    "AC-BREWFORM-16 · recipeId가 %s면 요청 없이 레시피를 고르라고 안내한다",
    async (recipeId) => {
      let requests = 0;
      server.events.on("request:start", () => {
        requests += 1;
      });

      renderWithQuery(
        await BrewNewPage({ searchParams: Promise.resolve({ recipeId }) }),
      );

      expect(
        await screen.findByText("레시피를 골라 내려 주세요."),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: "레시피 보러 가기" }),
      ).toHaveAttribute("href", "/recipes");
      expect(requests).toBe(0);
      server.events.removeAllListeners();
    },
  );

  it("AC-BREWFORM-17 · 아무것도 안 바꿨으면 확인 없이 나간다", async () => {
    const user = userEvent.setup();
    await renderNewPage();

    await user.click(await screen.findByRole("button", { name: "취소" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(push).toHaveBeenCalledWith("/recipes/1");
  });

  it("AC-BREWFORM-17 · 바꾼 뒤 취소하면 확인하고, 계속 편집이면 값이 남는다", async () => {
    const user = userEvent.setup();
    await renderNewPage();
    const dose = await screen.findByLabelText("원두량");
    await user.clear(dose);
    await user.type(dose, "21");

    await user.click(screen.getByRole("button", { name: "취소" }));
    const confirm = within(
      await screen.findByRole("dialog", { name: "저장하지 않고 나갈까요?" }),
    );
    await user.click(confirm.getByRole("button", { name: "계속 편집" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByLabelText("원두량")).toHaveValue("21");
    expect(push).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "취소" }));
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "나가기",
      }),
    );
    expect(push).toHaveBeenCalledWith("/recipes/1");
  });

  it("AC-BREWFORM-19 · 저장 중에는 버튼이 저장 중…이고 잠긴다", async () => {
    const user = userEvent.setup();
    let release = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.post(`${BASE}/brew-logs`, async () => {
        await held;
        return HttpResponse.json(
          { ...brewLogWithTds, id: 42 },
          { status: 201 },
        );
      }),
    );

    await renderNewPage();
    await user.click(await screen.findByRole("button", { name: "기록하기" }));

    expect(
      await screen.findByRole("button", { name: "저장 중…" }),
    ).toBeDisabled();
    release();
  });

  it("AC-BREWFORM-20 · 필드 오류는 그 칸에 붙고 포커스가 간다", async () => {
    const user = userEvent.setup();
    captureCreate(badRequest("actualDoseG", "0보다 커야 합니다"));

    await renderNewPage();
    await user.click(await screen.findByRole("button", { name: "기록하기" }));

    const dose = screen.getByLabelText("원두량");
    await waitFor(() => expect(document.activeElement).toBe(dose));
    expect(
      document.getElementById(dose.getAttribute("aria-describedby") ?? ""),
    ).toHaveTextContent("0보다 커야 합니다");
  });

  it.each([
    [
      "GRIND_SETTING_OUT_OF_RANGE",
      "이 그라인더에서 쓸 수 없는 설정값입니다.",
      "장비",
    ],
    ["INVALID_BREW_MEASUREMENT", "추출 측정값이 올바르지 않습니다.", "결과"],
  ])(
    "AC-BREWFORM-21 · %s는 %s를 그 묶음 위 경고 블록에 보여준다",
    async (code, message, section) => {
      const user = userEvent.setup();
      captureCreate(serverError(400, code, message));

      await renderNewPage();
      const dose = await screen.findByLabelText("원두량");
      await user.clear(dose);
      await user.type(dose, "21");
      await user.click(screen.getByRole("button", { name: "기록하기" }));

      const group = screen.getByRole("group", { name: section });
      const warning = await within(group).findByText(message);
      expect(warning.closest("[data-warning]")).not.toBeNull();
      expect(screen.getByLabelText("원두량")).toHaveValue("21");
    },
  );

  it.each([
    [404, "NOT_FOUND", "재고를 찾을 수 없습니다: 9"],
    [403, "FORBIDDEN", "본인의 그라인더만 브루잉 로그에 연결할 수 있습니다."],
  ])(
    "AC-BREWFORM-22 · %s는 폼 맨 위 일반 에러에 서버 문구 그대로",
    async (status, code, message) => {
      const user = userEvent.setup();
      captureCreate(serverError(status, code, message));

      await renderNewPage();
      await user.click(await screen.findByRole("button", { name: "기록하기" }));

      const general = await waitFor(() => {
        const el = document.querySelector("[data-general-error]");
        if (el === null) throw new Error("일반 에러 없음");
        return el;
      });
      expect(general).toHaveTextContent(message);
      // 맨 위 — 첫 입력칸보다 앞에 있다
      const firstInput = screen.getByLabelText("내린 시각");
      expect(
        general.compareDocumentPosition(firstInput) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(screen.getByLabelText("원두량")).toHaveValue("20");
    },
  );

  it("AC-BREWFORM-23 · 레시피 조회 실패는 다시 시도할 수 있다", async () => {
    const user = userEvent.setup();
    let calls = 0;
    server.use(
      http.get(`${BASE}/recipes/1`, () => {
        calls += 1;
        return HttpResponse.json(
          { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
          { status: 500 },
        );
      }),
    );

    await renderNewPage();
    const retry = await screen.findByRole("button", { name: "다시 시도" });
    const before = calls;
    await user.click(retry);

    await waitFor(() => expect(calls).toBe(before + 1));
  });
});

// ── docs/specs/2026-10-11-brew-form-fidelity.md ─────────────────────────────

function recipeWith(over: Record<string, unknown>) {
  const recipe: Record<string, unknown> = { ...grindedRecipe, id: 1, ...over };
  for (const [key, value] of Object.entries(over)) {
    if (value === undefined) delete recipe[key];
  }
  server.use(http.get(`${BASE}/recipes/1`, () => HttpResponse.json(recipe)));
}

/** 웹 히어로의 열(`원두`·`물`·`시간`·`수율`·`TDS`·`음료`). */
function heroCol(label: string): HTMLElement {
  const col = document.querySelector<HTMLElement>(
    `[data-hero] [data-hero-col="${label}"]`,
  );
  if (col === null) throw new Error(`히어로 ${label} 열이 없다`);
  return col;
}

async function retype(
  user: ReturnType<typeof userEvent.setup>,
  input: HTMLElement,
  text: string,
) {
  await user.clear(input);
  if (text !== "") await user.type(input, text);
}

describe("BrewNewPage — 웹 히어로·다른 점", () => {
  it("AC-BREWFIT-06 · 웹 히어로는 실측 3열 아래에 레시피 값을 흐리게 보인다", async () => {
    const user = userEvent.setup();
    recipeWith({ doseG: 15.0, waterG: 250.0, totalTimeSeconds: 210 });

    await renderNewPage();
    await retype(user, await screen.findByLabelText("원두량"), "16");
    await retype(user, screen.getByLabelText("물량"), "250");
    await retype(user, screen.getByLabelText("추출 시간"), "3:45");

    const hero = document.querySelector<HTMLElement>("[data-hero]")!;
    expect(within(hero).getByText("1:15.6")).toBeInTheDocument();
    for (const [label, value, reference] of [
      ["원두", "16 g", "레시피 15"],
      ["물", "250 g", "레시피 250"],
      ["시간", "3:45", "레시피 3:30"],
    ]) {
      const col = within(heroCol(label));
      expect(col.getByText(value)).toBeInTheDocument();
      expect(col.getByText(reference)).toBeInTheDocument();
    }
  });

  it("AC-BREWFIT-06 · 레시피에 시간이 없으면 시간 열의 기준 표시가 없다", async () => {
    recipeWith({ doseG: 15.0, waterG: 250.0, totalTimeSeconds: undefined });

    await renderNewPage();
    await screen.findByLabelText("원두량");

    expect(heroCol("시간").querySelector("[data-hero-reference]")).toBeNull();
    expect(
      heroCol("원두").querySelector("[data-hero-reference]"),
    ).not.toBeNull();
  });

  it("AC-BREWFIT-07 · 웹 히어로 둘째 줄은 수율·TDS·음료다", async () => {
    const user = userEvent.setup();
    await renderNewPage();
    await retype(user, await screen.findByLabelText("원두량"), "15");
    await user.type(screen.getByLabelText("음료 중량"), "225");
    await user.type(screen.getByLabelText("TDS"), "1.38");

    expect(within(heroCol("수율")).getByText("20.7 %")).toBeInTheDocument();
    expect(within(heroCol("TDS")).getByText("1.38 %")).toBeInTheDocument();
    expect(within(heroCol("음료")).getByText("225 g")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("TDS"));
    expect(within(heroCol("수율")).getByText("—")).toBeInTheDocument();
    expect(within(heroCol("TDS")).getByText("—")).toBeInTheDocument();
    expect(within(heroCol("음료")).getByText("225 g")).toBeInTheDocument();
    expect(
      screen.queryByText("TDS가 없으면 수율을 계산할 수 없습니다."),
    ).toBeNull();
  });

  it("AC-BREWFIT-08 · 웹은 레시피와 다른 점을 저장 전에 미리 보여준다", async () => {
    const user = userEvent.setup();
    recipeWith({ doseG: 30.0, waterTempC: 93.0 });

    await renderNewPage();
    await retype(user, await screen.findByLabelText("원두량"), "31");
    await retype(user, screen.getByLabelText("물 온도"), "96");

    const block = document.querySelector<HTMLElement>("[data-recipe-diff]");
    expect(block).not.toBeNull();
    const text = block!.textContent ?? "";
    expect(text).toContain("원두를 1.0 g 더 썼습니다");
    expect(text).toContain("3 °C 높게 내렸습니다");
    expect(text.indexOf("원두를")).toBeLessThan(text.indexOf("3 °C"));

    await retype(user, screen.getByLabelText("원두량"), "30");
    await retype(user, screen.getByLabelText("물 온도"), "93");
    expect(document.querySelector("[data-recipe-diff]")).toBeNull();
  });

  it("AC-BREWFIT-09 · 분쇄도 기준 표시는 같은 모델·단위일 때만", async () => {
    const user = userEvent.setup();
    recipeWith({
      grinderModelId: 5,
      grindSettingValue: 22,
      grindSettingUnit: "CLICK",
    });
    server.use(
      userGrindersReturn(
        { ...myComandante, id: 5, grinderModelId: 5 },
        { ...myComandante, id: 6, grinderModelId: 6, nickname: "사무실" },
      ),
    );

    await renderNewPage();
    await screen.findByLabelText("원두량");
    expect(ledgerRow("분쇄도")).toHaveTextContent("레시피 22 클릭");

    await user.selectOptions(screen.getByLabelText("그라인더"), "6");
    expect(ledgerRow("분쇄도")).not.toHaveTextContent("레시피 22 클릭");
  });

  it("AC-BREWFIT-14 · 맛 도트는 고르고 같은 점을 다시 누르면 지운다", async () => {
    const user = userEvent.setup();
    const captured = captureCreate();

    await renderNewPage();
    const acidity = within(await screen.findByRole("group", { name: "산미" }));
    const four = acidity.getByRole("button", { name: "산미 4" });

    await user.click(four);
    expect(four).toHaveAttribute("aria-pressed", "true");
    expect(
      acidity.getAllByRole("button").map((dot) => dot.hasAttribute("data-on")),
    ).toEqual([true, true, true, true, false]);
    expect(acidity.getByText("4")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "기록하기" }));
    await waitFor(() => expect(captured.body?.acidity).toBe(4));

    await user.click(four);
    for (const dot of acidity.getAllByRole("button")) {
      expect(dot).toHaveAttribute("aria-pressed", "false");
    }
    expect(acidity.queryByText(/^[1-5]$/)).toBeNull();
    captured.body = null;
    await user.click(screen.getByRole("button", { name: "기록하기" }));
    await waitFor(() => expect(captured.body).not.toBeNull());
    expect(captured.body).not.toHaveProperty("acidity");
  });

  it("AC-BREWFIT-15 · 웹은 5축이 늘 펼쳐져 있다", async () => {
    await renderNewPage();
    await screen.findByLabelText("원두량");

    expect(
      screen.getAllByRole("button", {
        name: /^(산미|단맛|바디|쓴맛|여운) [1-5]$/,
      }),
    ).toHaveLength(25);
    expect(screen.queryByRole("button", { name: "맛 자세히" })).toBeNull();
  });

  it("AC-BREWFIT-21 · 한 축만 골라도 그 축만 보낸다", async () => {
    const user = userEvent.setup();
    const captured = captureCreate();

    await renderNewPage();
    await user.click(await screen.findByRole("button", { name: "여운 1" }));
    await user.click(screen.getByRole("button", { name: "기록하기" }));

    await waitFor(() => expect(captured.body).not.toBeNull());
    expect(captured.body?.aftertaste).toBe(1);
    for (const key of ["acidity", "sweetness", "body", "bitterness"]) {
      expect(captured.body).not.toHaveProperty(key);
    }
  });
});

describe("BrewNewPage — 모바일 원장·시트", () => {
  beforeEach(() => mockViewportWidth(390));

  /** 원장 행의 동작 버튼(`변경`·`맛 자세히`)을 누른다. */
  async function openRow(
    user: ReturnType<typeof userEvent.setup>,
    label: string,
  ) {
    await screen.findByLabelText("원두량");
    await user.click(
      within(ledgerRow(label)).getByRole("button", {
        name: label === "평가" ? "맛 자세히" : `${label} 변경`,
      }),
    );
    return within(
      await screen.findByRole("dialog", {
        name: label === "평가" ? "맛" : label,
      }),
    );
  }

  it("AC-BREWFIT-10 · 모바일 히어로 안에서 원두량·물량을 고친다", async () => {
    const user = userEvent.setup();
    recipeWith({ doseG: 15.0, waterG: 250.0 });

    await renderNewPage();
    const dose = await screen.findByLabelText("원두량");
    const hero = document.querySelector<HTMLElement>("[data-hero]")!;
    expect(hero.contains(dose)).toBe(true);
    expect(hero.contains(screen.getByLabelText("물량"))).toBe(true);

    await retype(user, dose, "16");
    expect(within(hero).getByText("1:15.6")).toBeInTheDocument();
    expect(within(hero).getByText(/^15g → 250g/)).toBeInTheDocument();
  });

  it("AC-BREWFIT-11 · 모바일 원장 행 순서와 「변경」", async () => {
    await renderNewPage();
    await screen.findByLabelText("원두량");

    const rows = [
      ...document.querySelectorAll<HTMLElement>("[data-kit='ledger-field']"),
    ];
    expect(rows.map((row) => row.firstElementChild?.textContent)).toEqual([
      "레시피",
      "내린 시각",
      "원두",
      "온도·시간",
      "장비",
      "결과",
      "평가",
      "메모",
    ]);
    expect(within(rows[0]).queryAllByRole("button")).toHaveLength(0);
    for (const row of rows.slice(1)) {
      const label = row.firstElementChild?.textContent;
      const action = label === "평가" ? "맛 자세히" : "변경";
      expect(
        within(row)
          .getAllByRole("button")
          .some((b) => b.textContent === action),
      ).toBe(true);
    }
  });

  it("AC-BREWFIT-12 · 행을 누르면 그 묶음만 담은 시트가 뜬다", async () => {
    const user = userEvent.setup();
    await renderNewPage();

    const sheet = await openRow(user, "온도·시간");
    expect(sheet.getAllByRole("textbox")).toHaveLength(3);
    await retype(user, sheet.getByLabelText("물 온도"), "96");
    await user.type(sheet.getByLabelText("추출 시간"), "3:45");
    await user.type(sheet.getByLabelText("드로다운 시간"), "0:40");
    await user.click(sheet.getByRole("button", { name: "완료" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(ledgerRow("온도·시간")).toHaveTextContent("96 °C · 3:45");
    expect(ledgerRow("온도·시간")).toHaveTextContent("드로다운 0:40");
  });

  it.each(["완료", "Escape", "딤"])(
    "AC-BREWFIT-13 · 시트를 %s로 닫아도 값이 남는다",
    async (how) => {
      const user = userEvent.setup();
      const captured = captureCreate();
      await renderNewPage();

      const sheet = await openRow(user, "결과");
      await user.type(sheet.getByLabelText("음료 중량"), "225");
      if (how === "완료")
        await user.click(sheet.getByRole("button", { name: "완료" }));
      if (how === "Escape") await user.keyboard("{Escape}");
      if (how === "딤")
        await user.click(
          document.querySelector<HTMLElement>("[data-sheet-dim]")!,
        );

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(ledgerRow("결과")).toHaveTextContent("225 g · TDS —");
      await user.click(screen.getByRole("button", { name: "기록하기" }));
      await waitFor(() => expect(captured.body?.beverageWeightG).toBe(225));
    },
  );

  it("AC-BREWFIT-15 · 모바일은 5축이 시트 안에 있다", async () => {
    const user = userEvent.setup();
    const captured = captureCreate();
    await renderNewPage();
    await screen.findByLabelText("원두량");

    expect(
      screen.queryAllByRole("button", { name: /^산미 [1-5]$/ }),
    ).toHaveLength(0);
    const sheet = await openRow(user, "평가");
    expect(
      sheet.getAllByRole("button", {
        name: /^(산미|단맛|바디|쓴맛|여운) [1-5]$/,
      }),
    ).toHaveLength(25);

    await user.click(sheet.getByRole("button", { name: "완료" }));
    await user.click(screen.getByRole("button", { name: "기록하기" }));
    await waitFor(() => expect(captured.body).not.toBeNull());
    for (const key of [
      "acidity",
      "sweetness",
      "body",
      "bitterness",
      "aftertaste",
    ]) {
      expect(captured.body).not.toHaveProperty(key);
    }
  });

  it("AC-BREWFIT-19 · 빈 값은 대시다", async () => {
    recipeWith({ waterTempC: undefined });
    await renderNewPage();
    await screen.findByLabelText("원두량");

    const temp = ledgerRow("온도·시간");
    expect(temp).toHaveTextContent("— · —");
    expect(temp).toHaveTextContent("드로다운 —");
    const result = ledgerRow("결과");
    expect(result).toHaveTextContent("— · TDS —");
    expect(result).toHaveTextContent("수율 —");
  });

  it("AC-BREWFIT-22 · 모바일 필드 오류는 그 시트를 열고 포커스를 옮긴다", async () => {
    const user = userEvent.setup();
    captureCreate(badRequest("actualWaterTempC", "100 이하여야 합니다"));
    await renderNewPage();
    await screen.findByLabelText("원두량");

    await user.click(screen.getByRole("button", { name: "기록하기" }));

    const sheet = within(
      await screen.findByRole("dialog", { name: "온도·시간" }),
    );
    const temp = sheet.getByLabelText("물 온도");
    await waitFor(() => expect(document.activeElement).toBe(temp));
    expect(
      document.getElementById(temp.getAttribute("aria-describedby") ?? ""),
    ).toHaveTextContent("100 이하여야 합니다");

    await user.click(sheet.getByRole("button", { name: "완료" }));
    expect(ledgerRow("온도·시간")).toHaveAttribute("data-invalid");
  });

  it("AC-BREWFIT-23 · 모바일 시간 형식 오류도 같은 길이다", async () => {
    const user = userEvent.setup();
    const captured = captureCreate();
    await renderNewPage();

    const sheet = await openRow(user, "온도·시간");
    await user.type(sheet.getByLabelText("추출 시간"), "3:60");
    await user.click(sheet.getByRole("button", { name: "완료" }));
    await user.click(screen.getByRole("button", { name: "기록하기" }));

    const reopened = within(
      await screen.findByRole("dialog", { name: "온도·시간" }),
    );
    const total = reopened.getByLabelText("추출 시간");
    await waitFor(() => expect(document.activeElement).toBe(total));
    expect(
      reopened.getByText("0:00 형식으로 입력해 주세요."),
    ).toBeInTheDocument();
    expect(captured.body).toBeNull();
  });

  it.each([
    [
      "GRIND_SETTING_OUT_OF_RANGE",
      "이 그라인더에서 쓸 수 없는 설정값입니다.",
      "장비",
    ],
    ["INVALID_BREW_MEASUREMENT", "추출 측정값이 올바르지 않습니다.", "결과"],
  ])(
    "AC-BREWFIT-24 · 모바일 %s 경고는 %s 행 바로 위에 붙는다",
    async (code, message, row) => {
      const user = userEvent.setup();
      captureCreate(serverError(400, code, message));
      await renderNewPage();
      await retype(user, await screen.findByLabelText("원두량"), "21");

      await user.click(screen.getByRole("button", { name: "기록하기" }));

      const warning = (await screen.findByText(message)).closest<HTMLElement>(
        "[data-warning]",
      );
      expect(warning).not.toBeNull();
      expect(ledgerRow(row).previousElementSibling).toBe(warning);
      expect(screen.getByLabelText("원두량")).toHaveValue("21");
    },
  );
});
