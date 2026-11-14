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

function chunkIntoWeeks<T>(items: T[]): T[][] {
  const weeks: T[][] = [];
  for (let i = 0; i < items.length; i += 7) {
    weeks.push(items.slice(i, i + 7));
  }
  return weeks;
}

/**
 * 선택·오늘 날짜 숫자를 감싸는 원 스타일.
 * 선택되면 `ink` 배경 원, 선택 안 됐지만 오늘이면 `border` 링만(배경 없음).
 */
function dayNumberClassName(
  compact: boolean,
  selected: boolean,
  isToday: boolean,
): string | undefined {
  const size = compact ? "h-6 w-6" : "h-7 w-7";
  if (selected) {
    return `flex ${size} items-center justify-center rounded-full bg-ink text-on-ink`;
  }
  if (isToday) {
    return `flex ${size} items-center justify-center rounded-full border border-border`;
  }
  return undefined;
}

/**
 * 지난/미래 × 평일/주말 4색 규칙(AC-HOMECAL-95~98). 선택되거나 오늘인 셀은 대상이 아니다 —
 * `dayNumberClassName`의 원/링 스타일이 우선한다(AC-HOMECAL-99).
 */
function dateColorVar(
  cellDate: string,
  today: string | undefined,
  columnIndex: number,
  selected: boolean,
  isToday: boolean,
): string | undefined {
  if (selected || isToday || today === undefined) return undefined;
  const isPast = cellDate < today;
  const isWeekend = columnIndex >= 5;
  if (isPast) {
    return isWeekend ? "var(--date-past-weekend)" : "var(--date-past-weekday)";
  }
  return isWeekend
    ? "var(--date-future-weekend)"
    : "var(--date-future-weekday)";
}

/**
 * 달력 그리드. 모든 화면 폭(모바일 F2·웹 300px 카드·웹 720px 달력·태블릿 1주 스트립)이
 * 동일한 점 기반 컴포넌트를 쓴다(B-1·B-2·B-4).
 */
export function Calendar({
  month,
  days,
  selectedDate,
  onSelect,
  onSwipeLeft,
  onSwipeRight,
  compact = false,
  collapsedWeek = false,
  onExpandWeek,
  today,
}: {
  month: string;
  days: Map<string, CalendarDayInfo>;
  selectedDate: string | null;
  onSelect: (date: string) => void;
  /** 왼쪽으로 스와이프 — 다음 달로 넘긴다. */
  onSwipeLeft?: () => void;
  /** 오른쪽으로 스와이프 — 이전 달로 넘긴다. */
  onSwipeRight?: () => void;
  /** 300px/280px 사이드 카드나 태블릿 1주 스트립 등 좁은 폭용. */
  compact?: boolean;
  /** 760–1023px에서 이번 주 1행만 접어 보여준다(AC-QUICKBREW-37). */
  collapsedWeek?: boolean;
  /** 접힌 주 줄을 눌렀을 때 한 달 전체로 펼친다(AC-QUICKBREW-37). */
  onExpandWeek?: () => void;
  /** `kstToday()`. 선택되지 않은 오늘 날짜에 링을 그리는 데만 쓴다(AC-HOMECAL-99). */
  today?: string;
}) {
  const grid = buildMonthGrid(month);
  const weeks = chunkIntoWeeks(grid);
  const swipeStartX = useRef<number | null>(null);

  function handleKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    date: string,
  ) {
    const delta = deltaFor(event.key);
    if (delta === null) return;
    event.preventDefault();
    const next = addDays(date, delta);
    onSelect(next);
    const target = document.querySelector<HTMLButtonElement>(
      `[data-date="${next}"]`,
    );
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

  let visibleWeeks = weeks;
  if (collapsedWeek && weeks.length > 0) {
    const todayIndex =
      today !== undefined
        ? weeks.findIndex((w) => w.some((c) => c.inMonth && c.date === today))
        : -1;
    const selectedIndex =
      todayIndex === -1 && selectedDate !== null
        ? weeks.findIndex((w) =>
            w.some((c) => c.inMonth && c.date === selectedDate),
          )
        : -1;
    const targetIndex =
      todayIndex !== -1 ? todayIndex : selectedIndex !== -1 ? selectedIndex : 0;
    visibleWeeks = [weeks[targetIndex]];
  }

  return (
    <div
      role="grid"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      <div role="row" className="grid grid-cols-7">
        {WEEKDAY_LABELS.map((label, index) => (
          <div
            key={label}
            role="columnheader"
            className="text-label text-center"
            style={{
              // text-label의 자간은 0.12em이다 — 이 헤더만 목업 값 0.08em으로 덮어쓴다.
              letterSpacing: "0.08em",
              color:
                index >= 5
                  ? "var(--weekday-header-weekend)"
                  : "var(--weekday-header)",
            }}
          >
            {label}
          </div>
        ))}
      </div>
      <div data-testid="calendar-week-grid">
        {visibleWeeks.map((week, weekIndex) =>
          collapsedWeek ? (
            <div
              key={weekIndex}
              data-testid="calendar-row"
              role="row"
              className="grid grid-cols-7"
            >
              <button
                type="button"
                aria-label="이번 주 달력 펼치기"
                onClick={onExpandWeek}
                className="col-span-7 grid min-h-11 w-full cursor-pointer grid-cols-7 text-left"
              >
                {week.map((cell, columnIndex) => {
                  if (!cell.inMonth) {
                    return (
                      <span
                        key={cell.date}
                        data-testid="calendar-out-of-month"
                        aria-hidden
                      />
                    );
                  }
                  const info = days.get(cell.date);
                  const count = info?.count ?? 0;
                  const day = Number(cell.date.slice(8, 10));
                  const selected = cell.date === selectedDate;
                  const isToday = cell.date === today;

                  return (
                    <span
                      key={cell.date}
                      data-date={cell.date}
                      className="flex h-full w-full min-h-11 flex-col items-center justify-center gap-1"
                    >
                      <span
                        data-testid="day-number-row"
                        className="flex flex-col items-center gap-1"
                      >
                        <span
                          data-testid="day-number"
                          className={dayNumberClassName(compact, selected, isToday)}
                          style={{
                            color: dateColorVar(
                              cell.date,
                              today,
                              columnIndex,
                              selected,
                              isToday,
                            ),
                          }}
                        >
                          {day}
                        </span>
                        <span
                          data-record-dot
                          aria-hidden
                          style={{
                            display: "inline-block",
                            width: 5,
                            height: 5,
                            borderRadius: "50%",
                            backgroundColor:
                              count > 0 ? "var(--signal-record)" : "transparent",
                          }}
                        />
                      </span>
                    </span>
                  );
                })}
              </button>
            </div>
          ) : (
            <div
              key={weekIndex}
              data-testid="calendar-row"
              role="row"
              className="grid grid-cols-7"
            >
              {week.map((cell, columnIndex) => {
                if (!cell.inMonth) {
                  return (
                    <div
                      key={cell.date}
                      data-testid="calendar-out-of-month"
                      aria-hidden
                    />
                  );
                }

                const info = days.get(cell.date);
                const count = info?.count ?? 0;
                const day = Number(cell.date.slice(8, 10));
                const month1 = Number(cell.date.slice(5, 7));
                const label =
                  count > 0
                    ? `${month1}월 ${day}일, 기록 ${count}건`
                    : `${month1}월 ${day}일, 기록 없음`;
                const selected = cell.date === selectedDate;
                const isToday = cell.date === today;

                return (
                  <button
                    key={cell.date}
                    type="button"
                    data-date={cell.date}
                    aria-label={label}
                    aria-current={selected ? "date" : undefined}
                    onClick={() => onSelect(cell.date)}
                    onKeyDown={(event) => handleKeyDown(event, cell.date)}
                    className={
                      compact
                        ? "hit-44 relative flex h-9 w-full flex-col items-center justify-center gap-1"
                        : "flex h-full w-full min-h-11 min-w-11 flex-col items-center justify-center gap-1 overflow-hidden"
                    }
                  >
                    <span
                      data-testid="day-number-row"
                      className="flex flex-col items-center gap-1"
                    >
                      <span
                        data-testid="day-number"
                        className={dayNumberClassName(compact, selected, isToday)}
                        style={{
                          color: dateColorVar(
                            cell.date,
                            today,
                            columnIndex,
                            selected,
                            isToday,
                          ),
                        }}
                      >
                        {day}
                      </span>
                      <span
                        data-record-dot
                        aria-hidden
                        style={{
                          display: "inline-block",
                          width: 5,
                          height: 5,
                          borderRadius: "50%",
                          backgroundColor:
                            count > 0 ? "var(--signal-record)" : "transparent",
                        }}
                      />
                    </span>
                  </button>
                );
              })}
            </div>
          ),
        )}
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
