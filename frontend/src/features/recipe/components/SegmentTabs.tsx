import { Segmented } from "@/components/kit";
import type { RecipeSearchState, RecipeScope } from "../useRecipeSearchState";

const SCOPE_OPTIONS: readonly { value: RecipeScope; label: string }[] = [
  { value: "DRAWER", label: "내 서랍" },
  { value: "PUBLIC", label: "둘러보기" },
];

/** 내 서랍 / 둘러보기. 기본은 내 서랍이다(AC-RECIPESBREWS-58). */
export function SegmentTabs({
  state,
  setState,
}: {
  state: RecipeSearchState;
  setState: (patch: Partial<RecipeSearchState>) => void;
}) {
  return (
    <div className="mb-4">
      <Segmented
        label="레시피 범위"
        role="tab"
        options={SCOPE_OPTIONS}
        value={state.scope}
        onChange={(scope) => setState({ scope })}
      />
    </div>
  );
}
