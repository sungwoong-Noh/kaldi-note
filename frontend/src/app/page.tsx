"use client";

import { useState } from "react";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { Shell, ButtonLink } from "@/components/ui";
import { useRequireSession } from "@/features/auth/useRequireSession";
import { useCalendar, useDayLogs, useMutualFollows } from "@/features/calendar/api";
import { Calendar, type CalendarDayInfo } from "@/features/calendar/components/Calendar";
import { DayList } from "@/features/calendar/components/DayList";
import { FollowRail } from "@/features/calendar/components/FollowRail";
import { MonthNav } from "@/features/calendar/components/MonthNav";
import type { BrewLogSummary } from "@/features/brewlog/schema";
import { useRecipeLabels } from "@/features/brewlog/useRecipeLabels";
import { addMonths, kstMonthOf, kstToday } from "@/lib/kstDate";
import { useMe } from "@/features/user/queries";

export default function HomePage() {
  const { ready, onSessionLost } = useRequireSession();
  const me = useMe(onSessionLost);
  const mutuals = useMutualFollows(onSessionLost);

  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(() => kstMonthOf(kstToday()));
  const [selectedDate, setSelectedDate] = useState<string | null>(() => kstToday());

  const meId = me.data?.id ?? null;
  const effectiveUserId = selectedUserId ?? meId;
  const isMine = effectiveUserId === null || effectiveUserId === meId;
  const calendarUserId = isMine ? undefined : (effectiveUserId ?? undefined);

  const calendar = useCalendar(calendarUserId, selectedMonth, onSessionLost);
  // 이전 달 프리페치. 화면에 쓰지 않고 캐시에만 얹는다(AC-HOMECAL-50).
  useCalendar(calendarUserId, addMonths(selectedMonth, -1), onSessionLost);

  const dayLogs = useDayLogs(calendarUserId, selectedDate, onSessionLost);
  const logs = dayLogs.data?.content ?? [];
  const recipeLabels = useRecipeLabels(
    logs,
    ready && selectedDate !== null,
    onSessionLost,
  );

  const ownerNickname = isMine
    ? undefined
    : mutuals.data?.find((profile) => profile.id === effectiveUserId)?.nickname;

  function handleSelectUser(userId: number) {
    setSelectedUserId(userId);
    const today = kstToday();
    setSelectedDate(kstMonthOf(today) === selectedMonth ? today : null);
  }

  function handlePrevMonth() {
    setSelectedMonth((month) => addMonths(month, -1));
    setSelectedDate(null);
  }

  function handleNextMonth() {
    // 버튼은 disabled로 이번 달 이후를 막지만, 스와이프는 같은 함수를 타므로 여기서도
    // 막아야 한다 — 그러지 않으면 스와이프로 미래 달까지 넘어간다.
    if (selectedMonth === kstMonthOf(kstToday())) return;
    setSelectedMonth((month) => addMonths(month, 1));
    setSelectedDate(null);
  }

  if (!ready || me.isPending) {
    return (
      <Shell>
        <LoadingState />
      </Shell>
    );
  }

  if (me.error) {
    return (
      <Shell>
        <ErrorState error={me.error} onRetry={() => void me.refetch()} />
      </Shell>
    );
  }

  if (me.data === undefined) {
    // isPending이 false이고 error도 없다면 항상 성립한다 — 타입을 좁히기 위한 경계다.
    return null;
  }

  const days = new Map<string, CalendarDayInfo>(
    (calendar.data?.days ?? []).map((day) => [
      day.date,
      { count: day.count, primaryRecipeName: day.primaryRecipeName },
    ]),
  );

  return (
    <Shell stack>
      <FollowRail
        me={me.data}
        mutuals={mutuals.data ?? []}
        selectedUserId={effectiveUserId ?? me.data.id}
        onSelect={handleSelectUser}
      />

      <MonthNav
        month={selectedMonth}
        totalCount={calendar.data?.totalCount ?? 0}
        ownerNickname={ownerNickname}
        onPrev={handlePrevMonth}
        onNext={handleNextMonth}
      />

      <Calendar
        month={selectedMonth}
        days={days}
        selectedDate={selectedDate}
        onSelect={setSelectedDate}
        onSwipeLeft={handleNextMonth}
        onSwipeRight={handlePrevMonth}
        variant="mobile"
      />

      {selectedDate !== null && (
        <DaySection
          date={selectedDate}
          logs={logs}
          isPending={dayLogs.isPending}
          recipeLabels={recipeLabels}
          ownerNickname={ownerNickname}
        />
      )}

      {/*
        /brews/new는 recipeId를 필수로 받는다 — 캘린더 홈에는 「이 레시피」라고 부를
        특정 레시피가 없어 레시피 선택부터 시작한다(docs/specs/2026-09-19-home-calendar.md
        「구현 중 정정」).
      */}
      <ButtonLink href="/recipes" variant="primary" block>
        기록하기
      </ButtonLink>
    </Shell>
  );
}

function DaySection({
  date,
  logs,
  isPending,
  recipeLabels,
  ownerNickname,
}: {
  date: string;
  logs: BrewLogSummary[];
  isPending: boolean;
  recipeLabels: Map<number, string>;
  ownerNickname?: string;
}) {
  if (isPending) return null;

  if (logs.length === 0) {
    return (
      <p className="rounded-control border-l-2 border-divider-strong bg-surface px-3 py-2 text-body-sm">
        이 날에는 기록이 없습니다.
      </p>
    );
  }

  return (
    <DayList
      date={date}
      logs={logs}
      recipeLabels={recipeLabels}
      ownerNickname={ownerNickname}
      variant="mobile"
    />
  );
}
