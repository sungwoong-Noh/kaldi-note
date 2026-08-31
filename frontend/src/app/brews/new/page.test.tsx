import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession, setAccessToken } from "@/lib/session";
import {
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
