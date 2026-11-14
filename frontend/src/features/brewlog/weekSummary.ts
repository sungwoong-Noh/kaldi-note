export interface WeekDayCountSource {
  readonly date: string;
  readonly count: number;
}

export type KoreanWeekday = "월" | "화" | "수" | "목" | "금" | "토" | "일";

export interface WeekDayDot {
  readonly date: string;
  readonly weekday: KoreanWeekday;
  readonly count: number;
  readonly active: boolean;
}

export interface WeekSummary {
  readonly thisWeekCount: number;
  readonly lastWeekCount: number;
  readonly showCard: boolean;
  readonly days: readonly WeekDayDot[];
}

const MONDAY_FIRST_WEEKDAYS: readonly KoreanWeekday[] = [
  "월",
  "화",
  "수",
  "목",
  "금",
  "토",
  "일",
];

function parseUtcDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatUtcDate(date: Date): string {
  const y = String(date.getUTCFullYear());
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDaysKst(dateStr: string, delta: number): string {
  const date = parseUtcDate(dateStr);
  date.setUTCDate(date.getUTCDate() + delta);
  return formatUtcDate(date);
}

function mondayIndexKst(dateStr: string): number {
  return (parseUtcDate(dateStr).getUTCDay() + 6) % 7;
}

function weekBounds(todayKst: string) {
  const thisMonday = addDaysKst(todayKst, -mondayIndexKst(todayKst));
  const thisSunday = addDaysKst(thisMonday, 6);
  const lastMonday = addDaysKst(thisMonday, -7);
  const lastSunday = addDaysKst(thisMonday, -1);
  return { thisMonday, thisSunday, lastMonday, lastSunday };
}

/**
 * 이번 주와 지난주(월요일 시작 KST 14일 구간)를 덮는 달 목록(`YYYY-MM`)을 돌려준다.
 *
 * <p>14일 연속 구간은 어떤 달(최소 28일)에서도 최대 두 달에만 걸친다.
 */
export function weekCalendarMonths(
  todayKst: string,
): [string] | [string, string] {
  const { lastMonday, thisSunday } = weekBounds(todayKst);
  const startMonth = lastMonday.slice(0, 7);
  const endMonth = thisSunday.slice(0, 7);
  return startMonth === endMonth ? [endMonth] : [startMonth, endMonth];
}

/**
 * `/brew-logs/calendar`의 일별 잔 수로부터 이번 주·지난주 잔 수와 월~일 점 상태를 계산한다.
 *
 * <p>주는 KST 월요일 시작이며, 이번 주가 2잔 이상일 때만 「이번 주」 카드를 보인다(AC-QUICKBREW-22).
 */
export function weekSummary(
  todayKst: string,
  sources: readonly WeekDayCountSource[],
): WeekSummary {
  const { thisMonday, lastMonday, lastSunday } = weekBounds(todayKst);
  const byDate = new Map<string, number>();
  for (const item of sources) {
    byDate.set(item.date, (byDate.get(item.date) ?? 0) + item.count);
  }

  let lastWeekCount = 0;
  for (let i = 0; i < 7; i += 1) {
    const date = addDaysKst(lastMonday, i);
    if (date <= lastSunday) {
      lastWeekCount += byDate.get(date) ?? 0;
    }
  }

  let thisWeekCount = 0;
  const days: WeekDayDot[] = MONDAY_FIRST_WEEKDAYS.map((weekday, index) => {
    const date = addDaysKst(thisMonday, index);
    const count = byDate.get(date) ?? 0;
    thisWeekCount += count;
    return {
      date,
      weekday,
      count,
      active: count > 0,
    };
  });

  return {
    thisWeekCount,
    lastWeekCount,
    showCard: thisWeekCount >= 2,
    days,
  };
}
