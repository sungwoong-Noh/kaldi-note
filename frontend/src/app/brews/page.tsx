"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Suspense } from "react";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { useRequireSession } from "@/features/auth/useRequireSession";
import {
  BREW_LOG_PAGE_SIZE,
  fetchBrewLogPage,
  fetchBrewLogStats,
} from "@/features/brewlog/api";
import { LedgerList, LedgerTable } from "@/features/brewlog/components/BrewLedger";
import { StatsCards } from "@/features/brewlog/components/StatsCards";
import { useRecipeLabels } from "@/features/brewlog/useRecipeLabels";
import {
  MY_CUPS_FILTERS,
  toListFilter,
  useMyCupsFilter,
} from "@/features/brewlog/useMyCupsFilter";
import { useMe } from "@/features/user/queries";
import { PillFilter } from "@/components/kit";
import { useViewportWidth } from "@/lib/useViewportWidth";
import { Button, ButtonLink, Shell } from "@/components/ui";

/** 레시피 목록과 같은 기준이다 — ≥760px가 웹(테이블), 그 아래가 모바일(2줄 원장). */
const WEB_BREAKPOINT_PX = 760;

/** `useSearchParams()`가 CSR bailout을 일으키므로 Next가 요구하는 Suspense 경계를 둔다. */
export default function BrewsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <BrewsPageContent />
    </Suspense>
  );
}

function BrewsPageContent() {
  const { ready, onSessionLost } = useRequireSession();
  const me = useMe(onSessionLost);
  const { filter, setFilter } = useMyCupsFilter();
  // 「내 잔」은 본인 것만이다 — userId 없이 부르면 맞팔 친구의 잔까지 섞인다(AC-MYCUPS-01).
  const listFilter = { userId: me.data?.id, ...toListFilter(filter) };
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
    queryKey: ["brew-logs", "mine", listFilter],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      fetchBrewLogPage(
        pageParam,
        BREW_LOG_PAGE_SIZE,
        onSessionLost,
        listFilter,
      ),
    getNextPageParam: (lastPage) =>
      lastPage.hasNext ? lastPage.page + 1 : undefined,
    enabled: ready && me.data !== undefined,
  });

  const logs = data?.pages.flatMap((page) => page.content) ?? [];
  const labels = useRecipeLabels(logs, ready, onSessionLost);

  const pills = (
    <PillFilter
      label="내 잔 필터"
      options={MY_CUPS_FILTERS}
      value={filter}
      onChange={setFilter}
    />
  );

  // me가 실패하면 목록은 영영 enabled가 되지 않는다 — 로딩에 갇히지 않게 먼저 본다.
  if (me.error) {
    return (
      <Screen>
        <ErrorState error={me.error} onRetry={() => void me.refetch()} />
      </Screen>
    );
  }

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
        {pills}

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
      {pills}

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

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <Shell wide>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-page-title font-semibold">내 잔</h1>
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
