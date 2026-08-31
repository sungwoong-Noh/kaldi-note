import Link from "next/link";
import type { BrewLogSummary } from "../schema";

/**
 * 목록의 한 항목. 카드 전체가 링크라 탭 타깃이 크다 — 부엌에서 폰으로 쓰는 환경을 전제한다.
 *
 * <p><b>추출 수율은 있을 때만 그린다.</b> TDS 없이 내린 기록이 기본이고(「뒤집으면 안 되는 결정」 4번),
 * 빈 `%`가 줄지어 있으면 측정하지 않은 것이 결함처럼 보인다.
 */
export function BrewLogCard({
  log,
  recipeTitle,
}: {
  log: BrewLogSummary;
  recipeTitle?: string;
}) {
  return (
    <li>
      <Link
        href={`/brews/${log.id}`}
        className="block rounded-lg border border-neutral-200 p-4 active:bg-neutral-50 dark:border-neutral-800 dark:active:bg-neutral-900"
      >
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-medium">{recipeTitle ?? `레시피 ${log.recipeId}`}</h2>
          {log.rating !== undefined && (
            <span className="shrink-0 text-sm text-neutral-600 dark:text-neutral-400">
              <span aria-hidden>★</span> {formatRating(log.rating)}
            </span>
          )}
        </div>

        <dl className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-neutral-600 dark:text-neutral-400">
          <div className="flex items-center gap-1">
            <dt className="sr-only">내린 날</dt>
            <dd>{formatBrewedDate(log.brewedAt)}</dd>
          </div>
          {log.extractionYieldPercent !== undefined && (
            <div className="flex items-center gap-1">
              <dt className="sr-only">추출 수율</dt>
              <dd>{log.extractionYieldPercent} %</dd>
            </div>
          )}
        </dl>
      </Link>
    </li>
  );
}

/** `2026-08-31T09:00:00Z` → `2026-08-31`. 시각까지 늘어놓으면 목록이 읽히지 않는다. */
function formatBrewedDate(brewedAt: string): string {
  return brewedAt.slice(0, 10);
}

/** 서버가 `4.0`으로 주는 값을 `4`로 줄인다. `4.5`는 그대로 둔다. */
function formatRating(rating: number): string {
  return String(rating);
}
