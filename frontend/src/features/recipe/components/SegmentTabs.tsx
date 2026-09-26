import type {
  RecipeSearchState,
  RecipeScope,
} from "../useRecipeSearchState";

/** 내 서랍 / 둘러보기. 기본은 내 서랍이다(AC-RECIPESBREWS-58). */
export function SegmentTabs({
  state,
  setState,
}: {
  state: RecipeSearchState;
  setState: (patch: Partial<RecipeSearchState>) => void;
}) {
  const tabs: Array<{ scope: RecipeScope; label: string }> = [
    { scope: "DRAWER", label: "내 서랍" },
    { scope: "PUBLIC", label: "둘러보기" },
  ];

  return (
    <div className="mb-4 flex gap-2" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.scope}
          type="button"
          role="tab"
          aria-selected={state.scope === tab.scope}
          onClick={() => setState({ scope: tab.scope })}
          className="min-h-11 flex-1 rounded-tag border border-border px-3 py-2 text-body font-medium aria-selected:border-ink aria-selected:bg-ink aria-selected:text-on-ink"
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
