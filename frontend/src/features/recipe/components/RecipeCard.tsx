import Link from "next/link";
import {
  formatDuration,
  formatGrams,
  formatRatio,
  formatTemperature,
} from "@/lib/format";
import type { RecipeSummary } from "../schema";
import { statusLabel } from "@/lib/statusLabel";
import { cardClass } from "@/components/ui";

/**
 * 목록의 한 항목. 카드 전체가 링크라 탭 타깃이 크다 — 부엌에서 폰으로 쓰는 환경을 전제한다.
 *
 * <p>둘러보기(`scope=PUBLIC`)는 작성자·담긴 수를 보여주고, 내 서랍(`scope=DRAWER`)은
 * 담아온 것이면 출처, 내가 만든 것이면 잔 수를 보여준다 — 셋이 함께 뜨지 않는다
 * (레시피 서랍 화면 스펙 AC-RECIPESBREWS-70~72).
 */
export function RecipeCard({
  recipe,
  scope,
}: {
  recipe: RecipeSummary;
  scope: "DRAWER" | "PUBLIC";
}) {
  const isFork = recipe.parentRecipeId !== undefined;

  return (
    <li>
      <Link
        href={`/recipes/${recipe.id}`}
        className={cardClass("block active:bg-surface")}
      >
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-card-title font-medium">{recipe.title}</h2>
          {recipe.sourceType === "CURATED" && (
            <span className="shrink-0 rounded-tag bg-surface px-2 py-1 text-body-sm text-ink-3">
              {statusLabel("source", "CURATED")}
            </span>
          )}
        </div>

        <dl className="mt-2 flex flex-col gap-1">
          {/* 대표 수치는 원두량이다 — 절대량 자체가 비교 기준이라 담긴 만큼 그대로 보여준다
              (AC-RECIPESBREWS-69). 배치 크기 독립적 비교는 상세에서 비율로 이어간다. */}
          <div
            data-lead
            className="flex items-center gap-1 text-metric-hero font-semibold tabular-nums tracking-[-0.02em]"
          >
            <dt className="sr-only">원두량</dt>
            <dd>{formatGrams(recipe.doseG)}</dd>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-metric text-ink-3">
            <div>
              <dt className="sr-only">물량</dt>
              <dd className="text-metric">{formatGrams(recipe.waterG)}</dd>
            </div>

            <div>
              <dt className="sr-only">비율</dt>
              <dd className="text-metric">{formatRatio(recipe.ratio)}</dd>
            </div>

            {recipe.waterTempC !== undefined && (
              <div>
                <dt className="sr-only">물 온도</dt>
                <dd className="text-metric">
                  {formatTemperature(recipe.waterTempC)}
                </dd>
              </div>
            )}

            {recipe.totalTimeSeconds !== undefined && (
              <div>
                <dt className="sr-only">총 시간</dt>
                <dd className="text-metric">
                  {formatDuration(recipe.totalTimeSeconds)}
                </dd>
              </div>
            )}
          </div>

          {scope === "PUBLIC" && (
            <p data-card-author className="text-body-sm text-ink-3">
              {recipe.authorDisplayName} · 담김 {recipe.savedCount}
            </p>
          )}

          {scope === "DRAWER" && isFork && (
            <p data-card-source className="text-body-sm text-ink-3">
              {recipe.sourceAuthorName} 님 레시피에서
            </p>
          )}

          {scope === "DRAWER" && !isFork && (
            <div className="flex items-center gap-2 text-body-sm text-ink-3">
              <span data-card-badge className="rounded-tag bg-surface px-2 py-1">
                내가 만든
              </span>
              <span data-card-brew-count>{recipe.brewCount}잔 기록</span>
            </div>
          )}
        </dl>
      </Link>
    </li>
  );
}
