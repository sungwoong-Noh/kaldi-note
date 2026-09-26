"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import {
  Suspense,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CompositionEvent,
} from "react";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { useRequireSession } from "@/features/auth/useRequireSession";
import { searchRecipes } from "@/features/recipe/api";
import { RecipeCard } from "@/features/recipe/components/RecipeCard";
import { FilterSheet } from "@/features/recipe/components/FilterSheet";
import {
  DRIPPER_OPTIONS,
  ROAST_OPTIONS,
  toggleValue,
} from "@/features/recipe/filterOptions";
import {
  toSearchFilter,
  useRecipeSearchState,
  type RecipeSearchState,
} from "@/features/recipe/useRecipeSearchState";
import { useViewportWidth } from "@/lib/useViewportWidth";
import { Button, ButtonLink, Input, Shell } from "@/components/ui";

/** ≥760px는 웹 pill 줄, 그 아래는 모바일 필터 시트다(AC-RECIPESBREWS-61·82). */
const WEB_BREAKPOINT_PX = 760;

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
    <Screen state={state} setState={setState} onSessionLost={onSessionLost}>
      <ul className="flex flex-col gap-3">
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

/** 내 서랍 / 둘러보기. 기본은 내 서랍이다(AC-RECIPESBREWS-58). */
function SegmentTabs({
  state,
  setState,
}: {
  state: RecipeSearchState;
  setState: (patch: Partial<RecipeSearchState>) => void;
}) {
  return (
    <div className="mb-4 flex gap-2" role="tablist">
      <button
        type="button"
        role="tab"
        aria-selected={state.scope === "DRAWER"}
        onClick={() => setState({ scope: "DRAWER" })}
        className="min-h-11 flex-1 rounded-tag border border-border px-3 py-2 text-body font-medium aria-selected:border-ink aria-selected:bg-ink aria-selected:text-on-ink"
      >
        내 서랍
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={state.scope === "PUBLIC"}
        onClick={() => setState({ scope: "PUBLIC" })}
        className="min-h-11 flex-1 rounded-tag border border-border px-3 py-2 text-body font-medium aria-selected:border-ink aria-selected:bg-ink aria-selected:text-on-ink"
      >
        둘러보기
      </button>
    </div>
  );
}

/** 내 서랍의 소유 필터 pill — 전체 / 내가 만든 / 담아온(AC-RECIPESBREWS-63). */
function DrawerFilters({
  state,
  setState,
}: {
  state: RecipeSearchState;
  setState: (patch: Partial<RecipeSearchState>) => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="소유">
      <button
        type="button"
        aria-pressed={state.owner === undefined}
        onClick={() => setState({ owner: undefined })}
        className="min-h-11 rounded-tag border border-border px-3 py-2 text-body-sm aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-on-ink"
      >
        전체
      </button>
      <button
        type="button"
        aria-pressed={state.owner === "MINE"}
        onClick={() =>
          setState({ owner: state.owner === "MINE" ? undefined : "MINE" })
        }
        className="min-h-11 rounded-tag border border-border px-3 py-2 text-body-sm aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-on-ink"
      >
        내가 만든
      </button>
      <button
        type="button"
        aria-pressed={state.owner === "SAVED"}
        onClick={() =>
          setState({ owner: state.owner === "SAVED" ? undefined : "SAVED" })
        }
        className="min-h-11 rounded-tag border border-border px-3 py-2 text-body-sm aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-on-ink"
      >
        담아온
      </button>
    </div>
  );
}

/**
 * 둘러보기 전용 검색·필터. 웹(≥760px)은 pill 줄이 즉시 반영되고(AC-61), 모바일은 필터
 * 버튼이 스테이징 시트를 연다(AC-82). owner pill(AC-63)은 내 서랍 전용이라 여기 없다.
 */
function ExploreFilters({
  state,
  setState,
  onSessionLost,
}: {
  state: RecipeSearchState;
  setState: (patch: Partial<RecipeSearchState>) => void;
  onSessionLost: () => void;
}) {
  const width = useViewportWidth();
  const isMobile = width !== null && width < WEB_BREAKPOINT_PX;
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className="mb-4 flex flex-col gap-3">
      <RecipeSearchInput q={state.q} onCommit={(q) => setState({ q })} />

      {!isMobile && (
        <>
          <div className="flex flex-wrap gap-2" role="group" aria-label="온도">
            <button
              type="button"
              aria-pressed={state.temp === "HOT"}
              onClick={() =>
                setState({ temp: state.temp === "HOT" ? undefined : "HOT" })
              }
              className="min-h-11 rounded-tag border border-border px-3 py-2 text-body-sm aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-on-ink"
            >
              Hot
            </button>
            <button
              type="button"
              aria-pressed={state.temp === "ICE"}
              onClick={() =>
                setState({ temp: state.temp === "ICE" ? undefined : "ICE" })
              }
              className="min-h-11 rounded-tag border border-border px-3 py-2 text-body-sm aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-on-ink"
            >
              Ice
            </button>
          </div>

          <div className="flex flex-wrap gap-2" role="group" aria-label="배전도">
            {ROAST_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={state.roast.includes(opt.value)}
                onClick={() =>
                  setState({ roast: toggleValue(state.roast, opt.value) })
                }
                className="min-h-11 rounded-tag border border-border px-3 py-2 text-body-sm aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-on-ink"
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2" role="group" aria-label="기구">
            {DRIPPER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={state.dripper.includes(opt.value)}
                onClick={() =>
                  setState({ dripper: toggleValue(state.dripper, opt.value) })
                }
                className="min-h-11 rounded-tag border border-border px-3 py-2 text-body-sm aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-on-ink"
              >
                {opt.label}
              </button>
            ))}
          </div>

          <DoseRangeFilter
            doseMin={state.doseMin}
            doseMax={state.doseMax}
            onCommit={(patch) => setState(patch)}
          />
        </>
      )}

      {isMobile && (
        <Button type="button" onClick={() => setSheetOpen(true)}>
          필터
        </Button>
      )}

      {isMobile && sheetOpen && (
        <FilterSheet
          q={state.q}
          applied={{
            temp: state.temp,
            roast: state.roast,
            dripper: state.dripper,
          }}
          onApply={(patch) => {
            setState(patch);
            setSheetOpen(false);
          }}
          onSessionLost={onSessionLost}
        />
      )}

      <div className="flex gap-2 text-body-sm" role="group" aria-label="정렬">
        <button
          type="button"
          aria-pressed={state.sort === undefined}
          onClick={() => setState({ sort: undefined })}
          className="min-h-11 rounded-tag border border-border px-3 py-2 aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-on-ink"
        >
          인기순
        </button>
        <button
          type="button"
          aria-pressed={state.sort === "RECENT"}
          onClick={() => setState({ sort: "RECENT" })}
          className="min-h-11 rounded-tag border border-border px-3 py-2 aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-on-ink"
        >
          최신순
        </button>
      </div>
    </div>
  );
}

const DOSE_MIN = 10;
const DOSE_MAX = 30;
const DOSE_COMMIT_DEBOUNCE_MS = 200;

/**
 * 원두량 슬라이더(10–30g). 드래그는 pointerup에서 1회, 화살표 키는 마지막 입력 후 200ms
 * 디바운스로 1회만 커밋한다(AC-RECIPESBREWS-62).
 */
function DoseRangeFilter({
  doseMin,
  doseMax,
  onCommit,
}: {
  doseMin?: number;
  doseMax?: number;
  onCommit: (patch: { doseMin?: number; doseMax?: number }) => void;
}) {
  const [draftMin, setDraftMin] = useState(doseMin ?? DOSE_MIN);
  const [draftMax, setDraftMax] = useState(doseMax ?? DOSE_MAX);
  const draggingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function commit(min: number, max: number) {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    onCommit({
      doseMin: min === DOSE_MIN ? undefined : min,
      doseMax: max === DOSE_MAX ? undefined : max,
    });
  }

  function scheduleCommit(min: number, max: number) {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(
      () => commit(min, max),
      DOSE_COMMIT_DEBOUNCE_MS,
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-body-sm text-ink-3">
        원두량 {draftMin}–{draftMax}g
      </span>
      <input
        type="range"
        aria-label="원두량 최소"
        min={DOSE_MIN}
        max={DOSE_MAX}
        value={draftMin}
        onPointerDown={() => {
          draggingRef.current = true;
        }}
        onPointerUp={() => {
          draggingRef.current = false;
          commit(draftMin, draftMax);
        }}
        onChange={(e) => {
          const value = Math.min(Number(e.target.value), draftMax);
          setDraftMin(value);
          if (!draggingRef.current) scheduleCommit(value, draftMax);
        }}
      />
      <input
        type="range"
        aria-label="원두량 최대"
        min={DOSE_MIN}
        max={DOSE_MAX}
        value={draftMax}
        onPointerDown={() => {
          draggingRef.current = true;
        }}
        onPointerUp={() => {
          draggingRef.current = false;
          commit(draftMin, draftMax);
        }}
        onChange={(e) => {
          const value = Math.max(Number(e.target.value), draftMin);
          setDraftMax(value);
          if (!draggingRef.current) scheduleCommit(draftMin, value);
        }}
      />
    </div>
  );
}

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_INPUT_ID = "recipe-search-input";

/**
 * 검색어 입력 — 300ms 디바운스(AC-59), IME 조합 중에는 요청을 미룬다(AC-60),
 * ⌘K/Ctrl+K로 포커스한다(AC-80).
 *
 * <p>로컬 `draft`로 타이핑을 즉시 반영하고, 커밋(부모 `q` 갱신 → URL 동기화)만 지연시킨다.
 * `isComposing`을 input 이벤트가 아니라 composition 이벤트로 직접 추적하는 이유는, jsdom을 포함한
 * 일부 구현이 `input`의 `nativeEvent.isComposing`을 안정적으로 채우지 않기 때문이다.
 */
function RecipeSearchInput({
  q,
  onCommit,
}: {
  q: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(q);
  const composingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "k") return;
      e.preventDefault();
      // Input 프리미티브는 ref를 받지 않는다(AC-DS2-18) — id로 직접 찾는다.
      document.getElementById(SEARCH_INPUT_ID)?.focus();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function scheduleCommit(value: string) {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onCommit(value), SEARCH_DEBOUNCE_MS);
  }

  return (
    <Input
      id={SEARCH_INPUT_ID}
      type="search"
      label="레시피 검색"
      placeholder="레시피 · 기구 검색"
      value={draft}
      onChange={(e: ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setDraft(value);
        if (!composingRef.current) scheduleCommit(value);
      }}
      onCompositionStart={() => {
        composingRef.current = true;
        if (timerRef.current) clearTimeout(timerRef.current);
      }}
      onCompositionEnd={(e: CompositionEvent<HTMLInputElement>) => {
        composingRef.current = false;
        scheduleCommit((e.target as HTMLInputElement).value);
      }}
    />
  );
}
