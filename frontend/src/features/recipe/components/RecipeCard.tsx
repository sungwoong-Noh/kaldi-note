import Link from 'next/link';
import { formatDuration, formatGrams, formatRatio, formatTemperature } from '@/lib/format';
import type { RecipeSummary } from '../schema';

/** 목록의 한 항목. 카드 전체가 링크라 탭 타깃이 크다 — 부엌에서 폰으로 쓰는 환경을 전제한다. */
export function RecipeCard({ recipe }: { recipe: RecipeSummary }) {
  return (
    <li>
      <Link
        href={`/recipes/${recipe.id}`}
        className="block rounded-lg border border-neutral-200 p-4 active:bg-neutral-50 dark:border-neutral-800 dark:active:bg-neutral-900"
      >
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-medium">{recipe.title}</h2>
          {recipe.sourceType === 'CURATED' && (
            <span className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
              CURATED
            </span>
          )}
        </div>

        <dl className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-neutral-600 dark:text-neutral-400">
          <div className="flex items-center gap-1">
            <dt className="sr-only">원두</dt>
            <dd>{formatGrams(recipe.doseG)}</dd>
            <span aria-hidden>→</span>
            <dt className="sr-only">물</dt>
            <dd>{formatGrams(recipe.waterG)}</dd>
          </div>

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
        </dl>
      </Link>
    </li>
  );
}
