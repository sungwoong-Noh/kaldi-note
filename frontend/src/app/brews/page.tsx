"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
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
import { useMe, type Me } from "@/features/user/queries";
import { BottomCta, PageHeader, PillFilter } from "@/components/kit";
import { kstToday } from "@/lib/kstDate";
import { useViewportWidth } from "@/lib/useViewportWidth";
import { Avatar, ButtonLink, Shell } from "@/components/ui";

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

  const count = data?.pages[0]?.totalElements;
  const pills = (
    <PillFilter
      label="내 잔 필터"
      options={MY_CUPS_FILTERS}
      value={filter}
      onChange={setFilter}
    />
  );

  const shell = { isMobile, count, me: me.data, pills };

  // me가 실패하면 목록은 영영 enabled가 되지 않는다 — 로딩에 갇히지 않게 먼저 본다.
  if (me.error) {
    return (
      <BrewsScreen {...shell}>
        <ErrorState error={me.error} onRetry={() => void me.refetch()} />
      </BrewsScreen>
    );
  }

  if (!ready || isPending || stats.isPending) {
    return (
      <BrewsScreen {...shell}>
        <LoadingState />
      </BrewsScreen>
    );
  }

  if (error) {
    return (
      <BrewsScreen {...shell}>
        <ErrorState error={error} onRetry={() => void refetch()} />
      </BrewsScreen>
    );
  }

  if (stats.error) {
    return (
      <BrewsScreen {...shell}>
        <ErrorState error={stats.error} onRetry={() => void stats.refetch()} />
      </BrewsScreen>
    );
  }

  const top = (
    <>
      <StatsCards stats={stats.data} isMobile={isMobile} />
      {isMobile && pills}
    </>
  );

  // 걸러서 0건이면 「없다」가 아니라 「조건에 맞는 게 없다」다 — 통계는 그대로 둔다(AC-MYCUPS-18).
  if (logs.length === 0 && filter !== "all") {
    return (
      <BrewsScreen {...shell}>
        {top}
        <div data-empty className="flex flex-col items-center gap-[8px] py-[24px]">
          <p className="text-[14.5px] text-ink-3">조건에 맞는 잔이 없습니다</p>
          <button
            type="button"
            onClick={() => setFilter("all")}
            className="hit-44 border-b border-border pb-[2px] text-[13.5px] text-ink-2"
          >
            전체 보기
          </button>
        </div>
      </BrewsScreen>
    );
  }

  if (logs.length === 0) {
    return (
      <BrewsScreen {...shell}>
        {/* 0건이어도 통계는 보여준다 — 이번 달만 0잔, 나머지는 —(AC-RECIPESBREWS-86). */}
        {top}

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
      </BrewsScreen>
    );
  }

  return (
    <BrewsScreen {...shell}>
      {top}

      {isMobile ? (
        <LedgerList logs={logs} labels={labels} />
      ) : (
        <LedgerTable logs={logs} labels={labels} />
      )}

      {/* 목업 BM1·BW1 — 버튼이 아니라 밑줄 글자다. 페이지를 더 부르는 동작이라 링크가 아니라 button이다. */}
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

      {/* 기록은 레시피를 고른 뒤 시작한다 — /recipes로 보낸다(AC-RECIPESBREWS-86과 같은 이유).
          웹은 상단 바 CTA가 이 자리를 맡는다(AC-GRAMMAR-05). */}
      {isMobile && <BottomCta href="/recipes">기록하기</BottomCta>}
    </BrewsScreen>
  );
}

/**
 * 목업 BM1(모바일)·BW1(웹)의 머리. 모바일은 eyebrow에 개수·오른쪽에 아바타, 웹은 eyebrow에
 * 연도·오른쪽에 알약과 개수다(AC-MYCUPS-06·07). 개수는 현재 필터의 totalElements다.
 */
function BrewsScreen({
  isMobile,
  count,
  me,
  pills,
  children,
}: {
  isMobile: boolean;
  count: number | undefined;
  me: Me | undefined;
  pills: React.ReactNode;
  children: React.ReactNode;
}) {
  const header = isMobile ? (
    <PageHeader
      eyebrow={count === undefined ? "My cups" : `My cups · ${count}`}
      title="내 잔"
      aside={
        me && (
          <span className="text-[13.5px] font-semibold text-ink-2">
            <Avatar
              nickname={me.nickname}
              profileImageUrl={me.profileImageUrl}
              size={36}
              userId={me.id}
            />
          </span>
        )
      }
    />
  ) : (
    <div className="flex items-end justify-between gap-[24px]">
      <PageHeader eyebrow={`My cups · ${kstToday().slice(0, 4)}`} title="내 잔" />
      <div className="flex items-center gap-[10px]">
        {pills}
        {count !== undefined && (
          <>
            <span aria-hidden className="mx-[4px] h-[20px] w-px bg-divider" />
            <span className="font-mono text-[12px] text-ink-3">{`${count}잔`}</span>
          </>
        )}
      </div>
    </div>
  );
  return (
    <Shell wide>
      <div className={`flex flex-col ${isMobile ? "gap-[16px]" : "gap-[24px]"}`}>
        {header}
        {children}
      </div>
    </Shell>
  );
}
