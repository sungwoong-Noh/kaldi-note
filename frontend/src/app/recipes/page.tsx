"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ErrorState } from "@/components/ErrorState";
import { useRequireSession } from "@/features/auth/useRequireSession";
import { fetchRecipePage } from "@/features/recipe/api";
import { RecipeCard } from "@/features/recipe/components/RecipeCard";
import { useMe } from "@/features/user/queries";
import { Button, ButtonLink, Shell } from "@/components/ui";

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
      <Screen mineOnly={mineOnly} onMineOnlyChange={setMineOnly}>
        {null}
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen mineOnly={mineOnly} onMineOnlyChange={setMineOnly}>
        <ErrorState error={error} onRetry={() => void refetch()} />
      </Screen>
    );
  }

  const recipes = data.pages.flatMap((page) => page.content);

  if (recipes.length === 0) {
    return (
      <Screen mineOnly={mineOnly} onMineOnlyChange={setMineOnly}>
        {/* 빈 화면은 다음 행동을 제안한다 — docs/specs/2026-09-15-structure.md */}
        <div data-empty className="flex flex-col gap-3">
          <p className="py-6 text-center text-body text-ink-3">
            레시피가 없습니다
          </p>
          <ButtonLink href="/recipes/new" variant="primary">
            새 레시피
          </ButtonLink>
        </div>
      </Screen>
    );
  }

  return (
    <Screen mineOnly={mineOnly} onMineOnlyChange={setMineOnly}>
      <ul className="flex flex-col gap-3">
        {recipes.map((recipe) => (
          <RecipeCard key={recipe.id} recipe={recipe} />
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

function Screen({
  children,
  mineOnly,
  onMineOnlyChange,
}: {
  children: React.ReactNode;
  mineOnly?: boolean;
  onMineOnlyChange?: (value: boolean) => void;
}) {
  return (
    <Shell>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-page-title font-semibold">레시피</h1>
        <ButtonLink href="/recipes/new" variant="primary">
          새 레시피
        </ButtonLink>
      </div>

      {/* 체크박스 모양은 20×20이고 탭 영역은 라벨 전체가 받는다. 네이티브 사각형 자체를
          44px로 키우면 거대한 빈 상자가 된다(docs/specs/2026-09-15-structure.md). */}
      {onMineOnlyChange && (
        <label className="mb-4 flex min-h-11 w-fit items-center gap-2 py-2 text-body">
          <input
            type="checkbox"
            className="size-5 shrink-0 appearance-none rounded-control border border-border checked:border-accent checked:bg-accent"
            checked={mineOnly ?? false}
            onChange={(e) => onMineOnlyChange(e.target.checked)}
          />
          내 레시피만
        </label>
      )}

      {children}
    </Shell>
  );
}
