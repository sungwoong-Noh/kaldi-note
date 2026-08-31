import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setAccessToken } from "@/lib/session";
import { fritzRoaster, yirgacheffeBatch, yirgacheffeProduct } from "@/test/fixtures";
import { server } from "@/test/msw-server";
import { renderWithQuery } from "@/test/render";
import { BeanBatchDialog } from "./BeanBatchDialog";

const BASE = "http://localhost:8080/api/v1";

/** 세 요청의 호출 순서와 본문을 함께 기록한다. 순서가 AC의 절반이다. */
function recordCalls(overrides: {
  product?: () => Response;
} = {}) {
  const order: string[] = [];
  const bodies: Record<string, unknown[]> = {
    roasters: [],
    "bean-products": [],
    "bean-batches": [],
  };

  const record = (path: string, respond: () => Response) =>
    http.post(`${BASE}/${path}`, async ({ request }) => {
      order.push(path);
      bodies[path].push(await request.json());
      return respond();
    });

  server.use(
    record("roasters", () => HttpResponse.json(fritzRoaster, { status: 201 })),
    record(
      "bean-products",
      overrides.product ??
        (() => HttpResponse.json(yirgacheffeProduct, { status: 201 })),
    ),
    record("bean-batches", () =>
      HttpResponse.json(yirgacheffeBatch, { status: 201 }),
    ),
  );

  return { order, bodies };
}

function invalidProductName() {
  return HttpResponse.json(
    {
      code: "INVALID_REQUEST",
      message: "입력값이 올바르지 않습니다.",
      fieldErrors: [{ field: "name", message: "100자 이하여야 합니다" }],
    },
    { status: 400 },
  );
}

async function fillNewBean(
  user: ReturnType<typeof userEvent.setup>,
  { productName = "예가체프" } = {},
) {
  await user.type(screen.getByLabelText("로스터 이름"), "프릿츠");
  await user.type(screen.getByLabelText("제품 이름"), productName);
  await user.selectOptions(screen.getByLabelText("배전도"), "LIGHT");
  await user.type(screen.getByLabelText("원산지 국가"), "에티오피아");
  await user.type(screen.getByLabelText("중량"), "200");
  await user.type(screen.getByLabelText("로스팅일"), "2026-08-28");
}

function renderDialog(onCreated = vi.fn()) {
  renderWithQuery(
    <BeanBatchDialog onCreated={onCreated} onCancel={vi.fn()} />,
  );
  return onCreated;
}

beforeEach(() => {
  setAccessToken("a.b.c");
  server.use(
    http.get(`${BASE}/roasters`, () => HttpResponse.json([])),
    http.get(`${BASE}/bean-products`, () => HttpResponse.json([])),
  );
});

describe("BeanBatchDialog", () => {
  it("AC-WEBBREW-05 · 전부 새로 만들면 요청이 세 번 순서대로 나간다", async () => {
    const user = userEvent.setup();
    const { order, bodies } = recordCalls();
    renderDialog();

    await fillNewBean(user);
    await user.click(screen.getByRole("button", { name: "등록" }));

    await waitFor(() =>
      expect(order).toEqual(["roasters", "bean-products", "bean-batches"]),
    );
    expect(bodies["bean-products"][0]).toEqual({
      roasterId: 3,
      name: "예가체프",
      beanMix: "SINGLE_ORIGIN",
      roastLevel: "LIGHT",
      origins: [{ country: "에티오피아" }],
    });
    expect(bodies["bean-batches"][0]).toEqual({
      beanProductId: 3,
      weightG: 200,
      roastedAt: "2026-08-28",
    });
  });

  it("AC-WEBBREW-06 · 기존 로스터를 고르면 로스터 요청은 나가지 않는다", async () => {
    const user = userEvent.setup();
    server.use(http.get(`${BASE}/roasters`, () => HttpResponse.json([fritzRoaster])));
    const { order, bodies } = recordCalls();
    renderDialog();

    await screen.findByRole("option", { name: "프릿츠" });
    await user.selectOptions(screen.getByLabelText("로스터"), "3");
    await user.type(screen.getByLabelText("제품 이름"), "예가체프");
    await user.selectOptions(screen.getByLabelText("배전도"), "LIGHT");
    await user.type(screen.getByLabelText("원산지 국가"), "에티오피아");
    await user.type(screen.getByLabelText("중량"), "200");
    await user.type(screen.getByLabelText("로스팅일"), "2026-08-28");
    await user.click(screen.getByRole("button", { name: "등록" }));

    await waitFor(() => expect(order).toContain("bean-batches"));
    expect(order).not.toContain("roasters");
    expect(bodies["bean-products"][0]).toMatchObject({ roasterId: 3 });
  });

  it("AC-WEBBREW-07 · 제품에서 실패하면 로스터는 선택 상태로 남고 다시 만들지 않는다", async () => {
    const user = userEvent.setup();
    const { order, bodies } = recordCalls({ product: invalidProductName });
    renderDialog();

    await fillNewBean(user);
    await user.click(screen.getByRole("button", { name: "등록" }));
    await screen.findByText("100자 이하여야 합니다");

    await user.clear(screen.getByLabelText("제품 이름"));
    await user.type(screen.getByLabelText("제품 이름"), "예가체프 G1");
    await user.click(screen.getByRole("button", { name: "등록" }));

    await waitFor(() => expect(bodies["bean-products"]).toHaveLength(2));
    expect(order.filter((path) => path === "roasters")).toHaveLength(1);
    expect(
      bodies["bean-products"].map((body) => (body as { roasterId: number }).roasterId),
    ).toEqual([3, 3]);
  });

  it("AC-WEBBREW-08 · 실패한 필드의 오류가 그 입력칸에 붙는다", async () => {
    const user = userEvent.setup();
    recordCalls({ product: invalidProductName });
    renderDialog();

    await fillNewBean(user);
    await user.click(screen.getByRole("button", { name: "등록" }));

    const input = await screen.findByLabelText("제품 이름");
    const describedBy = await waitFor(() => {
      const id = input.getAttribute("aria-describedby");
      expect(id).not.toBeNull();
      return id as string;
    });
    expect(document.getElementById(describedBy)).toHaveTextContent(
      "100자 이하여야 합니다",
    );
  });

  it("AC-WEBBREW-26 · 모달을 취소하면 아무 요청도 나가지 않는다", async () => {
    const user = userEvent.setup();
    const { order } = recordCalls();
    const onCancel = vi.fn();
    renderWithQuery(
      <BeanBatchDialog onCreated={vi.fn()} onCancel={onCancel} />,
    );

    await user.type(screen.getByLabelText("로스터 이름"), "프릿츠");
    await user.click(screen.getByRole("button", { name: "취소" }));

    expect(order).toEqual([]);
    expect(onCancel).toHaveBeenCalled();
  });
});
