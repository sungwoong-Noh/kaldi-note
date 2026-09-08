import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { kasuyaSummary } from "@/test/fixtures";
import { RecipeCard } from "./RecipeCard";

describe("레시피 카드", () => {
  it("AC-VISUAL-08 · 대표 수치는 도즈와 물이고 18px 단계를 받는다", () => {
    render(
      <ul>
        <RecipeCard recipe={kasuyaSummary} />
      </ul>,
    );

    // 20.0g과 300.0g이 한 줄에 묶여 있고, 그 줄이 대표 수치 단계를 받는다.
    const line = screen.getByText("20.0g").parentElement;

    expect(line).toHaveClass("text-lg", "font-semibold");
    expect(line).toHaveTextContent("300.0g");
  });
});
