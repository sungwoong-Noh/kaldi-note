import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession, setAccessToken } from "@/lib/session";
import { c40ToE80Conversion, comandanteC40, holzklotzE80 } from "@/test/fixtures";
import { server } from "@/test/msw-server";
import { renderWithQuery } from "@/test/render";
import GrindConverterPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/gear/grind-converter",
}));

const BASE = "http://localhost:8080/api/v1";
const CONVERT_URL = `${BASE}/gear/grind-conversions`;

beforeEach(() => {
  clearSession();
  setAccessToken("a.b.c");
  server.use(
    http.get(`${BASE}/gear/grinders`, () =>
      HttpResponse.json([comandanteC40, holzklotzE80]),
    ),
    http.post(CONVERT_URL, () => HttpResponse.json(c40ToE80Conversion)),
  );
});

/** C40 22 → E80을 고르고 환산을 누른다. */
async function convert(
  user: ReturnType<typeof userEvent.setup>,
  setting = "22",
) {
  await user.selectOptions(await screen.findByLabelText("원본 그라인더"), "1");
  await user.type(screen.getByLabelText("설정값"), setting);
  await user.selectOptions(screen.getByLabelText("대상 그라인더"), "11");
  await user.click(screen.getByRole("button", { name: "환산" }));
}

describe("GrindConverterPage", () => {
  it("AC-WEBSHELL-23 · 마스터 그라인더 전체에서 고른다", async () => {
    renderWithQuery(<GrindConverterPage />);

    const source = await screen.findByLabelText("원본 그라인더");
    const target = screen.getByLabelText("대상 그라인더");
    for (const select of [source, target]) {
      expect(
        within(select).getByRole("option", { name: "Comandante C40 MK4" }),
      ).toBeInTheDocument();
      expect(
        within(select).getByRole("option", { name: "Holzklotz E80" }),
      ).toBeInTheDocument();
    }
  });

  it("AC-WEBSHELL-24 · 환산 결과가 보인다", async () => {
    const user = userEvent.setup();

    renderWithQuery(<GrindConverterPage />);
    await convert(user);

    expect(await screen.findByText("660 µm")).toBeInTheDocument();
    expect(screen.getByText("29.3")).toBeInTheDocument();
    expect(screen.getByText(c40ToE80Conversion.warning)).toBeInTheDocument();
  });

  it("AC-WEBSHELL-25 · 요청 본문이 고른 값 그대로다", async () => {
    const user = userEvent.setup();
    let body: unknown = null;
    server.use(
      http.post(CONVERT_URL, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(c40ToE80Conversion);
      }),
    );

    renderWithQuery(<GrindConverterPage />);
    await convert(user);

    await waitFor(() =>
      expect(body).toEqual({
        sourceGrinderModelId: 1,
        sourceSetting: 22,
        targetGrinderModelId: 11,
      }),
    );
  });

  it("AC-WEBSHELL-26 · E80 최소 단계도 요청은 나간다", async () => {
    const user = userEvent.setup();
    let body: unknown = null;
    server.use(
      http.post(CONVERT_URL, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...c40ToE80Conversion, sourceSetting: 0, micron: 0 });
      }),
    );

    renderWithQuery(<GrindConverterPage />);
    await user.selectOptions(await screen.findByLabelText("원본 그라인더"), "11");
    await user.type(screen.getByLabelText("설정값"), "0");
    await user.selectOptions(screen.getByLabelText("대상 그라인더"), "1");
    await user.click(screen.getByRole("button", { name: "환산" }));

    await waitFor(() =>
      expect(body).toEqual({
        sourceGrinderModelId: 11,
        sourceSetting: 0,
        targetGrinderModelId: 1,
      }),
    );
  });

  it("AC-WEBSHELL-28 · 환산 불가 그라인더는 서버 문구를 보여준다", async () => {
    const user = userEvent.setup();
    server.use(
      http.post(CONVERT_URL, () =>
        HttpResponse.json(
          {
            code: "GRIND_NOT_CONVERTIBLE",
            message: "대상 그라인더의 클릭당 마이크론 정보가 없어 환산할 수 없습니다.",
            fieldErrors: [],
          },
          { status: 422 },
        ),
      ),
    );

    renderWithQuery(<GrindConverterPage />);
    await convert(user);

    expect(
      await screen.findByText(
        "대상 그라인더의 클릭당 마이크론 정보가 없어 환산할 수 없습니다.",
      ),
    ).toBeInTheDocument();
  });

  it("AC-WEBSHELL-29 · 범위 밖 설정값은 서버 문구를 보여준다", async () => {
    const user = userEvent.setup();
    server.use(
      http.post(CONVERT_URL, () =>
        HttpResponse.json(
          {
            code: "GRIND_SETTING_OUT_OF_RANGE",
            message: "설정값 90는 이 그라인더의 상한 50.00를 넘습니다.",
            fieldErrors: [],
          },
          { status: 400 },
        ),
      ),
    );

    renderWithQuery(<GrindConverterPage />);
    await convert(user, "90");

    expect(
      await screen.findByText("설정값 90는 이 그라인더의 상한 50.00를 넘습니다."),
    ).toBeInTheDocument();
  });
});
