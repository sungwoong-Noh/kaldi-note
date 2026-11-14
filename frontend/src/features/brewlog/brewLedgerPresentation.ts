import type { BeanMetadataSources } from "./useTodayMetadata";
import { kstTimeOf } from "@/features/calendar/dayListFormat";
import { addDays } from "@/features/calendar/monthGrid";
import { formatGrams, formatLedgerDate, formatRatio } from "@/lib/format";
import { toKstDate } from "@/lib/kstDate";
import type { BrewLogSummary } from "./schema";
import {
  formatCompactDoseWater,
  recentHeadlineMetric,
  resolveBeanSummary,
} from "./todayPresentation";

export interface BrewDateGroup {
  readonly date: string;
  readonly logs: BrewLogSummary[];
}

export interface LedgerEntryPresentation {
  readonly isRecipeBrew: boolean;
  readonly title: string;
  readonly timeText: string;
  readonly compactDoseWater: string | undefined;
  readonly doseText: string | undefined;
  readonly waterText: string | undefined;
  readonly ratioText: string | undefined;
  readonly metric: string | undefined;
}

/** 로드된 로그를 KST 날짜별로 묶되, 들어온 최신순 날짜 순서를 그대로 지킨다. */
export function groupLogsByKstDate(
  logs: readonly BrewLogSummary[],
): BrewDateGroup[] {
  const byDate = new Map<string, BrewLogSummary[]>();
  for (const log of logs) {
    const date = toKstDate(log.brewedAt);
    const list = byDate.get(date);
    if (list) list.push(log);
    else byDate.set(date, [log]);
  }
  return [...byDate.entries()].map(([date, list]) => ({ date, logs: list }));
}

/** 원장 날짜 그룹 머릿말: `오늘 · 11.14 토`, `어제 · 11.13 금`, `11.12 목`, `2025.09.19 금`. */
export function formatLedgerGroupHeading(
  dateStr: string,
  todayKst: string,
): string {
  const { date, weekday } = formatLedgerDate(
    `${dateStr}T00:00:00+09:00`,
    todayKst,
  );
  if (dateStr === todayKst) return `오늘 · ${date} ${weekday}`;
  if (dateStr === addDays(todayKst, -1)) return `어제 · ${date} ${weekday}`;
  return `${date} ${weekday}`;
}

/** 시안 F1·FW 원장 한 행의 제목·보조줄·수치·대표 값을 만든다. */
export function resolveLedgerEntryPresentation(
  log: BrewLogSummary,
  options: {
    recipeLabels: ReadonlyMap<number, string>;
    beanSources: BeanMetadataSources;
  },
): LedgerEntryPresentation {
  const isRecipeBrew = log.recipeId !== undefined;
  const compactDoseWater = formatCompactDoseWater(
    log.actualDoseG,
    log.actualWaterG,
  );

  let title = "";
  if (isRecipeBrew) {
    title = options.recipeLabels.get(log.recipeId!) ?? "";
  } else {
    const bean = resolveBeanSummary(log, options.beanSources);
    title = bean?.name ?? compactDoseWater ?? "기록";
  }

  return {
    isRecipeBrew,
    title,
    timeText: kstTimeOf(log.brewedAt),
    compactDoseWater,
    doseText: log.actualDoseG !== undefined ? formatGrams(log.actualDoseG) : undefined,
    waterText: log.actualWaterG !== undefined ? formatGrams(log.actualWaterG) : undefined,
    ratioText: log.brewRatio !== undefined ? formatRatio(log.brewRatio) : undefined,
    metric: recentHeadlineMetric(log),
  };
}
