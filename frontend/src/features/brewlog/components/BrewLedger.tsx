"use client";

import Link from "next/link";
import { LedgerRow } from "@/components/kit";
import { useRoastLevel } from "@/features/calendar/useRoastLevel";
import {
  formatDuration,
  formatGrams,
  formatLedgerDate,
  formatTemperature,
  formatTemperatureCompact,
} from "@/lib/format";
import { kstToday, toKstDate } from "@/lib/kstDate";
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
              <td className="py-2 font-num">{formatGrams(log.actualDoseG)}</td>
              <td className="py-2 font-num">
                {formatTemperature(log.actualWaterTempC)}
              </td>
              <td className="py-2 font-num">
                {log.actualTotalTimeSeconds !== undefined
                  ? formatDuration(log.actualTotalTimeSeconds)
                  : "—"}
              </td>
              <td className="hidden py-2 font-num min-[1024px]:table-cell">
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

/**
 * 모바일 2줄 원장 행 — 목업 BM1(docs/specs/2026-10-10-my-cups-ledger.md AC-MYCUPS-08·14).
 * 2줄 왼쪽은 날짜·온도·시간, 오른쪽(accent)은 수율·별점이고 없는 조각은 빠진다.
 */
export function LedgerList({
  logs,
  labels,
}: {
  logs: BrewLogSummary[];
  labels: Map<number, string>;
}) {
  const today = kstToday();
  return (
    <ul>
      {logs.map((log) => (
        <li key={log.id}>
          <MobileRow log={log} label={labels.get(log.recipeId) ?? ""} today={today} />
        </li>
      ))}
    </ul>
  );
}

function MobileRow({
  log,
  label,
  today,
}: {
  log: BrewLogSummary;
  label: string;
  today: string;
}) {
  const roastLevel = useRoastLevel(log.beanBatchId, true);
  const { date, weekday } = formatLedgerDate(log.brewedAt, today);
  const meta = [
    `${date} ${weekday}`,
    formatTemperatureCompact(log.actualWaterTempC),
    log.actualTotalTimeSeconds !== undefined ? formatDuration(log.actualTotalTimeSeconds) : undefined,
  ]
    .filter(Boolean)
    .join(" · ");
  const accent = [
    log.extractionYieldPercent !== undefined ? `${log.extractionYieldPercent} %` : undefined,
    log.rating !== undefined ? `★ ${log.rating}` : undefined,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link href={`/brews/${log.id}`} className="block">
      <LedgerRow
        roastLevel={roastLevel}
        title={label}
        value={formatGrams(log.actualDoseG)}
        meta={meta}
        accent={accent || undefined}
      />
    </Link>
  );
}
