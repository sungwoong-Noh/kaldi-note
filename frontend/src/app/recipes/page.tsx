"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { ErrorState } from "@/components/ErrorState";
import { useRequireSession } from "@/features/auth/useRequireSession";
import { fetchRecipePage } from "@/features/recipe/api";
import { RecipeCard } from "@/features/recipe/components/RecipeCard";
import { useMe } from "@/features/user/queries";

export default function RecipesPage() {
  const { ready, onSessionLost } = useRequireSession();
  const [mineOnly, setMineOnly] = useState(false);
  const me = useMe(onSessionLost);

  // 내 id를 알기 전에는 필터를 걸 수 없다. 그 전까지는 전체 목록을 보여준다.
  const ownerUserId = mineOnly ? (me.data?.id ?? null) : null;

  const {
    data,
    error,
    isPending,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["recipes", { ownerUserId }],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      fetchRecipePage(pageParam, onSessionLost, { ownerUserId }),
    // 봉투의 hasNext가 다음 페이지 존재 여부의 유일한 근거다.
    getNextPageParam: (lastPage) =>
      lastPage.hasNext ? lastPage.page + 1 : undefined,
    // 필터를 켰는데 내 id를 아직 모르면 기다린다 — 그대로 부르면 전체 목록을 한 번 더 받는다.
    enabled: ready && !(mineOnly && me.data === undefined),
  });

  if (!ready || isPending) {
    return (
      <Shell mineOnly={mineOnly} onMineOnlyChange={setMineOnly}>
        {null}
      </Shell>
    );
  }

  if (error) {
    return (
      <Shell mineOnly={mineOnly} onMineOnlyChange={setMineOnly}>
        <ErrorState error={error} onRetry={() => void refetch()} />
      </Shell>
    );
  }

  const recipes = data.pages.flatMap((page) => page.content);

  if (recipes.length === 0) {
    return (
      <Shell mineOnly={mineOnly} onMineOnlyChange={setMineOnly}>
        <p className="py-12 text-center text-sm text-neutral-500">
          레시피가 없습니다
        </p>
      </Shell>
    );
  }

  return (
    <Shell mineOnly={mineOnly} onMineOnlyChange={setMineOnly}>
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

function Shell({
  children,
  mineOnly,
  onMineOnlyChange,
}: {
  children: React.ReactNode;
  mineOnly?: boolean;
  onMineOnlyChange?: (value: boolean) => void;
}) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">레시피</h1>
        <Link
          href="/recipes/new"
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white"
        >
          새 레시피
        </Link>
      </div>

      {onMineOnlyChange && (
        <label className="mb-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={mineOnly ?? false}
            onChange={(e) => onMineOnlyChange(e.target.checked)}
          />
          내 레시피만
        </label>
      )}

      {children}
    </main>
  );
}
