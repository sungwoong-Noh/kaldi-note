"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ErrorState } from "@/components/ErrorState";
import { useRequireSession } from "@/features/auth/useRequireSession";
import { BREW_LOG_PAGE_SIZE, fetchBrewLogPage } from "@/features/brewlog/api";
import { BrewLogCard } from "@/features/brewlog/components/BrewLogCard";
import { useRecipeTitles } from "@/features/brewlog/useRecipeTitles";

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
  const titles = useRecipeTitles(logs, ready, onSessionLost);

  if (!ready || isPending) {
    return <Shell>{null}</Shell>;
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
        <p className="py-12 text-center text-sm text-neutral-500">
          아직 기록이 없습니다
        </p>
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
            recipeTitle={titles.get(log.recipeId)}
          />
        ))}
      </ul>

      {hasNextPage && (
        <button
          type="button"
          onClick={() => void fetchNextPage()}
          disabled={isFetchingNextPage}
          className="mt-4 w-full rounded-md border border-neutral-300 py-2.5 text-sm disabled:opacity-50 dark:border-neutral-700"
        >
          더 보기
        </button>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">브루잉 로그</h1>
        <Link href="/recipes" className="text-sm text-neutral-500">
          레시피
        </Link>
      </div>
      {children}
    </main>
  );
}
