import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { kasuyaSummary } from "@/test/fixtures";
import { RecipeCard } from "./RecipeCard";

describe("레시피 카드", () => {
  it("AC-VISUAL-08 · 대표 수치는 비율이고 36px 단계를 받는다", () => {
    render(
      <ul>
        <RecipeCard recipe={kasuyaSummary} />
      </ul>,
    );

    // 갱신(2026-09-15): structure 스펙이 두 화면의 대표 수치를 1:비율로 통일했다.
    // 절대량(20.0g → 300.0g)은 바로 아래 메타줄로 내려갔다.
    const line = screen.getByText("1:15.0").parentElement;

    expect(line).toHaveClass("text-4xl", "font-semibold");
    expect(line).toHaveAttribute("data-lead");
  });

  it("AC-CONSIST-06 · 라벨이 폼 어휘를 쓴다", () => {
    const { container } = render(
      <ul>
        <RecipeCard recipe={kasuyaSummary} />
      </ul>,
    );

    const labels = [...container.querySelectorAll("dt")].map(
      (dt) => dt.textContent,
    );

    expect(labels).toEqual(["비율", "원두량", "물량", "물 온도", "총 시간"]);
  });
});
