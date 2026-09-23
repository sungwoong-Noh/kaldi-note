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

  it("AC-HOMECAL-108 · 별점이 있으면 시각·별점 캡션이 text-caption으로 렌더된다", () => {
    // logA.brewedAt = 2026-08-31T09:00:00Z(UTC) → KST 18:00, rating: 4.0
    renderWithQuery(
      <DayList
        date="2026-09-19"
        logs={[{ ...logA, id: 1, beanBatchId: undefined }]}
        variant="mobile"
      />,
    );

    const caption = screen.getByText("18:00 · ★ 4");
    expect(caption).toHaveClass("text-caption");
  });

  it("AC-HOMECAL-109 · 별점이 없으면 캡션에 시각만 나온다", () => {
    renderWithQuery(
      <DayList
        date="2026-09-19"
        logs={[{ ...logA, id: 1, beanBatchId: undefined, rating: undefined }]}
        variant="mobile"
      />,
    );

    expect(screen.getByText("18:00")).toBeInTheDocument();
    expect(screen.queryByText(/★/)).not.toBeInTheDocument();
  });

  it("AC-HOMECAL-110 · 남의 달력 하단 관계 문구에 상대 닉네임이 보간된다", () => {
    renderWithQuery(
      <DayList
        date="2026-09-19"
        logs={[{ ...logA, id: 1, beanBatchId: undefined }]}
        ownerNickname="지연"
        variant="mobile"
      />,
    );

    expect(
      screen.getByText("맞팔로우 상태여서 지연 님의 기록이 보입니다."),
    ).toBeInTheDocument();
  });

  it("AC-HOMECAL-123 · 웹 우측 컬럼에 요일 아이브로우가 렌더된다", () => {
    // 2026-09-19는 토요일이다.
    renderWithQuery(
      <DayList
        date="2026-09-19"
        logs={[{ ...logA, id: 1, beanBatchId: undefined }]}
        variant="web"
      />,
    );

    const eyebrow = screen.getByText("SATURDAY");
    expect(eyebrow).toHaveAttribute("data-eyebrow");
  });

  it("AC-HOMECAL-123 · 남의 달력이면 요일 뒤에 닉네임이 붙는다", () => {
    renderWithQuery(
      <DayList
        date="2026-09-19"
        logs={[{ ...logA, id: 1, beanBatchId: undefined }]}
        ownerNickname="지연"
        variant="web"
      />,
    );

    expect(screen.getByText("SATURDAY · 지연")).toBeInTheDocument();
  });

  it("AC-HOMECAL-124 · 웹 헤더 날짜가 text-page-title font-semibold다", () => {
    renderWithQuery(
      <DayList
        date="2026-09-19"
        logs={[{ ...logA, id: 1, beanBatchId: undefined }]}
        variant="web"
      />,
    );

    const dateEl = screen.getByTestId("day-header-date");
    expect(dateEl).toHaveTextContent("19");
    expect(dateEl).toHaveClass("text-page-title", "font-semibold");
  });

  it("AC-HOMECAL-125 · 웹 헤더 오른쪽에 mono caption(11.5px) 건수가 있다", () => {
    renderWithQuery(
      <DayList
        date="2026-09-19"
        logs={[
          { ...logA, id: 1, beanBatchId: undefined },
          { ...logA, id: 2, beanBatchId: undefined },
        ]}
        variant="web"
      />,
    );

    const count = screen.getByTestId("day-header-count");
    expect(count).toHaveTextContent("2건");
    expect(count).toHaveClass("font-mono", "text-caption");
  });

  it("AC-HOMECAL-126 · 관계 문구가 Observation 블록 스타일이다", () => {
    renderWithQuery(
      <DayList
        date="2026-09-19"
        logs={[{ ...logA, id: 1, beanBatchId: undefined }]}
        ownerNickname="지연"
        variant="mobile"
      />,
    );

    const notice = screen.getByText("맞팔로우 상태여서 지연 님의 기록이 보입니다.");
    expect(notice).toHaveClass(
      "bg-surface",
      "border-l-2",
      "border-accent",
      "rounded-control",
    );
  });

  it("AC-HOMECAL-112 · 웹에서 기록이 카드(paper·border·rounded-surface·p-5)로 렌더된다", () => {
    renderWithQuery(
      <DayList
        date="2026-09-19"
        logs={[{ ...logA, id: 1, beanBatchId: undefined }]}
        variant="web"
      />,
    );

    const card = screen.getByTestId("day-card");
    expect(card).toHaveClass("bg-paper", "border", "rounded-surface", "p-6");
  });

  it("AC-HOMECAL-113 · 카드 상단에 레시피명·시각·대표 수치가 있다", () => {
    renderWithQuery(
      <DayList
        date="2026-09-19"
        logs={[{ ...logA, id: 1, beanBatchId: undefined }]}
        recipeLabels={new Map([[logA.recipeId, "V60 레시피"]])}
        variant="web"
      />,
    );

    expect(screen.getByText("V60 레시피")).toBeInTheDocument();
    // logA.brewedAt = 2026-08-31T09:00:00Z → KST 18:00
    expect(screen.getByText("18:00")).toBeInTheDocument();
  });

  it("AC-HOMECAL-114 · 카드 대표 수치가 text-card-metric(mono 17px)이다", () => {
    renderWithQuery(
      <DayList
        date="2026-09-19"
        logs={[{ ...logA, id: 1, beanBatchId: undefined }]}
        variant="web"
      />,
    );

    expect(screen.getByTestId("day-card-metric")).toHaveClass(
      "text-card-metric",
    );
  });

  it("AC-HOMECAL-115 · 카드 하단에 divider 아래 태그 줄이 렌더된다", () => {
    renderWithQuery(
      <DayList
        date="2026-09-19"
        logs={[{ ...logA, id: 1, beanBatchId: undefined }]}
        variant="web"
      />,
    );

    // logA: brewRatio 15.0, actualWaterTempC 92, actualTotalTimeSeconds 210, rating 4.0
    expect(screen.getByText("1:15.0")).toBeInTheDocument();
    expect(screen.getByText("92°C")).toBeInTheDocument();
    expect(screen.getByText("3:30")).toBeInTheDocument();
    expect(screen.getByText("★ 4")).toBeInTheDocument();
  });

  it("AC-HOMECAL-116 · 메모가 있으면 italic 줄이 렌더된다", () => {
    renderWithQuery(
      <DayList
        date="2026-09-19"
        logs={[
          { ...logA, id: 1, beanBatchId: undefined, overallNote: "산미가 좋았다" },
        ]}
        variant="web"
      />,
    );

    expect(screen.getByText("산미가 좋았다")).toHaveClass("italic");
  });

  it("AC-HOMECAL-117 · 메모가 없으면 메모 줄이 없다", () => {
    renderWithQuery(
      <DayList
        date="2026-09-19"
        logs={[{ ...logA, id: 1, beanBatchId: undefined, overallNote: undefined }]}
        variant="web"
      />,
    );

    expect(screen.queryByTestId("day-card-note")).not.toBeInTheDocument();
  });
});
