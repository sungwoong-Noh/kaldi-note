import type { RecipeDripper, RecipeRoast } from "./useRecipeSearchState";

export const ROAST_OPTIONS: ReadonlyArray<{
  value: RecipeRoast;
  label: string;
}> = [
  { value: "LIGHT", label: "약배전" },
  { value: "MEDIUM", label: "중배전" },
  { value: "DARK", label: "강배전" },
];

export const DRIPPER_OPTIONS: ReadonlyArray<{
  value: RecipeDripper;
  label: string;
}> = [
  { value: "V60", label: "V60" },
  { value: "KALITA", label: "칼리타" },
  { value: "ORIGAMI", label: "오리가미" },
  { value: "CLEVER", label: "클레버" },
];

/** 배열 안에 있으면 빼고, 없으면 더한다. 다중 선택 pill의 공통 토글 동작. */
export function toggleValue<T>(values: T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((v) => v !== value)
    : [...values, value];
}
