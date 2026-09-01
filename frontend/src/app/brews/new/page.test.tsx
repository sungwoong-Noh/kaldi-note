import { screen, waitFor } from "@testing-library/react";
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
});

describe("BrewNewPage", () => {
  it("AC-WEBBREW-11 · 레시피의 원두량·물량·물온도가 미리 채워진다", async () => {
    await renderNewPage();

    expect(await screen.findByLabelText("원두량")).toHaveValue(20);
    expect(screen.getByLabelText("물량")).toHaveValue(300);
    expect(screen.getByLabelText("물 온도")).toHaveValue(92);
  });

  it("AC-WEBBREW-12 · 추출 시간은 빈칸으로 시작한다", async () => {
    await renderNewPage();

    expect(await screen.findByLabelText("추출 시간")).toHaveValue(null);
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
    server.use(userGrindersReturn({ ...myComandante, id: 6, grinderModelId: 2 }));

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

    expect(await screen.findByLabelText("분쇄도 값")).toHaveValue(22);
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

  it("AC-WEBBREW-10 · 원두 선택란은 로스터·제품·경과일을 함께 보여준다", async () => {
    await renderNewPage();

    expect(
      await screen.findByRole("option", { name: "프릿츠 예가체프 · 3일차" }),
    ).toBeInTheDocument();
  });

  it("AC-WEBBREW-23 · 원두가 없으면 등록 버튼이 보인다", async () => {
    server.use(http.get(`${BASE}/bean-batches`, () => HttpResponse.json([])));

    await renderNewPage();

    expect(await screen.findByText("등록된 원두가 없습니다")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "+ 원두 등록" }),
    ).toBeInTheDocument();
  });

  it("AC-WEBBREW-09 · 등록에 성공하면 그 재고가 선택된 상태가 된다", async () => {
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
    await user.click(await screen.findByRole("button", { name: "+ 원두 등록" }));
    await fillBeanDialog(user);

    expect(await screen.findByLabelText("원두")).toHaveValue("9");
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
    expect(screen.getByLabelText("원두량")).toHaveValue(21);
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

    await user.click(screen.getByRole("button", { name: "+ 원두 등록" }));
    await fillBeanDialog(user);

    await screen.findByLabelText("원두");
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
    await user.selectOptions(await screen.findByLabelText("원두"), "9");
    await user.click(screen.getByRole("button", { name: "기록하기" }));

    await waitFor(() => expect(captured.body).not.toBeNull());
    expect(captured.body).toEqual({
      recipeId: 1,
      beanBatchId: 9,
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
        return HttpResponse.json({ ...brewLogWithTds, id: 42 }, { status: 201 });
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

  it("AC-WEBBREW-28 · 5축은 접혀 있다", async () => {
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

  it("AC-WEBBREW-30 · 펼쳐서 고른 값이 본문에 담긴다", async () => {
    const user = userEvent.setup();
    const captured = captureCreate();

    await renderNewPage();
    await user.click(await screen.findByRole("button", { name: "맛 자세히" }));
    await user.selectOptions(screen.getByLabelText("산미"), "3");
    await user.click(screen.getByRole("button", { name: "기록하기" }));

    await waitFor(() => expect(captured.body).not.toBeNull());
    expect(captured.body?.acidity).toBe(3);
    expect(captured.body).not.toHaveProperty("body");
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

    expect(await screen.findByLabelText("드로다운 시간")).toHaveValue(null);
    expect(screen.getByLabelText("음료 중량")).toHaveValue(null);
    expect(screen.getByLabelText("TDS")).toHaveValue(null);
  });

  it("AC-WEBSHELL-19 · 채운 값이 저장 본문에 담긴다", async () => {
    const user = userEvent.setup();
    const captured = captureCreate();

    await renderNewPage();
    await user.type(await screen.findByLabelText("드로다운 시간"), "35");
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
