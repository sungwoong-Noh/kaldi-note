"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ErrorState } from "@/components/ErrorState";
import { Shell } from "@/components/ui";
import { useRequireSession } from "@/features/auth/useRequireSession";
import { fetchBrewLogPage } from "@/features/brewlog/api";
import { TodayHome } from "@/features/brewlog/components/TodayHome";
import { TodaySkeleton } from "@/features/brewlog/components/TodaySkeleton";
import { useTodayMetadata } from "@/features/brewlog/useTodayMetadata";
import {
  weekCalendarMonths,
  weekSummary,
} from "@/features/brewlog/weekSummary";
import { useCalendar } from "@/features/calendar/api";
import { useMe } from "@/features/user/queries";
import { kstToday } from "@/lib/kstDate";

const SKELETON_DELAY_MS = 300;
const HOME_RECENT_SIZE = 5;

export default function HomePage() {
  const { ready, onSessionLost } = useRequireSession();
  const me = useMe(onSessionLost);
  const todayKst = kstToday();
  const months = weekCalendarMonths(todayKst);

  const logsQuery = useQuery({
    queryKey: ["brew-logs", "home", me.data?.id],
    queryFn: () =>
      fetchBrewLogPage(0, HOME_RECENT_SIZE, onSessionLost, {
        userId: me.data?.id,
      }),
    enabled: ready && me.data !== undefined,
  });

  // 훅 호출 순서를 고정하기 위해 두 번째 달이 필요 없으면 첫째 달 키를 재사용한다(TanStack Query 중복 제거).
  const cal1 = useCalendar(undefined, months[0], onSessionLost);
  const cal2 = useCalendar(undefined, months[1] ?? months[0], onSessionLost);

  const isLoading =
    !ready ||
    me.isPending ||
    (me.isSuccess &&
      (logsQuery.isPending ||
        cal1.isPending ||
        (months.length === 2 && cal2.isPending)));

  const [skeletonShown, setSkeletonShown] = useState(false);

  useEffect(() => {
    if (!isLoading) return;
    const timer = window.setTimeout(() => {
      setSkeletonShown(true);
    }, SKELETON_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [isLoading]);

  const logs = logsQuery.data?.content ?? [];
  const metadata = useTodayMetadata(logs, logsQuery.isSuccess, onSessionLost);

  const calendarDays =
    months.length === 2
      ? [...(cal1.data?.days ?? []), ...(cal2.data?.days ?? [])]
      : [...(cal1.data?.days ?? [])];
  const week = weekSummary(todayKst, calendarDays);

  const error =
    me.error ??
    logsQuery.error ??
    cal1.error ??
    (months.length === 2 ? cal2.error : null);

  if (error) {
    return (
      <Shell wide>
        <ErrorState
          error={error}
          onRetry={() => {
            if (me.error) void me.refetch();
            if (logsQuery.error) void logsQuery.refetch();
            if (cal1.error) void cal1.refetch();
            if (months.length === 2 && cal2.error) void cal2.refetch();
          }}
        />
      </Shell>
    );
  }

  if (isLoading) {
    const showSkeleton = skeletonShown;
    return <Shell wide>{showSkeleton ? <TodaySkeleton /> : null}</Shell>;
  }

  return (
    <Shell wide>
      <TodayHome
        todayKst={todayKst}
        logs={logs}
        week={week}
        metadata={metadata}
        fadeIn={skeletonShown}
      />
    </Shell>
  );
}
