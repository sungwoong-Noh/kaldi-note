import Link from "next/link";
import { cardClass } from "@/components/ui";
import { formatDuration, formatGrams, formatTemperature } from "@/lib/format";
import { toKstDate } from "@/lib/kstDate";
import type { BrewLogSummary } from "../schema";

/** 웹(≥760px) — 날짜·레시피/원두·원두량·온도·시간·수율·평가 7열(AC-RECIPESBREWS-77). */
export function LedgerTable({
  logs,
  labels,
}: {
  logs: BrewLogSummary[];
  labels: Map<number, string>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-body">
        <thead>
          <tr className="text-left text-body-sm text-ink-3">
            <th className="pb-2 font-normal">날짜</th>
            <th className="pb-2 font-normal">레시피/원두</th>
            <th className="pb-2 font-normal">원두량</th>
            <th className="pb-2 font-normal">온도</th>
            <th className="pb-2 font-normal">시간</th>
            <th className="hidden pb-2 font-normal min-[1024px]:table-cell">
              수율
            </th>
            <th className="pb-2 font-normal">평가</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="border-t border-border">
              <td className="py-2">{toKstDate(log.brewedAt)}</td>
              <td className="py-2">
                <Link href={`/brews/${log.id}`} className="underline">
                  {labels.get(log.recipeId) ?? ""}
                </Link>
              </td>
              <td className="py-2">{formatGrams(log.actualDoseG)}</td>
              <td className="py-2">
                {formatTemperature(log.actualWaterTempC)}
              </td>
              <td className="py-2">
                {log.actualTotalTimeSeconds !== undefined
                  ? formatDuration(log.actualTotalTimeSeconds)
                  : "—"}
              </td>
              <td className="hidden py-2 min-[1024px]:table-cell">
                {log.extractionYieldPercent !== undefined
                  ? `${log.extractionYieldPercent}%`
                  : "—"}
              </td>
              <td className="py-2">
                {log.rating !== undefined ? (
                  <>
                    <span aria-hidden>★</span> <span>{log.rating}</span>
                  </>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 모바일(<760px) — 2줄 원장 행(AC-RECIPESBREWS-77). */
export function LedgerList({
  logs,
  labels,
}: {
  logs: BrewLogSummary[];
  labels: Map<number, string>;
}) {
  return (
    <ul className="flex flex-col gap-3">
      {logs.map((log) => (
        <li key={log.id}>
          <Link
            href={`/brews/${log.id}`}
            className={cardClass("block active:bg-surface")}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium">
                {labels.get(log.recipeId) ?? ""}
              </span>
              <span className="text-metric">
                {formatGrams(log.actualDoseG)}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-ink-3">
              <span>{toKstDate(log.brewedAt)}</span>
              <span>{formatTemperature(log.actualWaterTempC)}</span>
              {log.actualTotalTimeSeconds !== undefined && (
                <span>{formatDuration(log.actualTotalTimeSeconds)}</span>
              )}
              {log.extractionYieldPercent !== undefined && (
                <span>{log.extractionYieldPercent}%</span>
              )}
              {log.rating !== undefined && (
                <span>
                  <span aria-hidden>★</span> <span>{log.rating}</span>
                </span>
              )}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
