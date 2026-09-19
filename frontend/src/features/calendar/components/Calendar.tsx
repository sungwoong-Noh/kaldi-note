"use client";

import { addDays, buildMonthGrid } from "../monthGrid";

const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"] as const;

export interface CalendarDayInfo {
  readonly count: number;
  readonly primaryRecipeName?: string;
}

/**
 * 달력 그리드. 모바일·웹이 같은 컴포넌트를 쓰고 `variant`로 CSS만 가른다
 * (docs/specs/2026-09-19-home-calendar.md) — 두 벌로 만들면 aria-label·키보드 이동 같은
 * 규칙이 한쪽에만 적용되는 사고가 난다.
 */
export function Calendar({
  month,
  days,
  selectedDate,
  onSelect,
  variant,
}: {
  month: string;
  days: Map<string, CalendarDayInfo>;
  selectedDate: string | null;
  onSelect: (date: string) => void;
  variant: "mobile" | "web";
}) {
  const grid = buildMonthGrid(month);

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, date: string) {
    const delta = deltaFor(event.key);
    if (delta === null) return;
    event.preventDefault();
    const next = addDays(date, delta);
    onSelect(next);
    const target = document.querySelector<HTMLButtonElement>(`[data-date="${next}"]`);
    target?.focus();
  }

  return (
    <div role="grid" data-variant={variant}>
      <div role="row" className="grid grid-cols-7">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} role="columnheader">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {grid.map((cell) => {
          if (!cell.inMonth) {
            return <div key={cell.date} data-testid="calendar-out-of-month" aria-hidden />;
          }

          const info = days.get(cell.date);
          const count = info?.count ?? 0;
          const day = Number(cell.date.slice(8, 10));
          const month1 = Number(cell.date.slice(5, 7));
          const label =
            count > 0 ? `${month1}월 ${day}일, 기록 ${count}건` : `${month1}월 ${day}일, 기록 없음`;

          return (
            <button
              key={cell.date}
              type="button"
              data-date={cell.date}
              aria-label={label}
              aria-current={cell.date === selectedDate ? "date" : undefined}
              onClick={() => onSelect(cell.date)}
              onKeyDown={(event) => handleKeyDown(event, cell.date)}
            >
              <span>{day}</span>
              {count > 0 && <span data-record-dot aria-hidden />}
              {variant === "web" && info?.primaryRecipeName && (
                <span>{info.primaryRecipeName}</span>
              )}
              {variant === "web" && count > 1 && <span>외 {count - 1}건</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function deltaFor(key: string): number | null {
  switch (key) {
    case "ArrowLeft":
      return -1;
    case "ArrowRight":
      return 1;
    case "ArrowUp":
      return -7;
    case "ArrowDown":
      return 7;
    default:
      return null;
  }
}
