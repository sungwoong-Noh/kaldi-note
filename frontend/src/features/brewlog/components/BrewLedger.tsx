"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { LedgerRow } from "@/components/kit";
import { RoastDot } from "@/components/ui";
import { useBrewers } from "@/features/gear/queries";
import { fetchRecipe } from "@/features/recipe/api";
import { useBeanLabel } from "../useEntityLabels";
import { useRoastLevel } from "@/features/calendar/useRoastLevel";
import {
  formatDuration,
  formatGrams,
  formatLedgerDate,
  formatTemperature,
  formatTemperatureCompact,
} from "@/lib/format";
import { kstToday } from "@/lib/kstDate";
import type { BrewLogSummary } from "../schema";

const RECIPE_STALE_MS = 5 * 60 * 1000;

/** 웹 표 열 폭(px) — 목업 BW1. 레시피 열이 나머지를 채운다. */
const COLUMN_WIDTH = { date: 108, dose: 100, temp: 90, time: 90, yield: 100, rating: 70 } as const;

const HEAD = "px-[20px] py-[12px] font-mono text-[9.5px] font-normal tracking-[0.1em] text-ink-3 uppercase";
const NUM = "px-[20px] py-[16px] text-right font-mono";

/**
 * 웹 장부형 표 — 목업 BW1(docs/specs/2026-10-10-my-cups-ledger.md AC-MYCUPS-09·12·15).
 * 행 전체가 상세 링크다 — 레시피 칸의 링크를 행 크기로 늘린다(`after:inset-0`, `tr`이 기준).
 */
export function LedgerTable({
  logs,
  labels,
}: {
  logs: BrewLogSummary[];
  labels: Map<number, string>;
}) {
  const brewers = useBrewers();
  const today = kstToday();
  return (
    <div className="overflow-hidden rounded-[10px] border border-divider-strong">
      <table className="w-full table-fixed border-collapse">
        <colgroup>
          <col style={{ width: COLUMN_WIDTH.date }} />
          <col />
          <col style={{ width: COLUMN_WIDTH.dose }} />
          <col style={{ width: COLUMN_WIDTH.temp }} />
          <col style={{ width: COLUMN_WIDTH.time }} />
          <col className="hidden min-[1024px]:table-column" style={{ width: COLUMN_WIDTH.yield }} />
          <col style={{ width: COLUMN_WIDTH.rating }} />
        </colgroup>
        <thead className="border-b border-divider bg-surface">
          <tr>
            <th className={`${HEAD} text-left`}>날짜</th>
            <th className={`${HEAD} text-left`}>레시피 / 원두</th>
            <th className={`${HEAD} text-right`}>원두량</th>
            <th className={`${HEAD} text-right`}>온도</th>
            <th className={`${HEAD} text-right`}>시간</th>
            <th className={`${HEAD} hidden text-right min-[1024px]:table-cell`}>수율</th>
            <th className={`${HEAD} text-right`}>평가</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <TableRow
              key={log.id}
              log={log}
              label={labels.get(log.recipeId) ?? ""}
              brewers={brewers.data}
              today={today}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TableRow({
  log,
  label,
  brewers,
  today,
}: {
  log: BrewLogSummary;
  label: string;
  brewers: { id: number; brand: string; name: string }[] | undefined;
  today: string;
}) {
  const roastLevel = useRoastLevel(log.beanBatchId, true);
  const bean = useBeanLabel(log.beanBatchId, log.beanBatchId !== undefined);
  // useRecipeLabels와 같은 키라 캐시를 같이 쓴다 — 요청이 늘지 않는다(AC-MYCUPS-24).
  const recipe = useQuery({
    queryKey: ["recipe", log.recipeId],
    queryFn: () => fetchRecipe(log.recipeId),
    staleTime: RECIPE_STALE_MS,
  });
  const brewer = brewers?.find((item) => item.id === recipe.data?.brewerId);
  const sub = [
    log.beanBatchId !== undefined && bean.isReady ? bean.label : undefined,
    brewer ? `${brewer.brand} ${brewer.name}` : undefined,
  ]
    .filter(Boolean)
    .join(" · ");
  const { date, weekday } = formatLedgerDate(log.brewedAt, today);

  return (
    <tr className="relative border-b border-sunken last:border-b-0 hover:bg-surface">
      <td className="px-[20px] py-[16px] font-mono text-[13px] text-ink-2">
        <span>{date}</span> <span className="text-ink-3">{weekday}</span>
      </td>
      <td className="px-[20px] py-[16px]">
        <div className="flex min-w-0 items-center gap-[12px]">
          <span data-ledger-dot className="flex size-[10px] shrink-0">
            <RoastDot roastLevel={roastLevel} size={10} />
          </span>
          <div className="min-w-0">
            <Link
              href={`/brews/${log.id}`}
              className="block truncate text-[14.5px] font-medium text-ink after:absolute after:inset-0"
            >
              {label}
            </Link>
            {sub && (
              <div data-ledger-sub className="mt-[3px] truncate text-[12px] text-ink-3">
                {sub}
              </div>
            )}
          </div>
        </div>
      </td>
      <td className={`${NUM} text-[14px] font-medium text-ink`}>{formatGrams(log.actualDoseG)}</td>
      <td className={`${NUM} text-[13px] text-ink-2`}>{formatTemperature(log.actualWaterTempC)}</td>
      <td className={`${NUM} text-[13px] text-ink-2`}>
        {log.actualTotalTimeSeconds !== undefined ? formatDuration(log.actualTotalTimeSeconds) : "—"}
      </td>
      <td className={`${NUM} hidden text-[14px] font-medium text-ink min-[1024px]:table-cell`}>
        {log.extractionYieldPercent !== undefined ? `${log.extractionYieldPercent} %` : "—"}
      </td>
      <td className={`${NUM} text-[13px] text-accent`}>
        {log.rating !== undefined ? (
          <>
            <span aria-hidden>★</span> <span>{log.rating}</span>
          </>
        ) : (
          "—"
        )}
      </td>
    </tr>
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
