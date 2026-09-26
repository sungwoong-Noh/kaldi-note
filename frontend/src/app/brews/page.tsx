"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { useRequireSession } from "@/features/auth/useRequireSession";
import {
  BREW_LOG_PAGE_SIZE,
  fetchBrewLogPage,
  fetchBrewLogStats,
} from "@/features/brewlog/api";
import type { BrewLogStats, BrewLogSummary } from "@/features/brewlog/schema";
import { useRecipeLabels } from "@/features/brewlog/useRecipeLabels";
import {
  formatDuration,
  formatGrams,
  formatTemperature,
} from "@/lib/format";
import { toKstDate } from "@/lib/kstDate";
import { useViewportWidth } from "@/lib/useViewportWidth";
import { Button, ButtonLink, Card, cardClass, Shell } from "@/components/ui";

/** 레시피 목록과 같은 기준이다 — ≥760px가 웹(테이블), 그 아래가 모바일(2줄 원장). */
const WEB_BREAKPOINT_PX = 760;

export default function BrewsPage() {
  const { ready, onSessionLost } = useRequireSession();
  const width = useViewportWidth();
  const isMobile = width !== null && width < WEB_BREAKPOINT_PX;

  const stats = useQuery({
    queryKey: ["brew-logs", "stats"],
    queryFn: () => fetchBrewLogStats(onSessionLost),
    enabled: ready,
  });

  const {
    data,
    error,
    isPending,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["brew-logs"],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      fetchBrewLogPage(pageParam, BREW_LOG_PAGE_SIZE, onSessionLost),
    getNextPageParam: (lastPage) =>
      lastPage.hasNext ? lastPage.page + 1 : undefined,
    enabled: ready,
  });

  const logs = data?.pages.flatMap((page) => page.content) ?? [];
  const labels = useRecipeLabels(logs, ready, onSessionLost);

  if (!ready || isPending || stats.isPending) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <ErrorState error={error} onRetry={() => void refetch()} />
      </Screen>
    );
  }

  if (stats.error) {
    return (
      <Screen>
        <ErrorState error={stats.error} onRetry={() => void stats.refetch()} />
      </Screen>
    );
  }

  if (logs.length === 0) {
    return (
      <Screen>
        {/* 0건이어도 통계는 보여준다 — 이번 달만 0잔, 나머지는 —(AC-RECIPESBREWS-86). */}
        <StatsCards stats={stats.data} isMobile={isMobile} />

        {/* 빈 화면은 다음 행동을 제안한다 — docs/specs/2026-09-15-structure.md.
            기록은 레시피를 고른 뒤 시작하므로 recipeId 없이 작성 화면을 열 수 없다
            (AC-RECIPESBREWS-86) — /brews/new가 아니라 /recipes로 보낸다. */}
        <div data-empty className="flex flex-col gap-3">
          <p className="py-6 text-center text-body text-ink-3">
            아직 기록이 없습니다
          </p>
          <ButtonLink href="/recipes" variant="primary">
            기록하기
          </ButtonLink>
        </div>
      </Screen>
    );
  }

  return (
    <Screen>
      <StatsCards stats={stats.data} isMobile={isMobile} />

      {isMobile ? (
        <LedgerList logs={logs} labels={labels} />
      ) : (
        <LedgerTable logs={logs} labels={labels} />
      )}

      {hasNextPage && (
        <Button
          onClick={() => void fetchNextPage()}
          disabled={isFetchingNextPage}
          block
        >
          더 보기
        </Button>
      )}
    </Screen>
  );
}

/** 이번 달·평균 별점·최빈 원두량·즐겨 쓴 레시피(AC-RECIPESBREWS-76). 모바일은 앞 2칸만. */
function StatsCards({
  stats,
  isMobile,
}: {
  stats: BrewLogStats;
  isMobile: boolean;
}) {
  return (
    <div
      className={`mb-4 grid gap-3 ${isMobile ? "grid-cols-2" : "grid-cols-4"}`}
    >
      <StatCard label="이번 달" value={`${stats.monthCount}잔`} />
      <StatCard
        label="평균 별점"
        value={
          stats.averageRating !== undefined ? `★ ${stats.averageRating}` : "—"
        }
      />
      {!isMobile && (
        <StatCard
          label="최빈 원두량"
          value={
            stats.favoriteDoseG !== undefined
              ? formatGrams(stats.favoriteDoseG)
              : "—"
          }
        />
      )}
      {!isMobile && (
        <StatCard
          label="즐겨 쓴 레시피"
          value={stats.favoriteRecipeTitle ?? "—"}
        />
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card pad="tight">
      <p className="text-body-sm text-ink-3">{label}</p>
      <p className="mt-1 text-metric font-semibold">{value}</p>
    </Card>
  );
}

/** 웹(≥760px) — 날짜·레시피/원두·원두량·온도·시간·수율·평가 7열(AC-RECIPESBREWS-77). */
function LedgerTable({
  logs,
  labels,
}: {
  logs: BrewLogSummary[];
  labels: Map<number, string>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-body">
        <thead>
          <tr className="text-left text-body-sm text-ink-3">
            <th className="pb-2 font-normal">날짜</th>
            <th className="pb-2 font-normal">레시피/원두</th>
            <th className="pb-2 font-normal">원두량</th>
            <th className="pb-2 font-normal">온도</th>
            <th className="pb-2 font-normal">시간</th>
            <th className="hidden pb-2 font-normal min-[1024px]:table-cell">
              수율
            </th>
            <th className="pb-2 font-normal">평가</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="border-t border-border">
              <td className="py-2">{toKstDate(log.brewedAt)}</td>
              <td className="py-2">
                <Link href={`/brews/${log.id}`} className="underline">
                  {labels.get(log.recipeId) ?? ""}
                </Link>
              </td>
              <td className="py-2">{formatGrams(log.actualDoseG)}</td>
              <td className="py-2">
                {formatTemperature(log.actualWaterTempC)}
              </td>
              <td className="py-2">
                {log.actualTotalTimeSeconds !== undefined
                  ? formatDuration(log.actualTotalTimeSeconds)
                  : "—"}
              </td>
              <td className="hidden py-2 min-[1024px]:table-cell">
                {log.extractionYieldPercent !== undefined
                  ? `${log.extractionYieldPercent}%`
                  : "—"}
              </td>
              <td className="py-2">
                {log.rating !== undefined ? (
                  <>
                    <span aria-hidden>★</span> <span>{log.rating}</span>
                  </>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 모바일(<760px) — 2줄 원장 행(AC-RECIPESBREWS-77). */
function LedgerList({
  logs,
  labels,
}: {
  logs: BrewLogSummary[];
  labels: Map<number, string>;
}) {
  return (
    <ul className="flex flex-col gap-3">
      {logs.map((log) => (
        <li key={log.id}>
          <Link
            href={`/brews/${log.id}`}
            className={cardClass("block active:bg-surface")}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium">
                {labels.get(log.recipeId) ?? ""}
              </span>
              <span className="text-metric">
                {formatGrams(log.actualDoseG)}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-ink-3">
              <span>{toKstDate(log.brewedAt)}</span>
              <span>{formatTemperature(log.actualWaterTempC)}</span>
              {log.actualTotalTimeSeconds !== undefined && (
                <span>{formatDuration(log.actualTotalTimeSeconds)}</span>
              )}
              {log.extractionYieldPercent !== undefined && (
                <span>{log.extractionYieldPercent}%</span>
              )}
              {log.rating !== undefined && (
                <span>
                  <span aria-hidden>★</span> <span>{log.rating}</span>
                </span>
              )}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <Shell>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-page-title font-semibold">브루잉 로그</h1>
        <Link
          href="/recipes"
          className="inline-flex min-h-11 min-w-11 items-center justify-center text-body text-ink-3"
        >
          레시피
        </Link>
      </div>
      {children}
    </Shell>
  );
}
