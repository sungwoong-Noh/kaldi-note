"use client";

import { useRef } from "react";
import { addDays, buildMonthGrid } from "../monthGrid";

const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"] as const;

/** 손가락이 우연히 스치는 것과 실제 스와이프를 가르는 최소 이동 거리. */
const SWIPE_THRESHOLD_PX = 50;

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
  onSwipeLeft,
  onSwipeRight,
  variant,
}: {
  month: string;
  days: Map<string, CalendarDayInfo>;
  selectedDate: string | null;
  onSelect: (date: string) => void;
  /** 왼쪽으로 스와이프 — 다음 달로 넘긴다. */
  onSwipeLeft?: () => void;
  /** 오른쪽으로 스와이프 — 이전 달로 넘긴다. */
  onSwipeRight?: () => void;
  variant: "mobile" | "web";
}) {
  const grid = buildMonthGrid(month);
  const swipeStartX = useRef<number | null>(null);

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, date: string) {
    const delta = deltaFor(event.key);
    if (delta === null) return;
    event.preventDefault();
    const next = addDays(date, delta);
    onSelect(next);
    const target = document.querySelector<HTMLButtonElement>(`[data-date="${next}"]`);
    target?.focus();
  }

  /**
   * 포인터 이벤트를 쓴다 — 터치·마우스 드래그 둘 다 같은 경로로 잡히고, 테스트에서
   * `mouse.down/move/up`으로 재현할 수 있다(순수 touch 이벤트는 헤드리스에서 재현하기 까다롭다).
   */
  function handlePointerDown(event: React.PointerEvent) {
    swipeStartX.current = event.clientX;
  }

  function handlePointerUp(event: React.PointerEvent) {
    if (swipeStartX.current === null) return;
    const delta = event.clientX - swipeStartX.current;
    swipeStartX.current = null;
    if (delta <= -SWIPE_THRESHOLD_PX) onSwipeLeft?.();
    else if (delta >= SWIPE_THRESHOLD_PX) onSwipeRight?.();
  }

  return (
    <div
      role="grid"
      data-variant={variant}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
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
              className="flex min-h-11 min-w-11 flex-col items-center justify-center"
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
