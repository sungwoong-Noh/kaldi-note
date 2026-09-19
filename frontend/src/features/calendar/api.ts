"use client";

import { useQuery } from "@tanstack/react-query";
import { brewLogPageSchema } from "@/features/brewlog/schema";
import { backendUrl } from "@/lib/api-client";
import { authedRequest } from "@/lib/authed-fetch";
import { calendarSchema, mutualFollowListSchema } from "./schema";

const DAY_LOGS_SIZE = 100;

/**
 * 월별 기록일 집계. `userId`가 없으면 서버가 호출자 본인의 달력을 준다.
 *
 * <p>캐시 키가 `(userId, month)`다 — 월을 앞뒤로 오갈 때 재요청하지 않는다
 * (docs/specs/2026-09-19-home-calendar.md).
 */
export function useCalendar(
  userId: number | undefined,
  month: string,
  onSessionLost?: () => void,
) {
  return useQuery({
    queryKey: ["calendar", userId ?? "me", month],
    queryFn: () =>
      authedRequest(backendUrl(`/api/v1/brew-logs/calendar?${calendarQuery(userId, month)}`), {
        schema: calendarSchema,
        onSessionLost,
      }),
  });
}

function calendarQuery(userId: number | undefined, month: string): string {
  const params = new URLSearchParams({ month });
  if (userId !== undefined) params.set("userId", String(userId));
  return params.toString();
}

/** 레일에 세울 맞팔로우 목록. 마지막 기록이 최근인 순 — 정렬은 서버가 끝낸다. */
export function useMutualFollows(onSessionLost?: () => void) {
  return useQuery({
    queryKey: ["mutual-follows"],
    queryFn: () =>
      authedRequest(backendUrl("/api/v1/users/me/mutual-follows"), {
        schema: mutualFollowListSchema,
        onSessionLost,
      }),
    staleTime: 5 * 60 * 1000,
  });
}

/** 선택된 날짜의 기록. `date`가 없으면 부르지 않는다 — 날짜를 고르기 전에는 목록이 없다. */
export function useDayLogs(
  userId: number | undefined,
  date: string | null,
  onSessionLost?: () => void,
) {
  return useQuery({
    queryKey: ["brew-logs", "day", userId ?? "me", date],
    enabled: date !== null,
    queryFn: () =>
      authedRequest(
        backendUrl(`/api/v1/brew-logs?${dayLogsQuery(userId, date as string)}`),
        { schema: brewLogPageSchema, onSessionLost },
      ),
  });
}

function dayLogsQuery(userId: number | undefined, date: string): string {
  const params = new URLSearchParams({ date, size: String(DAY_LOGS_SIZE) });
  if (userId !== undefined) params.set("userId", String(userId));
  return params.toString();
}
