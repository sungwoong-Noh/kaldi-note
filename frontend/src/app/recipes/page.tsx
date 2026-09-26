"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { useRequireSession } from "@/features/auth/useRequireSession";
import { searchRecipes } from "@/features/recipe/api";
import { RecipeCard } from "@/features/recipe/components/RecipeCard";
import { DrawerFilters } from "@/features/recipe/components/DrawerFilters";
import { ExploreFilters } from "@/features/recipe/components/ExploreFilters";
import { SegmentTabs } from "@/features/recipe/components/SegmentTabs";
import {
  toSearchFilter,
  useRecipeSearchState,
  type RecipeSearchState,
} from "@/features/recipe/useRecipeSearchState";
import { Button, ButtonLink, Card, Shell } from "@/components/ui";

/** `useSearchParams()`가 CSR bailout을 일으키므로 Next가 요구하는 Suspense 경계를 둔다. */
export default function RecipesPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <RecipesPageContent />
    </Suspense>
  );
}

function RecipesPageContent() {
  const { ready, onSessionLost } = useRequireSession();
  const { state, setState } = useRecipeSearchState();

  const {
    data,
    error,
    isPending,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery({
    // page는 넣지 않는다 — "더 보기"로 쌓은 페이지 깊이는 URL에도, 쿼리 키에도 반영하지 않는다
    // (AC-RECIPESBREWS-67). 나머지 필터가 바뀌면 키가 바뀌어 0페이지부터 다시 받는다
    // (AC-RECIPESBREWS-68).
    queryKey: ["recipes", state],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      searchRecipes(pageParam, onSessionLost, toSearchFilter(state)),
    getNextPageParam: (lastPage) =>
      lastPage.hasNext ? lastPage.page + 1 : undefined,
    enabled: ready,
  });

  if (!ready || isPending) {
    return (
      <Screen state={state} setState={setState} onSessionLost={onSessionLost}>
        <LoadingState />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen state={state} setState={setState} onSessionLost={onSessionLost}>
        <ErrorState error={error} onRetry={() => void refetch()} />
      </Screen>
    );
  }

  const recipes = data.pages.flatMap((page) => page.content);

  if (recipes.length === 0) {
    return (
      <Screen state={state} setState={setState} onSessionLost={onSessionLost}>
        {state.scope === "PUBLIC" ? (
          // 검색·필터가 너무 좁았을 뿐 서랍이 빈 것과는 다르다(AC-RECIPESBREWS-84).
          <Card data-empty className="border-dashed text-center">
            <p className="text-body font-medium">찾는 레시피가 없나요?</p>
            <p className="mt-1 text-body-sm text-ink-3">
              검색어를 줄이거나 필터를 해제해 보세요.
            </p>
          </Card>
        ) : (
          // 빈 화면은 다음 행동을 제안한다 — docs/specs/2026-09-15-structure.md
          <div data-empty className="flex flex-col gap-3">
            <p className="py-6 text-center text-body text-ink-3">
              레시피가 없습니다
            </p>
            <ButtonLink href="/recipes/new" variant="primary">
              새 레시피
            </ButtonLink>
          </div>
        )}
      </Screen>
    );
  }

  return (
    <Screen state={state} setState={setState} onSessionLost={onSessionLost}>
      {/*
        반응형 4구간(AC-RECIPESBREWS-88~93): <760 1열, 760~1023 2열, 1024~1279 3열,
        ≥1280 4열.
      */}
      <ul className="grid grid-cols-1 gap-3 min-[760px]:grid-cols-2 min-[1024px]:grid-cols-3 min-[1280px]:grid-cols-4">
        {recipes.map((recipe) => (
          <RecipeCard key={recipe.id} recipe={recipe} scope={state.scope} />
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
  state,
  setState,
  onSessionLost,
}: {
  children: React.ReactNode;
  state: RecipeSearchState;
  setState: (patch: Partial<RecipeSearchState>) => void;
  onSessionLost: () => void;
}) {
  return (
    <Shell>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-page-title font-semibold">레시피</h1>
        <ButtonLink href="/recipes/new" variant="primary">
          새 레시피
        </ButtonLink>
      </div>

      <SegmentTabs state={state} setState={setState} />

      {state.scope === "PUBLIC" && (
        <ExploreFilters
          state={state}
          setState={setState}
          onSessionLost={onSessionLost}
        />
      )}

      {state.scope === "DRAWER" && (
        <DrawerFilters state={state} setState={setState} />
      )}

      {children}
    </Shell>
  );
}
