import Link from "next/link";
import {
  formatDuration,
  formatGrams,
  formatRatio,
  formatTemperature,
} from "@/lib/format";
import type { RecipeSummary } from "../schema";

/** 목록의 한 항목. 카드 전체가 링크라 탭 타깃이 크다 — 부엌에서 폰으로 쓰는 환경을 전제한다. */
export function RecipeCard({ recipe }: { recipe: RecipeSummary }) {
  return (
    <li>
      <Link
        href={`/recipes/${recipe.id}`}
        className="block rounded-lg border border-line p-4 active:bg-surface"
      >
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-medium">{recipe.title}</h2>
          {recipe.sourceType === "CURATED" && (
            <span className="shrink-0 rounded bg-surface px-2 py-1 text-xs text-muted">
              CURATED
            </span>
          )}
        </div>

        <dl className="mt-2 flex flex-col gap-1">
          {/* 대표 수치. 목록에서 카드마다 정확히 하나가 18px로 뜬다. */}
          <div className="flex items-center gap-1 text-lg font-semibold tabular-nums">
            <dt className="sr-only">원두량</dt>
            <dd>{formatGrams(recipe.doseG)}</dd>
            <span aria-hidden>→</span>
            <dt className="sr-only">물량</dt>
            <dd>{formatGrams(recipe.waterG)}</dd>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <div>
              <dt className="sr-only">비율</dt>
              <dd>{formatRatio(recipe.ratio)}</dd>
            </div>

            {recipe.waterTempC !== undefined && (
              <div>
                <dt className="sr-only">물 온도</dt>
                <dd>{formatTemperature(recipe.waterTempC)}</dd>
              </div>
            )}

            {recipe.totalTimeSeconds !== undefined && (
              <div>
                <dt className="sr-only">총 시간</dt>
                <dd>{formatDuration(recipe.totalTimeSeconds)}</dd>
              </div>
            )}
          </div>
        </dl>
      </Link>
    </li>
  );
}
