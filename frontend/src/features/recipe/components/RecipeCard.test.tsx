import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { kasuyaSummary } from "@/test/fixtures";
import { RecipeCard } from "./RecipeCard";

describe("레시피 카드", () => {
  it("AC-RECIPESBREWS-69 · 카드 대표 수치가 원두량이다", () => {
    render(
      <ul>
        <RecipeCard recipe={{ ...kasuyaSummary, doseG: 15.0 }} scope="PUBLIC" />
      </ul>,
    );

    const line = screen.getByText("15.0g").parentElement;

    expect(line).toHaveClass("text-metric-hero", "font-semibold");
    expect(line).toHaveAttribute("data-lead");
  });

  it("AC-CONSIST-06 · 라벨이 폼 어휘를 쓴다", () => {
    const { container } = render(
      <ul>
        <RecipeCard recipe={kasuyaSummary} scope="PUBLIC" />
      </ul>,
    );

    const labels = [...container.querySelectorAll("dt")].map(
      (dt) => dt.textContent,
    );

    expect(labels).toEqual(["원두량", "물량", "비율", "물 온도", "총 시간"]);
  });

  it("AC-RECIPESBREWS-70 · 둘러보기 카드에 작성자 줄이 있다", () => {
    render(
      <ul>
        <RecipeCard
          recipe={{
            ...kasuyaSummary,
            authorDisplayName: "지연",
            savedCount: 12,
          }}
          scope="PUBLIC"
        />
      </ul>,
    );

    expect(screen.getByText("지연 · 담김 12")).toHaveAttribute(
      "data-card-author",
    );
  });

  it("AC-RECIPESBREWS-71 · 내 서랍의 담아온 카드에 출처 배지가 있다", () => {
    const { container } = render(
      <ul>
        <RecipeCard
          recipe={{
            ...kasuyaSummary,
            parentRecipeId: 9,
            sourceAuthorName: "지연",
          }}
          scope="DRAWER"
        />
      </ul>,
    );

    expect(screen.getByText("지연 님 레시피에서")).toHaveAttribute(
      "data-card-source",
    );
    expect(container.querySelector("[data-card-badge]")).toBeNull();
  });

  it("AC-RECIPESBREWS-72 · 내 서랍의 내가 만든 카드에 잔 수 배지가 있다", () => {
    const { container } = render(
      <ul>
        <RecipeCard
          recipe={{ ...kasuyaSummary, brewCount: 3 }}
          scope="DRAWER"
        />
      </ul>,
    );

    expect(screen.getByText("내가 만든")).toHaveAttribute("data-card-badge");
    expect(screen.getByText("3잔 기록")).toHaveAttribute(
      "data-card-brew-count",
    );
    expect(container.querySelector("[data-card-source]")).toBeNull();
  });
});
