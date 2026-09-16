import Link from "next/link";
import {
  formatDuration,
  formatGrams,
  formatRatio,
  formatTemperature,
} from "@/lib/format";
import type { RecipeSummary } from "../schema";
import { statusLabel } from "@/lib/statusLabel";

/** 목록의 한 항목. 카드 전체가 링크라 탭 타깃이 크다 — 부엌에서 폰으로 쓰는 환경을 전제한다. */
export function RecipeCard({ recipe }: { recipe: RecipeSummary }) {
  return (
    <li>
      <Link
        href={`/recipes/${recipe.id}`}
        className="block rounded-lg border border-border p-4 active:bg-surface"
      >
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-card-title font-medium">{recipe.title}</h2>
          {recipe.sourceType === "CURATED" && (
            <span className="shrink-0 rounded-md bg-surface px-2 py-1 text-body-sm text-ink-3">
              {statusLabel("source", "CURATED")}
            </span>
          )}
        </div>

        <dl className="mt-2 flex flex-col gap-1">
          {/* 대표 수치. 카드마다 정확히 하나가 36px로 뜬다. 기록 화면과 같은 1:비율 형태다 —
              비율은 배치 크기에 독립적이라 다른 레시피와 바로 비교된다. */}
          <div
            data-lead
            className="flex items-center gap-1 text-metric-hero font-semibold tabular-nums tracking-[-0.02em]"
          >
            <dt className="sr-only">비율</dt>
            <dd>{formatRatio(recipe.ratio)}</dd>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-metric text-ink-3">
            <div className="flex items-center gap-1">
              <dt className="sr-only">원두량</dt>
              <dd className="text-metric">{formatGrams(recipe.doseG)}</dd>
              <span aria-hidden>→</span>
              <dt className="sr-only">물량</dt>
              <dd className="text-metric">{formatGrams(recipe.waterG)}</dd>
            </div>

            {recipe.waterTempC !== undefined && (
              <div>
                <dt className="sr-only">물 온도</dt>
                <dd className="text-metric">{formatTemperature(recipe.waterTempC)}</dd>
              </div>
            )}

            {recipe.totalTimeSeconds !== undefined && (
              <div>
                <dt className="sr-only">총 시간</dt>
                <dd className="text-metric">{formatDuration(recipe.totalTimeSeconds)}</dd>
              </div>
            )}
          </div>
        </dl>
      </Link>
    </li>
  );
}
