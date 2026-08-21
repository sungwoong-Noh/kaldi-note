"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { ErrorState } from "@/components/ErrorState";
import { useRequireSession } from "@/features/auth/useRequireSession";
import { fetchRecipePage } from "@/features/recipe/api";
import { RecipeCard } from "@/features/recipe/components/RecipeCard";

export default function RecipesPage() {
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
    queryKey: ["recipes"],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchRecipePage(pageParam, onSessionLost),
    // 봉투의 hasNext가 다음 페이지 존재 여부의 유일한 근거다.
    getNextPageParam: (lastPage) =>
      lastPage.hasNext ? lastPage.page + 1 : undefined,
    enabled: ready,
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

  const recipes = data.pages.flatMap((page) => page.content);

  if (recipes.length === 0) {
    return (
      <Shell>
        <p className="py-12 text-center text-sm text-neutral-500">
          레시피가 없습니다
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <ul className="flex flex-col gap-3">
        {recipes.map((recipe) => (
          <RecipeCard key={recipe.id} recipe={recipe} />
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
      <h1 className="mb-4 text-xl font-semibold">레시피</h1>
      {children}
    </main>
  );
}
