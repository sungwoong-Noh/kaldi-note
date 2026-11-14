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

  const activeIndex = tabs.findIndex((tab) => tab.scope === state.scope);

  return (
    <div className="relative mb-4 grid grid-cols-2 gap-2" role="tablist">
      {activeIndex >= 0 && (
        <span
          data-segment-indicator
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 rounded-tag bg-ink transition-transform duration-200 ease-out motion-reduce:transition-none"
          style={{
            width: "calc((100% - 8px) / 2)",
            transform: `translateX(calc(${activeIndex} * (100% + 8px)))`,
          }}
        />
      )}
      {tabs.map((tab) => (
        <button
          key={tab.scope}
          type="button"
          role="tab"
          aria-selected={state.scope === tab.scope}
          onClick={() => setState({ scope: tab.scope })}
          className="relative z-10 min-h-11 rounded-tag border border-border px-3 py-2 text-body font-medium transition-colors duration-200 ease-out aria-selected:border-ink aria-selected:text-on-ink motion-reduce:transition-none"
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
