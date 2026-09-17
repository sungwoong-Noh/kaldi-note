"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { useRequireSession } from "@/features/auth/useRequireSession";
import { BREW_LOG_PAGE_SIZE, fetchBrewLogPage } from "@/features/brewlog/api";
import { BrewLogCard } from "@/features/brewlog/components/BrewLogCard";
import { useRecipeLabels } from "@/features/brewlog/useRecipeLabels";
import { Button, ButtonLink, Shell } from "@/components/ui";

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

  if (logs.length === 0) {
    return (
      <Screen>
        {/* 빈 화면은 다음 행동을 제안한다 — docs/specs/2026-09-15-structure.md */}
        <div data-empty className="flex flex-col gap-3">
          <p className="py-6 text-center text-body text-ink-3">
            아직 기록이 없습니다
          </p>
          <ButtonLink href="/recipes" variant="primary">
            레시피 보러 가기
          </ButtonLink>
        </div>
      </Screen>
    );
  }

  return (
    <Screen>
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
