import { Hero } from "@/components/ui";
import { formatDuration, formatGrams, formatTemperature } from "@/lib/format";
import { previewRatio, previewYield } from "../formState";
import type { RecipeTargets } from "../useEntityLabels";

/**
 * 기록 폼의 히어로 — 입력하는 동안 실측 비율(과 값이 다 있으면 수율)을 보여준다.
 *
 * <p>대표 수치는 비율이다. 수율은 TDS가 있어야만 나오므로 대표로 세우면 대부분 빈 판이 된다.
 * 두 값 모두 저장 전 미리보기라 클라이언트가 계산한다(docs/specs/2026-09-27-brew-form-redesign.md 「용어」).
 */
export function BrewHero({
  title,
  targets,
  doseG,
  waterG,
  beverageWeightG,
  tdsPercent,
}: {
  title: string;
  /** 레시피 기준값. 편집 화면에서 원본 레시피가 지워졌으면 없다 — 그 줄을 뺀다 */
  targets?: RecipeTargets;
  doseG: number | null;
  waterG: number | null;
  beverageWeightG: number | null;
  tdsPercent: number | null;
}) {
  const yieldPercent = previewYield(doseG, beverageWeightG, tdsPercent);

  return (
    <Hero eyebrow="비율" lead={previewRatio(doseG, waterG)}>
      <div className="flex flex-col gap-1">
        <p className="text-body font-semibold text-on-hero">{title}</p>
        {targets !== undefined && (
          <p className="text-metric text-on-hero-dim">
            {recipeBaseline(targets)}
          </p>
        )}
        <p className="text-body-sm text-on-hero-dim">
          {yieldPercent === null
            ? "TDS가 없으면 수율을 계산할 수 없습니다."
            : `수율 ${yieldPercent} %`}
        </p>
      </div>
    </Hero>
  );
}

/** `20.0g → 300.0g · 92°C · 3:30`. 레시피에 없는 조각은 뺀다. */
function recipeBaseline(recipe: RecipeTargets): string {
  return [
    `${formatGrams(recipe.doseG)} → ${formatGrams(recipe.waterG)}`,
    recipe.waterTempC !== undefined && formatTemperature(recipe.waterTempC),
    recipe.totalTimeSeconds !== undefined &&
      formatDuration(recipe.totalTimeSeconds),
  ]
    .filter(Boolean)
    .join(" · ");
}
