import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { RecipeSearchState } from "../useRecipeSearchState";
import { SegmentTabs } from "./SegmentTabs";

const baseState: RecipeSearchState = {
  scope: "DRAWER",
  q: "",
  roast: [],
  dripper: [],
};

describe("SegmentTabs", () => {
  it("공용 Segmented 스타일로 붙은 트랙과 tab 역할을 렌더링한다", () => {
    const setState = vi.fn();
    const { container } = render(
      <SegmentTabs state={baseState} setState={setState} />,
    );

    const tablist = screen.getByRole("tablist");
    expect(tablist.className).toContain("bg-sunken");
    expect(tablist.className).not.toContain("gap-2");

    const drawerTab = screen.getByRole("tab", {
      name: "내 서랍",
      selected: true,
    });
    const publicTab = screen.getByRole("tab", {
      name: "둘러보기",
      selected: false,
    });
    expect(drawerTab).toBeVisible();
    expect(publicTab).toBeVisible();

    const indicator = container.querySelector(
      "[data-segment-indicator]",
    ) as HTMLElement;
    expect(indicator).not.toBeNull();
    expect(indicator.className).toContain("bg-paper");
    expect(indicator.style.transform).toContain("calc(0 *");

    fireEvent.click(publicTab);
    expect(setState).toHaveBeenCalledWith({ scope: "PUBLIC" });
  });
});
