import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecipeStepList } from "./RecipeStepList";
import { hoffmannSteps } from "@/test/fixtures";

describe("RecipeStepList", () => {
  it("AC-WEB-15 · 스텝이 순서대로, 시작 시각이 m:ss로 표시된다", () => {
    render(<RecipeStepList steps={hoffmannSteps} />);

    const times = screen.getAllByTestId("step-start");
    expect(times.map((el) => el.textContent)).toEqual([
      "0:00",
      "0:15",
      "0:45",
      "1:15",
      "1:45",
      "1:50",
      "1:55",
    ]);
  });

  it("AC-WEB-16 · 붓는 스텝의 누적 물량이 표시된다", () => {
    render(<RecipeStepList steps={hoffmannSteps} />);

    expect(screen.getByText("누적 60g")).toBeInTheDocument();
    expect(screen.getByText("누적 300g")).toBeInTheDocument();
    expect(screen.getByText("누적 500g")).toBeInTheDocument();
  });

  it("AC-WEB-17 · 붓지 않는 스텝에는 물량이 표시되지 않는다", () => {
    const waitStep = hoffmannSteps.filter((step) => step.stepType === "WAIT");

    render(<RecipeStepList steps={waitStep} />);

    expect(screen.queryByText(/\d+g/)).not.toBeInTheDocument();
    expect(screen.queryByText(/누적/)).not.toBeInTheDocument();
  });

  it("스텝이 없으면 안내를 보여준다", () => {
    render(<RecipeStepList steps={[]} />);

    expect(screen.getByText("등록된 스텝이 없습니다")).toBeInTheDocument();
  });

  it("stepOrder가 뒤섞여 들어와도 순서대로 그린다", () => {
    const shuffled = [hoffmannSteps[2], hoffmannSteps[0], hoffmannSteps[1]];

    render(<RecipeStepList steps={shuffled} />);

    expect(
      screen.getAllByTestId("step-start").map((el) => el.textContent),
    ).toEqual(["0:00", "0:15", "0:45"]);
  });
});
