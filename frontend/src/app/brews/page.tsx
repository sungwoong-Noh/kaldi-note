"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useLayoutEffect, useRef, useState } from "react";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { Button, Shell } from "@/components/ui";
import { useRequireSession } from "@/features/auth/useRequireSession";
import { BREW_LOG_PAGE_SIZE, fetchBrewLogPage } from "@/features/brewlog/api";
import {
  groupLogsByKstDate,
  resolveLedgerEntryPresentation,
} from "@/features/brewlog/brewLedgerPresentation";
import { BrewLedger } from "@/features/brewlog/components/BrewLedger";
import { useRecipeLabels } from "@/features/brewlog/useRecipeLabels";
import { useBeanMetadataSources } from "@/features/brewlog/useTodayMetadata";
import { useCalendar, useDayLogs } from "@/features/calendar/api";
import {
  Calendar,
  type CalendarDayInfo,
} from "@/features/calendar/components/Calendar";
import { DayList } from "@/features/calendar/components/DayList";
import { MonthNav } from "@/features/calendar/components/MonthNav";
import { useMe } from "@/features/user/queries";
import { addMonths, kstMonthOf, kstToday } from "@/lib/kstDate";
import { openQuickBrew } from "@/lib/quickBrew";
import { useViewportWidth } from "@/lib/useViewportWidth";

type BrewsMode = "list" | "calendar";

const WEB_BREAKPOINT_PX = 760;
const TABLET_MAX_WIDTH_PX = 1023;

export default function BrewsPage() {
  const { ready, onSessionLost } = useRequireSession();
  const me = useMe(onSessionLost);
  const width = useViewportWidth();
  const isWide = width !== null && width >= WEB_BREAKPOINT_PX;
  const isTablet =
    width !== null &&
    width >= WEB_BREAKPOINT_PX &&
    width <= TABLET_MAX_WIDTH_PX;

  const today = kstToday();
  const currentMonth = kstMonthOf(today);

  const [mode, setMode] = useState<BrewsMode>("list");
  const [month, setMonth] = useState<string>(currentMonth);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [tabletExpanded, setTabletExpanded] = useState<boolean>(false);

  const scrollByModeRef = useRef<Record<BrewsMode, number>>({
    list: 0,
    calendar: 0,
  });
  const prevModeRef = useRef<BrewsMode>(mode);
  const dateGroupRefs = useRef<Map<string, HTMLElement>>(new Map());

  const {
    data,
    error,
    isPending,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["brew-logs", "mine", { userId: me.data?.id }],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      fetchBrewLogPage(pageParam, BREW_LOG_PAGE_SIZE, onSessionLost, {
        userId: me.data?.id,
      }),
    getNextPageParam: (lastPage) =>
      lastPage.hasNext ? lastPage.page + 1 : undefined,
    enabled: ready && me.data !== undefined,
  });

  const calendar = useCalendar(
    me.data?.id,
    month,
    onSessionLost,
    ready && me.data !== undefined,
  );

  const monthDays = calendar.data?.days ?? [];
  const dayMap = new Map<string, CalendarDayInfo>(
    monthDays.map((d) => [d.date, { count: d.count, primaryRecipeName: d.primaryRecipeName }]),
  );
  const latestActiveDay =
    monthDays.length > 0 ? monthDays[monthDays.length - 1].date : undefined;

  const effectiveCalendarDate =
    selectedDate !== null && selectedDate.startsWith(month)
      ? selectedDate
      : month === currentMonth
        ? today
        : (latestActiveDay ?? `${month}-01`);

  const dayLogsQuery = useDayLogs(
    me.data?.id,
    mode === "calendar" ? effectiveCalendarDate : null,
    onSessionLost,
  );

  const listLogs = data?.pages.flatMap((page) => page.content) ?? [];
  const dayLogs = dayLogsQuery.data?.content ?? [];
  const visibleLogs =
    mode === "calendar" ? [...listLogs, ...dayLogs] : listLogs;

  const recipeLabels = useRecipeLabels(
    visibleLogs,
    ready && me.data !== undefined,
    onSessionLost,
  );
  const beanOnlyLogs = visibleLogs.filter((log) => log.recipeId === undefined);
  const beanSources = useBeanMetadataSources(
    beanOnlyLogs,
    ready && me.data !== undefined,
    onSessionLost,
  );

  const groupedLogs = groupLogsByKstDate(listLogs);
  const totalCount = data?.pages[0]?.totalElements;

  useLayoutEffect(() => {
    if (prevModeRef.current === mode) return;
    prevModeRef.current = mode;
    window.scrollTo(0, scrollByModeRef.current[mode]);
  }, [mode]);

  function switchMode(nextMode: BrewsMode) {
    if (nextMode === mode) return;
    scrollByModeRef.current[mode] = window.scrollY;
    setMode(nextMode);
  }

  function handlePrevMonth() {
    setMonth((prev) => addMonths(prev, -1));
  }

  function handleNextMonth() {
    setMonth((prev) => (prev < currentMonth ? addMonths(prev, 1) : prev));
  }

  function handleSidebarDateSelect(date: string) {
    setSelectedDate(date);
    const hasLoadedDate = groupedLogs.some((group) => group.date === date);
    if (hasLoadedDate) {
      dateGroupRefs.current.get(date)?.scrollIntoView?.({ block: "start" });
      return;
    }
    switchMode("calendar");
  }

  function registerDateGroupRef(date: string) {
    return (el: HTMLElement | null) => {
      if (el === null) dateGroupRefs.current.delete(date);
      else dateGroupRefs.current.set(date, el);
    };
  }

  const dayEntryLabels = new Map<number, string>(
    dayLogs.map((log) => [
      log.id,
      resolveLedgerEntryPresentation(log, { recipeLabels, beanSources }).title,
    ]),
  );

  const headerSegment = (
    <div
      className={
        isWide
          ? "flex w-[220px] shrink-0 gap-[3px] rounded-[8px] bg-sunken p-[3px]"
          : "flex w-full gap-[3px] rounded-[8px] bg-sunken p-[3px]"
      }
    >
      {(
        [
          { id: "list", label: "목록" },
          { id: "calendar", label: "달력" },
        ] as const
      ).map((item) => {
        const active = mode === item.id;
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={active}
            onClick={() => switchMode(item.id)}
            className={`hit-44 flex-1 rounded-[6px] px-[6px] py-[9px] text-[13.5px] ${
              active
                ? "border border-border bg-paper font-medium text-ink"
                : "border border-transparent bg-transparent text-ink-3"
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );

  const pageHeader = (
    <div className="flex flex-col gap-[14px]">
      <div
        className={
          isWide ? "flex items-end justify-between gap-[24px]" : undefined
        }
      >
        <div className="flex flex-col gap-[7px]">
          {totalCount !== undefined && (
            <span className="font-mono text-[10px] font-medium tracking-[0.12em] text-ink-3 uppercase">
              {totalCount}잔
            </span>
          )}
          <h1
            className={
              isWide
                ? "text-[32px] leading-[1.1] font-semibold tracking-[-0.03em] text-ink"
                : "text-[27px] leading-[1.15] font-semibold tracking-[-0.03em] text-ink"
            }
          >
            기록
          </h1>
        </div>
        {isWide && totalCount !== undefined && headerSegment}
      </div>

      {!isWide && totalCount !== undefined && (
        <div className="flex flex-col gap-[12px]">
          {!(mode === "list" && listLogs.length === 0) && (
            <button
              type="button"
              onClick={() => openQuickBrew("record")}
              className="hit-44 kn-press w-full rounded-[8px] border border-ink bg-ink px-4 py-[15px] text-center text-[15px] font-semibold tracking-[-0.01em] text-on-ink"
            >
              기록하기
            </button>
          )}
          {headerSegment}
        </div>
      )}
    </div>
  );

  if (me.error) {
    return (
      <Shell wide stack className="max-w-[1080px]">
        {pageHeader}
        <ErrorState error={me.error} onRetry={() => void me.refetch()} />
      </Shell>
    );
  }

  if (!ready || me.isPending || isPending) {
    return (
      <Shell wide stack className="max-w-[1080px]">
        {pageHeader}
        <LoadingState />
      </Shell>
    );
  }

  if (error) {
    return (
      <Shell wide stack className="max-w-[1080px]">
        {pageHeader}
        <ErrorState error={error} onRetry={() => void refetch()} />
      </Shell>
    );
  }

  const showAside = isWide && mode === "list";

  const calendarSection = (
    <div className="flex flex-col gap-6">
      {calendar.isPending ? (
        <LoadingState />
      ) : calendar.error ? (
        <ErrorState
          error={calendar.error}
          onRetry={() => void calendar.refetch()}
        />
      ) : (
        <>
          <div
            className={
              isWide
                ? "flex flex-col gap-4 rounded-[12px] border border-border p-6"
                : "flex flex-col gap-3"
            }
          >
            <MonthNav
              month={month}
              totalCount={calendar.data.totalCount}
              activeDays={calendar.data.days.length}
              showCount={isWide}
              onPrev={handlePrevMonth}
              onNext={handleNextMonth}
            />
            <Calendar
              month={month}
              days={dayMap}
              selectedDate={effectiveCalendarDate}
              onSelect={setSelectedDate}
              onSwipeLeft={handleNextMonth}
              onSwipeRight={handlePrevMonth}
              today={today}
            />
          </div>

          {dayLogsQuery.isPending ? (
            <LoadingState />
          ) : dayLogsQuery.error ? (
            <ErrorState
              error={dayLogsQuery.error}
              onRetry={() => void dayLogsQuery.refetch()}
            />
          ) : dayLogs.length === 0 ? (
            <p className="py-6 text-center text-body text-ink-3">
              이 날에는 기록이 없습니다.
            </p>
          ) : (
            <DayList
              date={effectiveCalendarDate}
              logs={dayLogs}
              entryLabels={dayEntryLabels}
              recipeLabels={recipeLabels}
              variant="mobile"
            />
          )}
        </>
      )}
    </div>
  );

  return (
    <Shell wide stack className="max-w-[1080px]">
      <div
        className={
          showAside
            ? "grid grid-cols-1 gap-6 min-[1024px]:grid-cols-[minmax(0,1fr)_280px] min-[1024px]:items-start min-[1024px]:gap-x-[40px] min-[1024px]:gap-y-6 min-[1280px]:grid-cols-[minmax(0,1fr)_300px]"
            : "grid grid-cols-1 gap-6"
        }
      >
        <div className="min-[1024px]:col-start-1 min-[1024px]:row-start-1">
          {pageHeader}
        </div>

        {showAside && (
          <aside className="flex flex-col gap-[14px] min-[1024px]:col-start-2 min-[1024px]:row-span-2 min-[1024px]:pt-[70px]">
            <div className="flex flex-col gap-3 rounded-[12px] border border-border p-4">
              {calendar.isPending ? (
                <LoadingState />
              ) : calendar.error ? (
                <ErrorState
                  error={calendar.error}
                  onRetry={() => void calendar.refetch()}
                />
              ) : (
                <>
                  <MonthNav
                    month={month}
                    totalCount={calendar.data.totalCount}
                    activeDays={calendar.data.days.length}
                    onPrev={handlePrevMonth}
                    onNext={handleNextMonth}
                  />
                  <Calendar
                    month={month}
                    days={dayMap}
                    selectedDate={
                      selectedDate !== null && selectedDate.startsWith(month)
                        ? selectedDate
                        : null
                    }
                    onSelect={handleSidebarDateSelect}
                    onSwipeLeft={handleNextMonth}
                    onSwipeRight={handlePrevMonth}
                    compact
                    collapsedWeek={isTablet && !tabletExpanded}
                    onExpandWeek={() => setTabletExpanded(true)}
                    today={today}
                  />
                </>
              )}
            </div>
            <p className="hidden text-[12.5px] leading-[1.6] text-ink-3 min-[1024px]:block">
              날짜를 누르면 왼쪽 목록이 그 날로 스크롤됩니다.
            </p>
          </aside>
        )}

        {mode === "calendar" ? (
          <div className={isWide ? "w-full max-w-[720px]" : "w-full"}>
            {calendarSection}
          </div>
        ) : (
          <div className="min-w-0 min-[1024px]:col-start-1 min-[1024px]:row-start-2">
            {listLogs.length === 0 ? (
              <div data-empty className="flex flex-col gap-3">
                <p className="py-6 text-center text-body text-ink-3">
                  아직 기록이 없습니다
                </p>
                <Button variant="primary" onClick={() => openQuickBrew("record")}>
                  기록하기
                </Button>
              </div>
            ) : (
              <div className="flex flex-col">
                <BrewLedger
                  groups={groupedLogs}
                  isWide={isWide}
                  today={today}
                  recipeLabels={recipeLabels}
                  beanSources={beanSources}
                  registerDateGroupRef={registerDateGroupRef}
                />
                {hasNextPage && (
                  <div className="flex justify-center pt-[10px]">
                    <button
                      type="button"
                      onClick={() => void fetchNextPage()}
                      disabled={isFetchingNextPage}
                      className="hit-44 border-b border-border pb-[2px] text-[13.5px] text-ink-2 disabled:text-ink-3"
                    >
                      더 보기
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Shell>
  );
}
