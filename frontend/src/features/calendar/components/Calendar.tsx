"use client";

import { useRef } from "react";
import { addDays, buildMonthGrid } from "../monthGrid";

const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"] as const;

/** 손가락이 우연히 스치는 것과 실제 스와이프를 가르는 최소 이동 거리. */
const SWIPE_THRESHOLD_PX = 50;

/**
 * 웹 그리드의 고정 총 높이(px). 5주·6주 달 모두 이 높이를 나눠 갖는다 —
 * `gridTemplateRows: repeat(주 수, 1fr)`로 주 수가 늘면 행 하나의 높이만 줄어든다
 * (AC-HOMECAL-68).
 */
const WEB_GRID_HEIGHT_PX = 420;

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
 * 선택·오늘 날짜 숫자를 감싸는 원 스타일. 웹은 24px, 모바일은 28px — 나머지 규칙은 같다:
 * 선택되면 `ink` 배경 원, 선택 안 됐지만 오늘이면 `border` 링만(배경 없음).
 */
function dayNumberClassName(
  isWeb: boolean,
  selected: boolean,
  isToday: boolean,
): string | undefined {
  const size = isWeb ? "h-6 w-6" : "h-7 w-7";
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
  fillHeight = false,
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
  variant: "mobile" | "web";
  /**
   * `≥1100px` 2컬럼에서만 true. 남는 세로 공간을 채우는 flex 체인을 켠다 — 어떤 조상에도
   * `min-height:0`을 주지 않으므로, flexbox의 자동 최소 크기(`min-height:auto`)가
   * `64px×주 수`를 콘텐츠 최소 크기로 잡아 바닥 역할을 한다. 공간이 부족하면 그리드가 이
   * 바닥 밑으로 눌리는 대신 넘쳐서 페이지가 스크롤된다(docs/specs/2026-09-20-calendar-grid-responsive.md
   * AC-HOMECAL-85·86).
   */
  fillHeight?: boolean;
  /** `kstToday()`. 선택되지 않은 오늘 날짜에 링을 그리는 데만 쓴다(웹 AC-HOMECAL-90, 모바일). */
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

  const isWeb = variant === "web";

  return (
    <div
      role="grid"
      data-variant={variant}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      className={fillHeight ? "flex flex-1 flex-col" : undefined}
    >
      <div role="row" className="grid grid-cols-7">
        {WEEKDAY_LABELS.map((label, index) => (
          <div
            key={label}
            role="columnheader"
            className="text-label"
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
      <div
        data-testid="calendar-week-grid"
        className={isWeb ? "border-t border-divider-strong" : undefined}
        style={
          isWeb
            ? fillHeight
              ? {
                  flex: "1 1 auto",
                  display: "grid",
                  gridTemplateRows: `repeat(${weeks.length}, minmax(64px, 1fr))`,
                }
              : {
                  height: WEB_GRID_HEIGHT_PX,
                  display: "grid",
                  gridTemplateRows: `repeat(${weeks.length}, 1fr)`,
                }
            : undefined
        }
      >
        {weeks.map((week, weekIndex) => (
          <div
            key={weekIndex}
            data-testid="calendar-row"
            role="row"
            className={`grid grid-cols-7 ${
              isWeb && weekIndex > 0 ? "border-t border-sunken" : ""
            }`}
          >
            {week.map((cell, columnIndex) => {
              const lineClass =
                isWeb && columnIndex > 0 ? "border-l border-sunken" : "";
              if (!cell.inMonth) {
                return (
                  <div
                    key={cell.date}
                    data-testid="calendar-out-of-month"
                    aria-hidden
                    className={`${isWeb ? "bg-surface" : ""} ${lineClass}`}
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
                  style={
                    isWeb && selected
                      ? { boxShadow: "inset 0 0 0 2px var(--ink)" }
                      : undefined
                  }
                  className={`flex h-full w-full min-h-11 min-w-11 flex-col items-center justify-center gap-1 overflow-hidden ${
                    isWeb ? "px-3 py-2" : ""
                  } ${isWeb && selected ? "bg-surface" : ""} ${lineClass}`}
                >
                  <span
                    data-testid="day-number-row"
                    className={`flex items-center ${isWeb ? "flex-row gap-2" : "flex-col gap-1"}`}
                  >
                    <span
                      data-testid="day-number"
                      className={dayNumberClassName(isWeb, selected, isToday)}
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
                  {isWeb && info?.primaryRecipeName && (
                    <span className="w-full truncate px-1 text-center">
                      {info.primaryRecipeName}
                    </span>
                  )}
                  {isWeb && count > 1 && (
                    <span className="w-full truncate px-1 text-center">
                      외 {count - 1}건
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
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
