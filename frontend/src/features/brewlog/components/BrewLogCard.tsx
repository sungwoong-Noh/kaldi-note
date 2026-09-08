import Link from "next/link";
import { formatDuration, formatRatio, formatTemperature } from "@/lib/format";
import type { BrewLogSummary } from "../schema";

/**
 * 목록의 한 항목. 카드 전체가 링크라 탭 타깃이 크다 — 부엌에서 폰으로 쓰는 환경을 전제한다.
 *
 * <p><b>추출 수율은 있을 때만 그린다.</b> TDS 없이 내린 기록이 기본이고(「뒤집으면 안 되는 결정」 4번),
 * 빈 `%`가 줄지어 있으면 측정하지 않은 것이 결함처럼 보인다.
 */
export function BrewLogCard({
  log,
  recipeLabel,
}: {
  log: BrewLogSummary;
  /** 레시피 이름 또는 못 읽은 이유. 조회 중이면 빈 문자열이다. 필수라 빠뜨리면 타입 검사가 잡는다. */
  recipeLabel: string;
}) {
  const lead = headline(log);

  return (
    <li>
      <Link
        href={`/brews/${log.id}`}
        className="block rounded-lg border border-line p-4 active:bg-surface"
      >
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-medium">{recipeLabel}</h2>
          {log.rating !== undefined && (
            <span className="shrink-0 text-sm text-muted">
              <span aria-hidden>★</span> {formatRating(log.rating)}
            </span>
          )}
        </div>

        <dl className="mt-2 flex flex-col gap-1">
          <div className="text-lg font-semibold">
            <dt className="sr-only">{lead.label}</dt>
            <dd>{lead.value}</dd>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            {summaryEntries(log, lead.label).map((entry) => (
              <div key={entry.label} className="flex items-center gap-1">
                <dt className="sr-only">{entry.label}</dt>
                <dd>{entry.value}</dd>
              </div>
            ))}
          </div>
        </dl>
      </Link>
    </li>
  );
}

/**
 * 대표 수치. 목록에서 카드마다 정확히 하나가 18px로 뜬다.
 *
 * <p><b>비율이 우선이다.</b> 레시피 카드가 「도즈 → 물」을 대표로 세우므로 같은 축에서 비교된다.
 *
 * <p><b>비율이 없으면 물 온도로 내려간다.</b> `brewRatio`는 프론트 스키마에서 옵션이라 타입상 빌 수
 * 있다. 지금 백엔드로는 도달할 수 없지만(`actual_dose_g`·`actual_water_g`가 둘 다 `nullable = false`이고
 * `ExtractionAnalyzer`가 분기 없이 나눈다), 분기를 두는 한 그 안이 비면 대표 자리가 조용히 사라진다.
 * 물 온도는 필수라 마지막 보루가 된다.
 */
function headline(log: BrewLogSummary): { label: string; value: string } {
  return log.brewRatio !== undefined
    ? { label: "브루 비율", value: formatRatio(log.brewRatio) }
    : { label: "물 온도", value: formatTemperature(log.actualWaterTempC) };
}

/**
 * 카드 보조줄. 값이 없는 항목은 자리째 뺀다 — 빈칸이 줄지어 있으면 측정하지 않은 것이
 * 결함처럼 보인다. 표시 함수는 레시피 카드가 쓰는 것을 그대로 쓴다.
 *
 * <p><b>대표 수치로 뽑힌 항목(`taken`)도 뺀다.</b> 같은 값을 두 번 그리지 않는다.
 */
function summaryEntries(
  log: BrewLogSummary,
  taken: string,
): { label: string; value: string }[] {
  const entries = [
    { label: "내린 날", value: formatBrewedDate(log.brewedAt) },
    { label: "브루 비율", value: log.brewRatio && formatRatio(log.brewRatio) },
    { label: "물 온도", value: formatTemperature(log.actualWaterTempC) },
    {
      label: "추출 시간",
      value:
        log.actualTotalTimeSeconds !== undefined &&
        formatDuration(log.actualTotalTimeSeconds),
    },
    {
      label: "추출 수율",
      value:
        log.extractionYieldPercent !== undefined &&
        `${log.extractionYieldPercent} %`,
    },
  ];

  return entries.filter(
    (entry): entry is { label: string; value: string } =>
      typeof entry.value === "string" && entry.label !== taken,
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
