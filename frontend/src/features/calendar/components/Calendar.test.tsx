import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Calendar } from "./Calendar";

describe("Calendar", () => {
  it("AC-HOMECAL-25 · 요일 헤더의 첫 칸이 월이고 마지막이 일이다", () => {
    render(
      <Calendar
        month="2026-09"
        days={new Map()}
        selectedDate={null}
        onSelect={() => {}}
        variant="mobile"
      />,
    );

    const headers = screen.getAllByRole("columnheader");
    expect(headers[0]).toHaveTextContent("월");
    expect(headers[6]).toHaveTextContent("일");
  });

  it("AC-HOMECAL-26 · 기록이 2건인 날에도 점은 1개다", () => {
    const days = new Map([["2026-09-05", { count: 2 }]]);
    render(
      <Calendar
        month="2026-09"
        days={days}
        selectedDate={null}
        onSelect={() => {}}
        variant="mobile"
      />,
    );

    const cell = screen.getByRole("button", { name: "9월 5일, 기록 2건" });
    expect(cell.querySelectorAll("[data-record-dot]")).toHaveLength(1);
  });

  it("AC-HOMECAL-45 · aria-label이 건수를 말한다", () => {
    const days = new Map([["2026-09-19", { count: 2 }]]);
    render(
      <Calendar
        month="2026-09"
        days={days}
        selectedDate={null}
        onSelect={() => {}}
        variant="mobile"
      />,
    );

    expect(
      screen.getByRole("button", { name: "9월 19일, 기록 2건" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "9월 3일, 기록 없음" }),
    ).toBeInTheDocument();
  });

  it("AC-HOMECAL-46 · 선택된 셀에 aria-current가 정확히 하나다", () => {
    render(
      <Calendar
        month="2026-09"
        days={new Map()}
        selectedDate="2026-09-05"
        onSelect={() => {}}
        variant="mobile"
      />,
    );

    const current = document.querySelectorAll('[aria-current="date"]');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAccessibleName("9월 5일, 기록 없음");
  });

  it("AC-HOMECAL-35 · 화살표 키로 하루·일주일 이동한다", async () => {
    const onSelect = vi.fn();
    render(
      <Calendar
        month="2026-09"
        days={new Map()}
        selectedDate="2026-09-19"
        onSelect={onSelect}
        variant="mobile"
      />,
    );

    screen.getByRole("button", { name: "9월 19일, 기록 없음" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(onSelect).toHaveBeenLastCalledWith("2026-09-20");
    await userEvent.keyboard("{ArrowDown}");
    expect(onSelect).toHaveBeenLastCalledWith("2026-09-27");
  });

  it("다른 달 칸은 button이 아니고 내용이 없다", () => {
    render(
      <Calendar
        month="2026-09"
        days={new Map()}
        selectedDate={null}
        onSelect={() => {}}
        variant="mobile"
      />,
    );

    const outOfMonth = screen.getAllByTestId("calendar-out-of-month");
    expect(outOfMonth.length).toBeGreaterThan(0);
    for (const cell of outOfMonth) {
      expect(cell.tagName).not.toBe("BUTTON");
      expect(cell).toBeEmptyDOMElement();
    }
  });
});
