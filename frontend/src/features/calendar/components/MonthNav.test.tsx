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

  it("AC-HOMECAL-105 · AC-HOMEFIT-06 · 월 이동 버튼 누르는 영역이 hit-44다", () => {
    render(
      <MonthNav month="2026-09" totalCount={0} onPrev={() => {}} onNext={() => {}} />,
    );
    const prev = screen.getByRole("button", { name: "이전 달" });
    expect(prev).toHaveClass("hit-44");
  });

  it("AC-HOMECAL-106 · AC-HOMEFIT-06 · 월 이동 버튼 자신이 32×32px·radius 7px 한 겹이다", () => {
    render(
      <MonthNav month="2026-09" totalCount={0} onPrev={() => {}} onNext={() => {}} />,
    );
    const prev = screen.getByRole("button", { name: "이전 달" });
    // rounded-control이 정확히 7px다(globals.css --radius-control) — 임의값 대신 이걸 쓴다.
    expect(prev).toHaveClass("size-8", "rounded-control", "border");
    expect(prev.querySelector("span")).toBeNull();
  });

  it("AC-HOMECAL-107 · 월 라벨이 text-month-label(mono 22px)이다", () => {
    render(
      <MonthNav month="2026-09" totalCount={0} onPrev={() => {}} onNext={() => {}} />,
    );
    expect(screen.getByText("2026.09")).toHaveClass("text-month-label");
  });
});
