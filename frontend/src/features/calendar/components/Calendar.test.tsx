import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Calendar } from "./Calendar";

/**
 * `--weekday-header`·`--date-past-weekday` 등은 핵심 팔레트(`TOKEN_NAMES`, 18개)가 아니라
 * 이 화면 전용 파생 토큰이다. jsdom은 CSS 커스텀 프로퍼티 재정의를 계산해주지 않으므로
 * `globals.css` 원문을 직접 읽어 다크 블록의 재정의를 확인한다(designTokens.test.ts와 같은 방식).
 */
function darkBlockOf(): string {
  const css = readFileSync(join("src", "app", "globals.css"), "utf8");
  const at = css.indexOf("@media (prefers-color-scheme: dark)");
  return css.slice(at);
}

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

  it("AC-HOMECAL-63 · 웹 셀의 긴 레시피명은 잘려서 한 줄로 표시된다", () => {
    const days = new Map([
      [
        "2026-09-05",
        { count: 1, primaryRecipeName: "Tetsu Kasuya 4:6 Method" },
      ],
    ]);
    render(
      <Calendar
        month="2026-09"
        days={days}
        selectedDate={null}
        onSelect={() => {}}
        variant="web"
      />,
    );

    const cell = screen.getByRole("button", { name: "9월 5일, 기록 1건" });
    expect(cell).toHaveTextContent("Tetsu Kasuya 4:6 Method");
    const name = screen.getByText("Tetsu Kasuya 4:6 Method");
    expect(name).toHaveClass("truncate");
    expect(cell).toHaveClass("overflow-hidden");
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

  it("AC-HOMECAL-92 · 요일 헤더가 mono 10px·대문자·자간 0.08em이다", () => {
    render(
      <Calendar
        month="2026-09"
        days={new Map()}
        selectedDate={null}
        onSelect={() => {}}
        variant="mobile"
      />,
    );

    const header = screen.getAllByRole("columnheader")[0];
    // text-label이 mono·10px·uppercase를 이미 준다(design-system-v2). 자간만 이 화면 전용값.
    // toHaveStyle 대신 인라인 스타일을 직접 읽는다 — jsdom이 "0.08em"을 기본 16px 기준
    // "1.28px"로 계산해버려 리터럴 비교가 어긋난다(실제 폰트 크기 10px 기준이 아니다).
    expect(header).toHaveClass("text-label");
    expect(header.style.letterSpacing).toBe("0.08em");
  });

  it("AC-HOMECAL-93·94 · 요일 헤더 평일·주말 색이 다르다", () => {
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
    // 월(0)~금(4)은 평일, 토(5)·일(6)은 주말
    expect(headers[0]).toHaveStyle({ color: "var(--weekday-header)" });
    expect(headers[5]).toHaveStyle({
      color: "var(--weekday-header-weekend)",
    });
  });

  it("AC-HOMECAL-95 · 이번 달 지난 평일 날짜 색이 --date-past-weekday다", () => {
    // 2026-09-19는 토요일. 2026-09-14(월, 지난 평일)를 확인한다.
    render(
      <Calendar
        month="2026-09"
        days={new Map()}
        selectedDate={null}
        onSelect={() => {}}
        variant="mobile"
        today="2026-09-19"
      />,
    );

    const cell = screen.getByRole("button", { name: "9월 14일, 기록 없음" });
    const number = within(cell).getByTestId("day-number");
    expect(number).toHaveStyle({ color: "var(--date-past-weekday)" });
  });

  it("AC-HOMECAL-96 · 이번 달 지난 주말 날짜 색이 --date-past-weekend다", () => {
    // 2026-09-13(일, 지난 주말)
    render(
      <Calendar
        month="2026-09"
        days={new Map()}
        selectedDate={null}
        onSelect={() => {}}
        variant="mobile"
        today="2026-09-19"
      />,
    );

    const cell = screen.getByRole("button", { name: "9월 13일, 기록 없음" });
    const number = within(cell).getByTestId("day-number");
    expect(number).toHaveStyle({ color: "var(--date-past-weekend)" });
  });

  it("AC-HOMECAL-97 · 미래 평일 날짜 색이 --date-future-weekday다", () => {
    // 2026-09-21(월, 미래 평일)
    render(
      <Calendar
        month="2026-09"
        days={new Map()}
        selectedDate={null}
        onSelect={() => {}}
        variant="mobile"
        today="2026-09-19"
      />,
    );

    const cell = screen.getByRole("button", { name: "9월 21일, 기록 없음" });
    const number = within(cell).getByTestId("day-number");
    expect(number).toHaveStyle({ color: "var(--date-future-weekday)" });
  });

  it("AC-HOMECAL-98 · 미래 주말 날짜 색이 --date-future-weekend다", () => {
    // 2026-09-26(토, 미래 주말)
    render(
      <Calendar
        month="2026-09"
        days={new Map()}
        selectedDate={null}
        onSelect={() => {}}
        variant="mobile"
        today="2026-09-19"
      />,
    );

    const cell = screen.getByRole("button", { name: "9월 26일, 기록 없음" });
    const number = within(cell).getByTestId("day-number");
    expect(number).toHaveStyle({ color: "var(--date-future-weekend)" });
  });

  it("AC-HOMECAL-99 · 오늘 날짜는 4색 규칙 대신 링 스타일이 적용된다(회귀)", () => {
    render(
      <Calendar
        month="2026-09"
        days={new Map()}
        selectedDate={null}
        onSelect={() => {}}
        variant="mobile"
        today="2026-09-19"
      />,
    );

    const cell = screen.getByRole("button", { name: "9월 19일, 기록 없음" });
    const number = within(cell).getByTestId("day-number");
    // 색 인라인 스타일이 없어야 한다 — dayNumberClassName의 링/원 스타일이 우선한다.
    expect(number.style.color).toBe("");
    expect(number).toHaveClass("rounded-full", "border", "border-border");
  });

  it("AC-HOMECAL-98a · 다크 모드 날짜 색이 기존 ink 스케일을 재사용한다", () => {
    const dark = darkBlockOf();
    expect(dark).toMatch(/--date-past-weekday:\s*var\(--ink\);/);
    expect(dark).toMatch(/--date-past-weekend:\s*var\(--ink-2\);/);
    expect(dark).toMatch(/--date-future-weekday:\s*var\(--ink-3\);/);
    expect(dark).toMatch(/--date-future-weekend:\s*oklch\(0\.55 0\.012 70\);/);
  });

  it("AC-HOMECAL-98b · 다크 모드 요일 헤더 색은 평일·주말 모두 ink-3다", () => {
    const dark = darkBlockOf();
    expect(dark).toMatch(/--weekday-header:\s*var\(--ink-3\);/);
    expect(dark).toMatch(/--weekday-header-weekend:\s*var\(--ink-3\);/);
  });
});
