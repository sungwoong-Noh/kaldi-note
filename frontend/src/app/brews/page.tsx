"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { useRequireSession } from "@/features/auth/useRequireSession";
import { BREW_LOG_PAGE_SIZE, fetchBrewLogPage } from "@/features/brewlog/api";
import { BrewLogCard } from "@/features/brewlog/components/BrewLogCard";
import { useRecipeLabels } from "@/features/brewlog/useRecipeLabels";

export default function BrewsPage() {
  const { ready, onSessionLost } = useRequireSession();

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

  if (!ready || isPending) {
    return (
      <Shell>
        <LoadingState />
      </Shell>
    );
  }

  if (error) {
    return (
      <Shell>
        <ErrorState error={error} onRetry={() => void refetch()} />
      </Shell>
    );
  }

  if (logs.length === 0) {
    return (
      <Shell>
        {/* 빈 화면은 다음 행동을 제안한다 — docs/specs/2026-09-15-structure.md */}
        <div data-empty className="flex flex-col gap-3">
          <p className="py-6 text-center text-body text-ink-3">
            아직 기록이 없습니다
          </p>
          <Link
            href="/recipes"
            className="flex min-h-11 items-center justify-center rounded-control bg-accent py-3 text-center text-body text-on-ink"
          >
            레시피 보러 가기
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <ul className="flex flex-col gap-3">
        {logs.map((log) => (
          <BrewLogCard
            key={log.id}
            log={log}
            recipeLabel={labels.get(log.recipeId) ?? ""}
          />
        ))}
      </ul>

      {hasNextPage && (
        <button
          type="button"
          onClick={() => void fetchNextPage()}
          disabled={isFetchingNextPage}
          className="flex min-h-11 min-w-11 items-center justify-center mt-4 w-full rounded-control border border-border py-3 text-body disabled:opacity-50"
        >
          더 보기
        </button>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-page-title font-semibold">브루잉 로그</h1>
        <Link href="/recipes" className="inline-flex min-h-11 min-w-11 items-center justify-center text-body text-ink-3">
          레시피
        </Link>
      </div>
      {children}
    </main>
  );
}
