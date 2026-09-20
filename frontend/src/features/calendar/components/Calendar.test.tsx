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
    const dots = cell.querySelectorAll("[data-record-dot]");
    expect(dots).toHaveLength(1);

    const dot = dots[0] as HTMLElement;
    expect(dot.style.width).toBe("5px");
    expect(dot.style.height).toBe("5px");
    expect(dot.style.borderRadius).toBe("50%");
    expect(dot.style.backgroundColor).toBe("var(--signal-record)");
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

  it("AC-HOMECAL-34 · 왼쪽으로 스와이프하면 onSwipeLeft가 불린다", () => {
    const onSwipeLeft = vi.fn();
    const onSwipeRight = vi.fn();
    render(
      <Calendar
        month="2026-09"
        days={new Map()}
        selectedDate={null}
        onSelect={() => {}}
        onSwipeLeft={onSwipeLeft}
        onSwipeRight={onSwipeRight}
        variant="mobile"
      />,
    );

    const grid = screen.getByRole("grid");
    grid.dispatchEvent(
      new PointerEvent("pointerdown", { clientX: 300, bubbles: true }),
    );
    grid.dispatchEvent(
      new PointerEvent("pointerup", { clientX: 200, bubbles: true }),
    );

    expect(onSwipeLeft).toHaveBeenCalledTimes(1);
    expect(onSwipeRight).not.toHaveBeenCalled();
  });

  it("오른쪽으로 스와이프하면 onSwipeRight가 불린다", () => {
    const onSwipeLeft = vi.fn();
    const onSwipeRight = vi.fn();
    render(
      <Calendar
        month="2026-09"
        days={new Map()}
        selectedDate={null}
        onSelect={() => {}}
        onSwipeLeft={onSwipeLeft}
        onSwipeRight={onSwipeRight}
        variant="mobile"
      />,
    );

    const grid = screen.getByRole("grid");
    grid.dispatchEvent(
      new PointerEvent("pointerdown", { clientX: 100, bubbles: true }),
    );
    grid.dispatchEvent(
      new PointerEvent("pointerup", { clientX: 220, bubbles: true }),
    );

    expect(onSwipeRight).toHaveBeenCalledTimes(1);
    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it("이동 거리가 임계값 미만이면 스와이프로 치지 않는다", () => {
    const onSwipeLeft = vi.fn();
    render(
      <Calendar
        month="2026-09"
        days={new Map()}
        selectedDate={null}
        onSelect={() => {}}
        onSwipeLeft={onSwipeLeft}
        variant="mobile"
      />,
    );

    const grid = screen.getByRole("grid");
    grid.dispatchEvent(
      new PointerEvent("pointerdown", { clientX: 300, bubbles: true }),
    );
    grid.dispatchEvent(
      new PointerEvent("pointerup", { clientX: 280, bubbles: true }),
    );

    expect(onSwipeLeft).not.toHaveBeenCalled();
  });
});
