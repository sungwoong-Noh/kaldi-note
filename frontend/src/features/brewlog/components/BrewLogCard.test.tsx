import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { brewLogPage } from "@/test/fixtures";
import { brewLogSummarySchema } from "../schema";
import { BrewLogCard } from "./BrewLogCard";

/** 실제 응답을 스키마로 통과시켜 쓴다. 지어내지 않는다. */
const withRatio = brewLogSummarySchema.parse(brewLogPage.content[0]);

/**
 * 실제 응답에서 `brewRatio`만 덜어낸 것.
 *
 * <p><b>지금 백엔드로는 도달할 수 없는 상태다</b> — `actual_dose_g`·`actual_water_g`가 둘 다
 * `nullable = false`이고 `ExtractionAnalyzer`가 분기 없이 나눈다. 그래도 프론트 스키마가
 * `optional`로 선언하는 한 분기가 존재하므로, 그 안이 비지 않는지 검사한다.
 */
const withoutRatio = brewLogSummarySchema.parse(
  Object.fromEntries(
    Object.entries(brewLogPage.content[0]).filter(
      ([key]) => key !== "brewRatio",
    ),
  ),
);

function renderCard(log: typeof withRatio) {
  return render(
    <ul>
      <BrewLogCard log={log} recipeLabel="Tetsu Kasuya 4:6 Method" />
    </ul>,
  );
}

describe("브루잉 로그 카드", () => {
  it("AC-VISUAL-09 · 비율이 있으면 그것이 대표 수치다", () => {
    renderCard(withRatio);

    expect(screen.getByText("1:15.0").parentElement).toHaveClass(
      "text-lg",
      "font-semibold",
    );
  });

  it("AC-VISUAL-10 · 비율이 없으면 물 온도가 승격된다", () => {
    renderCard(withoutRatio);

    expect(screen.getByText("92°C").parentElement).toHaveClass(
      "text-lg",
      "font-semibold",
    );
  });

  it("AC-VISUAL-11 · 승격된 값은 보조줄에 다시 나오지 않는다", () => {
    renderCard(withoutRatio);

    expect(screen.getAllByText("92°C")).toHaveLength(1);
  });

  it("AC-VISUAL-12 · 대표 수치는 두 경우 모두 정확히 1개다", () => {
    for (const log of [withRatio, withoutRatio]) {
      const { container, unmount } = renderCard(log);

      expect(container.querySelectorAll(".text-lg.font-semibold")).toHaveLength(
        1,
      );

      unmount();
    }
  });
});
