import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
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
function Harness({
  initial = [],
  waterG = null,
}: {
  initial?: EditableStep[];
  waterG?: number | null;
}) {
  const [steps, setSteps] = useState(initial);
  return <RecipeStepEditor steps={steps} waterG={waterG} onChange={setSteps} />;
}

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

  it("AC-WEBEDIT-22 · 합계가 모자라면 부족량을 보여준다", () => {
    render(
      <Harness
        initial={[
          at(0, 10, { stepType: "BLOOM", waterG: 60 }),
          at(45, 10, { waterG: 180 }),
        ]}
        waterG={300}
      />,
    );

    expect(screen.getByText("240.0g / 300.0g")).toBeInTheDocument();
    expect(screen.getByText("60.0g 부족합니다")).toBeInTheDocument();
  });

  it("AC-WEBEDIT-23 · 합계가 맞으면 부족·초과 문구가 없다", () => {
    render(
      <Harness
        initial={[
          at(0, 10, { stepType: "BLOOM", waterG: 60 }),
          at(45, 10, { waterG: 240 }),
        ]}
        waterG={300}
      />,
    );

    expect(screen.getByText("300.0g / 300.0g")).toBeInTheDocument();
    expect(screen.queryByText(/부족합니다/)).not.toBeInTheDocument();
    expect(screen.queryByText(/초과합니다/)).not.toBeInTheDocument();
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
