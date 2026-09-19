export interface GridCell {
  readonly date: string;
  readonly inMonth: boolean;
}

/** UTC 기준 순수 날짜 연산이다 — KST 변환은 여기서 하지 않는다. `month`는 이미 KST 기준 문자열이다. */
function toDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00Z`);
}

function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** JS의 getUTCDay()는 일요일이 0이다. 월요일을 0으로 다시 세팅한다. */
function mondayIndex(date: Date): number {
  return (date.getUTCDay() + 6) % 7;
}

/**
 * `YYYY-MM` 달력 격자. 월요일 시작, 항상 7의 배수 길이다.
 *
 * <p>다른 달에 속한 칸도 채워 그리드를 정사각으로 만든다 — `inMonth`로 구분한다.
 */
export function buildMonthGrid(month: string): GridCell[] {
  const [year, mon] = month.split("-").map(Number);
  const firstOfMonth = new Date(`${month}-01T00:00:00Z`);
  const start = new Date(firstOfMonth);
  start.setUTCDate(start.getUTCDate() - mondayIndex(firstOfMonth));

  const lastOfMonth = new Date(Date.UTC(year, mon, 0));
  const end = new Date(lastOfMonth);
  end.setUTCDate(end.getUTCDate() + (6 - mondayIndex(lastOfMonth)));

  const cells: GridCell[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    cells.push({
      date: toDateStr(cursor),
      inMonth: cursor.getUTCMonth() + 1 === mon && cursor.getUTCFullYear() === year,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return cells;
}

/** 날짜 문자열에 일수를 더한다(음수 가능). 키보드 이동(`←→↑↓`)에 쓴다. */
export function addDays(dateStr: string, delta: number): string {
  const date = toDate(dateStr);
  date.setUTCDate(date.getUTCDate() + delta);
  return toDateStr(date);
}
