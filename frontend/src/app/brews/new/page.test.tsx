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
    expect(screen.getByText("프릿츠 예가체프 · 7일차")).toBeInTheDocument();

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
    expect(screen.getByLabelText("원두량")).toHaveValue(21);
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

    expect(await screen.findByLabelText("드로다운 시간")).toHaveValue("");
    expect(screen.getByLabelText("음료 중량")).toHaveValue(null);
    expect(screen.getByLabelText("TDS")).toHaveValue(null);
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

  it("AC-BREWFORM-03 · 히어로 아래 줄은 레시피 기준값이다", async () => {
    await renderNewPage();
    const h = await hero();

    expect(h.getByText("분쇄도 있는 레시피")).toBeInTheDocument();
    expect(h.getByText("20.0g → 300.0g · 92°C · 3:30")).toBeInTheDocument();
  });

  it("AC-BREWFORM-03 · 온도·시간이 없는 레시피는 그 조각이 빠진다", async () => {
    const recipe: Record<string, unknown> = { ...grindedRecipe, id: 1 };
    delete recipe.waterTempC;
    delete recipe.totalTimeSeconds;
    server.use(http.get(`${BASE}/recipes/1`, () => HttpResponse.json(recipe)));

    await renderNewPage();

    expect((await hero()).getByText("20.0g → 300.0g")).toBeInTheDocument();
  });

  it("AC-BREWFORM-04 · 값이 다 있으면 수율이 보인다", async () => {
    const user = userEvent.setup();
    await renderNewPage();
    const dose = await screen.findByLabelText("원두량");

    await user.clear(dose);
    await user.type(dose, "15");
    await user.type(screen.getByLabelText("음료 중량"), "225");
    await user.type(screen.getByLabelText("TDS"), "1.38");
    expect((await hero()).getByText("수율 20.7 %")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("TDS"));
    expect(
      (await hero()).getByText("TDS가 없으면 수율을 계산할 수 없습니다."),
    ).toBeInTheDocument();
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
