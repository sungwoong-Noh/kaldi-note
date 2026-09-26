import type { RecipeSearchState } from "../useRecipeSearchState";

/** 내 서랍의 소유 필터 pill — 전체 / 내가 만든 / 담아온(AC-RECIPESBREWS-63). */
export function DrawerFilters({
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
