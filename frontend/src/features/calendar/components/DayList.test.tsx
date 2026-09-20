import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { brewLogPage } from "@/test/fixtures";
import { renderWithQuery } from "@/test/render";
import { brewLogSummarySchema } from "@/features/brewlog/schema";
import { DayList } from "./DayList";

/** 실제 응답을 스키마로 통과시켜 쓴다. 지어내지 않는다. */
const logA = brewLogSummarySchema.parse(brewLogPage.content[0]);

describe("DayList", () => {
  it("AC-HOMECAL-42 · 목록 헤더가 날짜·요일·건수를 담는다", () => {
    renderWithQuery(
      <DayList
        date="2026-09-19"
        logs={[
          { ...logA, id: 1, beanBatchId: undefined },
          { ...logA, id: 2, beanBatchId: undefined },
        ]}
        variant="mobile"
      />,
    );

    expect(screen.getByText("09.19 SAT · 2 BREWS")).toBeInTheDocument();
  });

  it("AC-HOMECAL-43 · 수율이 없으면 비율을 보여준다", () => {
    const withYield = {
      ...logA,
      id: 1,
      beanBatchId: undefined,
      extractionYieldPercent: 20.4,
    };
    const withoutYield = {
      ...logA,
      id: 2,
      beanBatchId: undefined,
      extractionYieldPercent: undefined,
      brewRatio: 15.6,
    };
    renderWithQuery(
      <DayList date="2026-09-19" logs={[withYield, withoutYield]} variant="mobile" />,
    );

    expect(screen.getByText("20.4 %")).toBeInTheDocument();
    expect(screen.getByText("1:15.6")).toBeInTheDocument();
  });

  it("AC-HOMECAL-76 · 원두를 연결하지 않은 기록은 roast dot이 없다", () => {
    renderWithQuery(
      <DayList
        date="2026-09-19"
        logs={[{ ...logA, id: 1, beanBatchId: undefined }]}
        variant="mobile"
      />,
    );

    expect(document.querySelector("[data-roast-dot]")).toBeNull();
  });

  it("남의 달력은 닉네임이 요일과 건수 사이에 끼운다", () => {
    renderWithQuery(
      <DayList
        date="2026-09-19"
        logs={[{ ...logA, id: 1, beanBatchId: undefined }]}
        ownerNickname="지연"
        variant="mobile"
      />,
    );

    expect(screen.getByText("09.19 SAT · 지연 · 1 BREW")).toBeInTheDocument();
  });
});
