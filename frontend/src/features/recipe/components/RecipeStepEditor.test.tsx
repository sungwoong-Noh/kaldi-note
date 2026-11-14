import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { emptyFormState, toRequestBody } from "../formState";
import type { EditableStep, StepType } from "../stepSequence";
import { RecipeStepEditor } from "./RecipeStepEditor";

let uid = 0;

function step(over: Partial<EditableStep> = {}): EditableStep {
  uid += 1;
  return {
    uid: `t-${uid}`,
    stepType: "POUR",
    startAtSeconds: 0,
    durationSeconds: 10,
    waterG: null,
    pourTechnique: null,
    agitation: null,
    note: null,
    ...over,
  };
}

function at(
  startAtSeconds: number,
  durationSeconds = 10,
  over: Partial<EditableStep> = {},
) {
  return step({ startAtSeconds, durationSeconds, ...over });
}

/** 스텝 상태를 들고 있는 테스트용 부모. 실제 화면에서는 RecipeForm이 이 역할을 한다. */
let latest: EditableStep[] = [];

function Harness({
  initial = [],
  waterG = null,
  wide = false,
}: {
  initial?: EditableStep[];
  waterG?: number | null;
  wide?: boolean;
}) {
  const [steps, setSteps] = useState(initial);
  return (
    <RecipeStepEditor
      steps={steps}
      waterG={waterG}
      wide={wide}
      onChange={(next) => {
        latest = next;
        setSteps(next);
      }}
    />
  );
}

/** 마지막 `onChange`의 스텝으로 만든 요청 본문의 스텝 배열. */
const requestSteps = () =>
  toRequestBody({ ...emptyFormState(), steps: latest }).steps;

const startValue = (n: number) => screen.getByLabelText(`스텝 ${n} 시작`);
const typeValue = (n: number) => screen.getByLabelText(`스텝 ${n} 타입`);
const button = (name: string) => screen.getByRole("button", { name });

describe("RecipeStepEditor", () => {
  it("AC-WEBEDIT-11 · 첫 스텝은 BLOOM으로 0초에 시작한다", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(button("스텝 추가"));

    expect(typeValue(1)).toHaveValue("BLOOM");
    expect(startValue(1)).toHaveValue(0);
    expect(screen.getByLabelText("스텝 1 소요")).toHaveValue(10);
    expect(screen.getByLabelText("스텝 1 물량")).toHaveValue(null);
  });

  it("AC-WEBEDIT-12 · 두 번째 스텝은 POUR로 앞 스텝 종료 시각에 시작한다", async () => {
    const user = userEvent.setup();
    render(<Harness initial={[at(0, 10, { stepType: "BLOOM" })]} />);

    await user.click(button("스텝 추가"));

    expect(typeValue(2)).toHaveValue("POUR");
    expect(startValue(2)).toHaveValue(10);
  });

  it("AC-WEBEDIT-13 · 삽입할 자리가 남으면 뒤 스텝은 움직이지 않는다", async () => {
    const user = userEvent.setup();
    render(<Harness initial={[at(0), at(45)]} />);

    await user.click(button("스텝 1 아래에 추가"));

    expect(startValue(2)).toHaveValue(10);
    expect(screen.getByLabelText("스텝 2 소요")).toHaveValue(10);
    expect(startValue(3)).toHaveValue(45);
  });

  it("AC-WEBEDIT-14 · 자리가 5초 부족하면 뒤 스텝이 정확히 5초 밀린다", async () => {
    const user = userEvent.setup();
    render(<Harness initial={[at(0), at(15)]} />);

    await user.click(button("스텝 1 아래에 추가"));

    expect(startValue(2)).toHaveValue(10);
    expect(startValue(3)).toHaveValue(20);
  });

  it("AC-WEBEDIT-15 · 스텝을 지우면 뒤 스텝이 그 간격만큼 당겨진다", async () => {
    const user = userEvent.setup();
    render(<Harness initial={[at(0), at(45), at(90)]} />);

    await user.click(button("스텝 2 삭제"));

    expect(startValue(1)).toHaveValue(0);
    expect(startValue(2)).toHaveValue(45);
    expect(screen.queryByLabelText("스텝 3 시작")).not.toBeInTheDocument();
  });

  it("AC-WEBEDIT-16 · 마지막 스텝을 지우면 아무것도 움직이지 않는다", async () => {
    const user = userEvent.setup();
    render(<Harness initial={[at(0), at(45), at(90)]} />);

    await user.click(button("스텝 3 삭제"));

    expect(startValue(1)).toHaveValue(0);
    expect(startValue(2)).toHaveValue(45);
  });

  it("AC-WEBEDIT-17 · 위로 이동하면 소요는 따라가고 시작은 자리에 남는다", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initial={[
          at(0, 10, { stepType: "BLOOM" }),
          at(20, 10, { stepType: "WAIT" }),
          at(45, 20, { stepType: "POUR" }),
        ]}
      />,
    );

    await user.click(button("스텝 3 위로"));

    expect(typeValue(2)).toHaveValue("POUR");
    expect(startValue(2)).toHaveValue(20);
    expect(screen.getByLabelText("스텝 2 소요")).toHaveValue(20);
    expect(typeValue(3)).toHaveValue("WAIT");
    expect(startValue(3)).toHaveValue(45);
    expect(screen.getByLabelText("스텝 3 소요")).toHaveValue(10);
  });

  it("AC-WEBEDIT-18 · 이동 결과 겹치면 뒤 스텝을 겹친 만큼 민다", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initial={[at(0, 10), at(20, 10, { stepType: "WAIT" }), at(25, 20)]}
      />,
    );

    await user.click(button("스텝 3 위로"));

    expect(startValue(2)).toHaveValue(20);
    expect(startValue(3)).toHaveValue(40);
  });

  it("AC-WEBEDIT-19 · 첫 스텝의 위로와 마지막 스텝의 아래로는 눌리지 않는다", () => {
    render(<Harness initial={[at(0), at(20), at(40)]} />);

    expect(button("스텝 1 위로")).toBeDisabled();
    expect(button("스텝 3 아래로")).toBeDisabled();
    expect(button("스텝 2 위로")).toBeEnabled();
  });

  it("AC-WEBEDIT-20 · 스텝이 30개면 더 추가할 수 없다", () => {
    const thirty = Array.from({ length: 30 }, (_, i) => at(i * 20));
    render(<Harness initial={thirty} />);

    expect(button("스텝 추가")).toBeDisabled();
    expect(button("스텝 30 아래에 추가")).toBeDisabled();
  });

  it("AC-WEBEDIT-21 · 초 단위 입력 옆에 m:ss 변환이 보인다", () => {
    render(<Harness initial={[at(90)]} />);

    expect(screen.getByText("(1:30)")).toBeInTheDocument();
  });

  it("0초인 시간 칸에 40을 입력하면 앞자리 0 없이 '40'이 되고 (0:40)이 보인다", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(button("스텝 추가"));
    const startInput = startValue(1) as HTMLInputElement;
    expect(startInput.value).toBe("0");

    fireEvent.change(startInput, { target: { value: "040" } });

    expect(startInput.value).toBe("40");
    expect(startInput).toHaveValue(40);
    expect(screen.getByText("(0:40)")).toBeInTheDocument();
  });

  it("숫자 칸에 포커스하면 기존 값을 전체 선택하고 inputMode가 지정돼 있다", async () => {
    const user = userEvent.setup();
    render(<Harness initial={[at(0, 10, { stepType: "POUR", waterG: 50 })]} />);

    const startInput = startValue(1) as HTMLInputElement;
    const durationInput = screen.getByLabelText(
      "스텝 1 소요",
    ) as HTMLInputElement;
    const waterInput = screen.getByLabelText("스텝 1 물량") as HTMLInputElement;

    expect(startInput).toHaveAttribute("inputmode", "numeric");
    expect(durationInput).toHaveAttribute("inputmode", "numeric");
    expect(waterInput).toHaveAttribute("inputmode", "decimal");

    let selected = false;
    const origSelect = startInput.select.bind(startInput);
    startInput.select = () => {
      selected = true;
      origSelect();
    };

    await user.click(startInput);
    expect(selected).toBe(true);
  });
});

describe("스텝 타입 변경", () => {
  it("붓지 않는 스텝으로 바꾸면 물량 입력이 사라진다", async () => {
    const user = userEvent.setup();
    render(<Harness initial={[at(0, 10, { stepType: "POUR", waterG: 60 })]} />);

    await user.selectOptions(typeValue(1), "WAIT" satisfies StepType);

    expect(screen.queryByLabelText("스텝 1 물량")).not.toBeInTheDocument();
  });
});

describe("웹 스텝 표 (≥1100)", () => {
  const four = () => [
    at(0, 45, {
      stepType: "BLOOM",
      waterG: 45,
      pourTechnique: "CENTER",
      agitation: "SWIRL",
    }),
    at(45, 30, {
      stepType: "POUR",
      waterG: 105,
      pourTechnique: "SPIRAL",
      agitation: "NONE",
      note: "물줄기를 가늘게",
    }),
    at(90, 30, { stepType: "POUR", waterG: 100, pourTechnique: "SPIRAL" }),
    at(120, 90, { stepType: "DRAWDOWN", note: "다 빠질 때까지" }),
  ];

  it("AC-RECIPEEDIT-40 · 헤더 순서가 # · 종류 · 시작 · 지속 · 물 · 방식·메모다", () => {
    render(<Harness initial={four()} wide />);

    const headers = screen
      .getAllByRole("columnheader")
      .map((h) => h.textContent)
      .filter(Boolean);
    expect(headers).toEqual(["#", "종류", "시작", "지속", "물", "방식 · 메모"]);
  });

  it("AC-RECIPEEDIT-40 · 행은 m:ss 시간·물·방식 요약을 보여준다", () => {
    render(<Harness initial={four()} wide />);

    const row = screen.getByRole("row", { name: "스텝 2" });
    expect(row).toHaveTextContent("붓기");
    expect(row).toHaveTextContent("0:45");
    expect(row).toHaveTextContent("0:30");
    expect(row).toHaveTextContent("105 g");
    expect(row).toHaveTextContent("나선 · 물줄기를 가늘게");
    expect(screen.getByRole("row", { name: "스텝 1" })).toHaveTextContent(
      "중심 · 돌리기",
    );
  });

  it("AC-RECIPEEDIT-40 · 2번 행을 누르면 「스텝 2 편집」 패널이 표 아래 열린다", async () => {
    const user = userEvent.setup();
    render(<Harness initial={four()} wide />);
    expect(screen.queryByRole("region", { name: "스텝 2 편집" })).toBeNull();

    await user.click(button("스텝 2 열기"));

    const panel = screen.getByRole("region", { name: "스텝 2 편집" });
    expect(panel).toHaveTextContent("스텝 2 편집");
    const table = screen.getByRole("table");
    expect(
      table.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(button("스텝 2 열기")).toHaveAttribute("aria-expanded", "true");
  });

  it("AC-RECIPEEDIT-40 · 열린 행을 다시 누르면 패널이 닫힌다", async () => {
    const user = userEvent.setup();
    render(<Harness initial={four()} wide />);

    await user.click(button("스텝 2 열기"));
    await user.click(button("스텝 2 열기"));

    expect(screen.queryByRole("region", { name: "스텝 2 편집" })).toBeNull();
  });

  it("AC-RECIPEEDIT-40 · 패널에서 고친 값이 바로 행에 반영된다", async () => {
    const user = userEvent.setup();
    render(<Harness initial={four()} wide />);

    await user.click(button("스텝 2 열기"));
    const water = screen.getByLabelText("스텝 2 물량");
    await user.clear(water);
    await user.type(water, "110");

    expect(screen.getByRole("row", { name: "스텝 2" })).toHaveTextContent(
      "110 g",
    );
  });

  it("AC-RECIPEEDIT-47 · 시작·지속은 m:ss로 입력한다", async () => {
    const user = userEvent.setup();
    render(<Harness initial={[at(0, 10, { stepType: "BLOOM" })]} wide />);

    await user.click(button("스텝 1 열기"));
    const start = screen.getByLabelText("스텝 1 시작");
    const duration = screen.getByLabelText("스텝 1 지속");
    expect(start).toHaveValue("0:00");
    expect(duration).toHaveValue("0:10");

    await user.clear(start);
    await user.type(start, "1:30");
    await user.clear(duration);
    await user.type(duration, "0:45");

    expect(requestSteps()[0]).toMatchObject({
      startAtSeconds: 90,
      durationSeconds: 45,
    });
    expect(start).toHaveValue("1:30");
  });

  it("AC-RECIPEEDIT-47 · 형식이 틀린 동안에는 이전 값이 남는다", async () => {
    const user = userEvent.setup();
    const initial = [at(45, 10)];
    latest = initial;
    render(<Harness initial={initial} wide />);

    await user.click(button("스텝 1 열기"));
    const start = screen.getByLabelText("스텝 1 시작");
    await user.clear(start);
    await user.type(start, "1:3");

    expect(start).toHaveValue("1:3");
    expect(requestSteps()[0].startAtSeconds).toBe(45);
  });

  it("AC-RECIPEEDIT-49 · 배출 스텝은 물 칸이 —이고 물 입력이 없고 본문에 waterG가 없다", async () => {
    const user = userEvent.setup();
    const drawdown = [at(0, 90, { stepType: "DRAWDOWN", waterG: 30 })];
    latest = drawdown;
    render(<Harness initial={drawdown} wide />);

    const row = screen.getByRole("row", { name: "스텝 1" });
    expect(within(row).getByText("—")).toBeInTheDocument();

    await user.click(button("스텝 1 열기"));
    expect(screen.queryByLabelText("스텝 1 물량")).toBeNull();
    expect(requestSteps()[0]).not.toHaveProperty("waterG");
  });

  it("AC-WEBEDIT-31 · 서버 스텝 오류는 그 행의 설명으로 붙는다", () => {
    render(
      <RecipeStepEditor
        steps={four()}
        waterG={250}
        wide
        errors={{ 2: "붓는 스텝은 물량이 0보다 커야 합니다" }}
        onChange={() => {}}
      />,
    );

    expect(
      screen.getByRole("row", { name: "스텝 3" }),
    ).toHaveAccessibleDescription("붓는 스텝은 물량이 0보다 커야 합니다");
  });

  it("행의 위·아래·삭제가 표에서도 동작한다", async () => {
    const user = userEvent.setup();
    render(<Harness initial={[at(0), at(45), at(90)]} wide />);

    await user.click(button("스텝 2 삭제"));

    expect(latest.map((s) => s.startAtSeconds)).toEqual([0, 45]);
    expect(button("스텝 1 위로")).toBeDisabled();
  });
});

/**
 * 부으면서 돌리기는 「돌리기」 스텝이 아니라 「붓기」 스텝 + 교반 「돌리기」다(목업 03 스텝 시트 「방식 · 교반」).
 * 「돌리기」·「젓기」 스텝은 물 없이 하는 동작으로 남는다 — 서버가 붓지 않는 스텝의 물량을 거부한다.
 */
describe("붓는 방식 · 교반", () => {
  it("AC-RECIPEEDIT-45 · (모바일) 붓기 스텝에서 방식 「나선」, 교반 「돌리기」를 고르면 요청에 실린다", async () => {
    const user = userEvent.setup();
    render(
      <Harness initial={[at(0, 30, { stepType: "POUR", waterG: 100 })]} />,
    );

    await user.selectOptions(
      screen.getByLabelText("스텝 1 붓는 방식"),
      "SPIRAL",
    );
    await user.selectOptions(screen.getByLabelText("스텝 1 교반"), "SWIRL");

    expect(requestSteps()[0]).toMatchObject({
      stepType: "POUR",
      waterG: 100,
      pourTechnique: "SPIRAL",
      agitation: "SWIRL",
    });
  });

  it("AC-RECIPEEDIT-45 · (웹 패널) 붓기 스텝에서 방식·교반을 고르면 요청에 실린다", async () => {
    const user = userEvent.setup();
    render(
      <Harness wide initial={[at(0, 30, { stepType: "POUR", waterG: 100 })]} />,
    );
    await user.click(screen.getByRole("button", { name: "스텝 1 열기" }));
    const panel = screen.getByRole("region", { name: "스텝 1 편집" });

    await user.selectOptions(
      within(panel).getByLabelText("스텝 1 붓는 방식"),
      "SPIRAL",
    );
    await user.selectOptions(
      within(panel).getByLabelText("스텝 1 교반"),
      "SWIRL",
    );

    expect(requestSteps()[0]).toMatchObject({
      pourTechnique: "SPIRAL",
      agitation: "SWIRL",
    });
  });

  it("AC-RECIPEEDIT-45 · 붓지 않는 스텝에는 방식·교반 칸이 없고 요청에도 싣지 않는다", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initial={[
          at(0, 30, {
            stepType: "POUR",
            waterG: 100,
            pourTechnique: "SPIRAL",
            agitation: "SWIRL",
          }),
        ]}
      />,
    );

    await user.selectOptions(typeValue(1), "SWIRL");

    expect(screen.queryByLabelText("스텝 1 붓는 방식")).toBeNull();
    expect(screen.queryByLabelText("스텝 1 교반")).toBeNull();
    expect(requestSteps()[0]).not.toHaveProperty("pourTechnique");
    expect(requestSteps()[0]).not.toHaveProperty("agitation");
  });
});
