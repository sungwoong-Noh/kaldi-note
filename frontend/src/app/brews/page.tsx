"use client";

import { useInfiniteQuery, useQueries } from "@tanstack/react-query";
import Link from "next/link";
import { ErrorState } from "@/components/ErrorState";
import { useRequireSession } from "@/features/auth/useRequireSession";
import { BREW_LOG_PAGE_SIZE, fetchBrewLogPage } from "@/features/brewlog/api";
import { BrewLogCard } from "@/features/brewlog/components/BrewLogCard";
import { fetchRecipe } from "@/features/recipe/api";

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

  /**
   * 목록 응답에 레시피 제목이 없어 `recipeId`마다 따로 읽는다.
   *
   * <p>같은 레시피를 여러 번 내린 것이 이 서비스의 전제라 **중복 id를 제거하면 대개 한두 번으로 줄고**,
   * `staleTime`을 길게 둬서 페이지를 더 불러와도 이미 읽은 레시피는 다시 나가지 않는다.
   */
  const recipeIds = [...new Set(logs.map((log) => log.recipeId))];
  const recipeQueries = useQueries({
    queries: recipeIds.map((id) => ({
      queryKey: ["recipe", id],
      queryFn: () => fetchRecipe(id, onSessionLost),
      staleTime: 5 * 60 * 1000,
      enabled: ready,
    })),
  });

  const titles = new Map<number, string>();
  recipeIds.forEach((id, index) => {
    const title = recipeQueries[index]?.data?.title;
    if (title !== undefined) titles.set(id, title);
  });

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
