import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { comandanteC40 } from "@/test/fixtures";
import { server } from "@/test/msw-server";
import { renderWithQuery } from "@/test/render";
import { emptyFormState, type RecipeFormState } from "../formState";
import type { EditableStep } from "../stepSequence";
import { RecipeForm } from "./RecipeForm";

const API = "http://localhost:8080/api/v1";

function step(
  stepType: EditableStep["stepType"],
  startAtSeconds: number,
  durationSeconds: number,
  waterG: number | null,
): EditableStep {
  return {
    uid: `${stepType}-${startAtSeconds}`,
    stepType,
    startAtSeconds,
    durationSeconds,
    waterG,
    pourTechnique: null,
    agitation: null,
    note: null,
  };
}

function renderForm(
  initial: Partial<RecipeFormState> = {},
  extra: { micronEstimated?: number } = {},
) {
  const onSubmit = vi.fn();
  server.use(
    http.get(`${API}/gear/grinders`, () => HttpResponse.json([comandanteC40])),
    http.get(`${API}/gear/brewers`, () => HttpResponse.json([])),
    http.get(`${API}/gear/filters`, () => HttpResponse.json([])),
  );
  renderWithQuery(
    <RecipeForm
      mode="create"
      initial={{ ...emptyFormState(), ...initial }}
      submitting={false}
      error={null}
      onSubmit={onSubmit}
      onCancel={() => {}}
      {...extra}
    />,
  );
  return { onSubmit, user: userEvent.setup() };
}

const hero = () => screen.getByTestId("recipe-ratio");

describe("RecipeForm", () => {
  it("AC-RECIPEEDIT-01 · 원두·물을 넣으면 히어로 비율이 바로 바뀐다", async () => {
    const { user } = renderForm();
    expect(hero()).toHaveTextContent("—");

    await user.type(screen.getByLabelText("원두량"), "16.0");
    await user.type(screen.getByLabelText("물량"), "250.0");
    expect(hero()).toHaveTextContent("1:15.6");

    await user.clear(screen.getByLabelText("원두량"));
    expect(hero()).toHaveTextContent("—");
  });

  it("AC-RECIPEEDIT-04 · 분쇄도 단위 「눈금」이 요청에 실린다", async () => {
    const { user, onSubmit } = renderForm({
      title: "a",
      doseG: 16,
      waterG: 250,
    });
    await screen.findByRole("option", { name: "Comandante C40 MK4" });
    await user.selectOptions(screen.getByLabelText("그라인더"), "1");
    await user.type(screen.getByLabelText("분쇄도 값"), "24");
    await user.click(screen.getByRole("radio", { name: "눈금" }));
    await user.click(screen.getByRole("button", { name: "레시피 저장" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        grinderModelId: 1,
        grindSettingUnit: "NUMBER",
        grindSettingValue: 24,
      }),
    );
  });

  it("AC-RECIPEEDIT-05 · 추정 입도는 저장된 값만 보이고 환산 API를 부르지 않는다", async () => {
    const grindCalls: string[] = [];
    server.events.on("request:start", ({ request }) => {
      if (request.url.includes("/gear/grind")) grindCalls.push(request.url);
    });

    const { user } = renderForm({
      grinderModelId: 1,
      grindSettingUnit: "CLICK",
      grindSettingValue: 22,
    });
    expect(
      screen.getByText("저장하면 추정 입도(µm)가 계산됩니다."),
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText("분쇄도 값"), "4");
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(grindCalls.filter((u) => u.includes("conversion"))).toEqual([]);
    server.events.removeAllListeners();
  });

  it("AC-RECIPEEDIT-05 · 저장된 추정 입도가 있으면 「약 660 µm · 추정치」", () => {
    renderForm({}, { micronEstimated: 660 });
    expect(screen.getByText("약 660 µm · 추정치")).toBeInTheDocument();
  });

  it("AC-RECIPEEDIT-06 · 물 합계가 다르면 Observation과 합계가 경고한다", () => {
    renderForm({
      waterG: 250,
      steps: [step("BLOOM", 0, 45, 45), step("POUR", 45, 30, 185)],
    });

    expect(
      screen.getByText(
        "스텝 물 합계가 총 물량보다 20 g 적습니다. 저장하려면 합계를 맞춰 주세요.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId("step-water-total")).toHaveClass("text-danger");
  });

  it("AC-RECIPEEDIT-07 · 미리보기 타임라인이 스텝마다 막대와 누적 물량을 그린다", () => {
    renderForm({
      waterG: 250,
      totalTimeSeconds: 210,
      steps: [
        step("BLOOM", 0, 45, 45),
        step("POUR", 45, 30, 105),
        step("POUR", 90, 30, 100),
        step("DRAWDOWN", 120, 90, null),
      ],
    });

    const timeline = screen.getByRole("list", { name: "타임라인" });
    const rows = within(timeline).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      "뜸45",
      "붓기150",
      "붓기250",
      "배출—",
    ]);
    expect(screen.getByTestId("timeline-axis")).toHaveTextContent(
      "0:001:453:30",
    );
  });

  it("AC-RECIPEEDIT-20 · 스텝이 없으면 안내 두 줄, Observation 없음", () => {
    renderForm({ waterG: 250 });

    expect(screen.getByText("스텝이 없습니다.")).toBeInTheDocument();
    expect(
      screen.getByText(
        "스텝 없이도 저장할 수 있습니다. 타이머는 총 시간만 셉니다.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/스텝 물 합계가/)).not.toBeInTheDocument();
  });

  it("AC-RECIPEEDIT-21 · 제목 100자 카운터, 설명은 2000자에서 멈추고 카운터가 accent", () => {
    renderForm();

    fireEvent.change(screen.getByLabelText("제목"), {
      target: { value: "가".repeat(100) },
    });
    expect(screen.getByTestId("title-counter")).toHaveTextContent("100 / 100");

    const description = screen.getByLabelText("설명");
    expect(description).toHaveAttribute("maxLength", "2000");
    fireEvent.change(description, { target: { value: "가".repeat(2000) } });
    expect(screen.getByTestId("description-counter")).toHaveClass(
      "text-accent",
    );
  });
});
