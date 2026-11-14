import { describe, expect, it } from "vitest";
import { weekCalendarMonths, weekSummary } from "./weekSummary";

describe("weekSummary", () => {
  it("AC-QUICKBREW-22 · 이번 주(월요일 시작 KST)가 1잔 이하이면 카드를 숨기고, 2잔 이상이면 숫자와 지난주 잔수를 보여준다", () => {
    // 2026-11-14(토) 기준 이번 주는 11.09(월)~11.15(일), 지난주는 11.02(월)~11.08(일)이다.
    const oneThisWeek = weekSummary("2026-11-14", [
      { date: "2026-11-08", count: 1 }, // 일요일 → 지난주
      { date: "2026-11-09", count: 1 }, // 월요일 → 이번 주 1잔
    ]);

    expect(oneThisWeek.showCard).toBe(false);
    expect(oneThisWeek.thisWeekCount).toBe(1);
    expect(oneThisWeek.lastWeekCount).toBe(1);

    // 목요일 1건 추가 → 이번 주 2잔, 지난주 1잔 → 카드 노출
    const twoThisWeek = weekSummary("2026-11-14", [
      { date: "2026-11-08", count: 1 },
      { date: "2026-11-09", count: 1 },
      { date: "2026-11-12", count: 1 },
    ]);

    expect(twoThisWeek.showCard).toBe(true);
    expect(twoThisWeek.thisWeekCount).toBe(2);
    expect(twoThisWeek.lastWeekCount).toBe(1);
    expect(twoThisWeek.days).toEqual([
      { date: "2026-11-09", weekday: "월", count: 1, active: true },
      { date: "2026-11-10", weekday: "화", count: 0, active: false },
      { date: "2026-11-11", weekday: "수", count: 0, active: false },
      { date: "2026-11-12", weekday: "목", count: 1, active: true },
      { date: "2026-11-13", weekday: "금", count: 0, active: false },
      { date: "2026-11-14", weekday: "토", count: 0, active: false },
      { date: "2026-11-15", weekday: "일", count: 0, active: false },
    ]);
  });

  it("일요일 경계는 월요일 시작 주간이므로 지난주로 계산된다", () => {
    // 2026-11-15(일) 기준 이번 주는 11.09(월)~11.15(일), 지난주는 11.02(월)~11.08(일)이다.
    // 2026-11-16(월)가 되면 11.09~11.15는 모두 지난주가 된다.
    const sunday = weekSummary("2026-11-15", [
      { date: "2026-11-08", count: 3 },
      { date: "2026-11-09", count: 1 },
      { date: "2026-11-15", count: 1 },
    ]);
    expect(sunday.thisWeekCount).toBe(2);
    expect(sunday.lastWeekCount).toBe(3);

    const nextMonday = weekSummary("2026-11-16", [
      { date: "2026-11-09", count: 1 },
      { date: "2026-11-15", count: 2 },
      { date: "2026-11-16", count: 2 },
    ]);
    expect(nextMonday.thisWeekCount).toBe(2);
    expect(nextMonday.lastWeekCount).toBe(3);
  });

  it("월 경계와 연 경계를 넘는 두 달 달력 응답을 합산한다", () => {
    expect(weekCalendarMonths("2026-11-14")).toEqual(["2026-11"]);
    expect(weekCalendarMonths("2026-11-01")).toEqual(["2026-10", "2026-11"]);
    expect(weekCalendarMonths("2027-01-01")).toEqual(["2026-12", "2027-01"]);

    // 2026-12-03(목): 이번 주 = 11.30(월)~12.06(일), 지난주 = 11.23(월)~11.29(일)
    const crossMonth = weekSummary("2026-12-03", [
      { date: "2026-11-23", count: 2 },
      { date: "2026-11-30", count: 1 },
      { date: "2026-12-02", count: 2 },
      { date: "2026-11-20", count: 5 }, // 지지난주 — 제외
    ]);
    expect(crossMonth.thisWeekCount).toBe(3);
    expect(crossMonth.lastWeekCount).toBe(2);
    expect(crossMonth.showCard).toBe(true);
    expect(crossMonth.days[0]).toEqual({
      date: "2026-11-30",
      weekday: "월",
      count: 1,
      active: true,
    });
    expect(crossMonth.days[2]).toEqual({
      date: "2026-12-02",
      weekday: "수",
      count: 2,
      active: true,
    });
  });
});
