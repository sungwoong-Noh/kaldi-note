import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MonthNav } from "./MonthNav";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-19T01:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("MonthNav", () => {
  it("AC-HOMECAL-32 · 이번 달에서 다음 달 버튼이 비활성이다", () => {
    render(
      <MonthNav month="2026-09" totalCount={9} onPrev={() => {}} onNext={() => {}} />,
    );

    expect(screen.getByRole("button", { name: "다음 달" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "이전 달" })).toBeEnabled();
  });

  it("지난 달에서는 다음 달 버튼이 활성이다", () => {
    render(
      <MonthNav month="2026-08" totalCount={9} onPrev={() => {}} onNext={() => {}} />,
    );

    expect(screen.getByRole("button", { name: "다음 달" })).toBeEnabled();
  });

  it("AC-HOMECAL-40 · 내 달력은 건수만, 남의 달력은 닉네임이 앞에 붙는다", () => {
    render(
      <MonthNav month="2026-09" totalCount={9} onPrev={() => {}} onNext={() => {}} />,
    );
    expect(screen.getByText("2026.09")).toBeInTheDocument();
    expect(screen.getByText("9 BREWS")).toBeInTheDocument();

    render(
      <MonthNav
        month="2026-09"
        totalCount={6}
        ownerNickname="지연"
        onPrev={() => {}}
        onNext={() => {}}
      />,
    );
    expect(screen.getByText("지연 · 6 BREWS")).toBeInTheDocument();
  });
});
