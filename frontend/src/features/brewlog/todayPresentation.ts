import type {
  BeanProduct,
  RoastLevel,
  Roaster,
} from "@/features/catalog/schema";
import type { UserGrinder } from "@/features/gear/schema";
import type { BeanBatch } from "@/features/inventory/schema";
import { formatGramsCompact } from "@/lib/format";
import { toKstDate } from "@/lib/kstDate";
import type { BrewLogSummary } from "./schema";
import { GRIND_UNIT_LABEL } from "./components/brewFormFields";

export type GrindSettingUnit = keyof typeof GRIND_UNIT_LABEL;

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

export const ROAST_LEVEL_LABEL: Record<RoastLevel, string> = {
  LIGHT: "약배전",
  MEDIUM_LIGHT: "중약배전",
  MEDIUM: "중배전",
  MEDIUM_DARK: "중강배전",
  DARK: "강배전",
};

/** KST `YYYY-MM-DD`를 `11월 14일 토요일` 형식으로 바꾼다. */
export function formatTodayEyebrow(todayKst: string): string {
  const [y, m, d] = todayKst.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${m}월 ${d}일 ${weekday}요일`;
}

/** KST `YYYY-MM-DD`에서 하루 전 날짜(`YYYY-MM-DD`)를 구한다. */
function previousKstDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d - 1));
  const yy = String(date.getUTCFullYear());
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** ISO 타임스탬프의 KST `HH:mm`을 구한다. */
function formatKstTime(isoTimestamp: string): string {
  const kstMs = Date.parse(isoTimestamp) + 9 * 60 * 60 * 1000;
  const kst = new Date(kstMs);
  const hh = String(kst.getUTCHours()).padStart(2, "0");
  const mm = String(kst.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** 「지난번과 같게」 헤더 시각: `오늘 08:20`, `어제 08:20`, `11.10 08:20`. */
export function formatRelativeBrewStamp(
  brewedAt: string,
  todayKst: string,
): string {
  const kstDate = toKstDate(brewedAt);
  const time = formatKstTime(brewedAt);
  if (kstDate === todayKst) return `오늘 ${time}`;
  if (kstDate === previousKstDate(todayKst)) return `어제 ${time}`;
  return `${kstDate.slice(5, 7)}.${kstDate.slice(8, 10)} ${time}`;
}

/** 최근 기록 목록 날짜 표기: `11.13 금`. */
export function formatMonthDayWeekday(brewedAt: string): string {
  const kst = toKstDate(brewedAt);
  const [y, m, d] = kst.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${kst.slice(5, 7)}.${kst.slice(8, 10)} ${weekday}`;
}

/** `16g → 250g` 형태의 붙여 쓴 추출 비율 요약. */
export function formatCompactDoseWater(
  doseG?: number,
  waterG?: number,
): string | undefined {
  if (doseG !== undefined && waterG !== undefined) {
    return `${formatGramsCompact(doseG)} → ${formatGramsCompact(waterG)}`;
  }
  if (doseG !== undefined) return formatGramsCompact(doseG);
  if (waterG !== undefined) return formatGramsCompact(waterG);
  return undefined;
}

export function trimTrailingZero(value: number): string {
  return value.toFixed(1).replace(/\.0$/, "");
}

export interface BeanSummary {
  readonly name: string;
  readonly roasterName?: string;
  readonly roastLevel?: RoastLevel;
  readonly roastLabel?: string;
  readonly isDirectName: boolean;
}

/**
 * 원두 표기 우선순위(2026-11-14-quick-brew.md):
 * `bean_product_id`(제품명) → `bean_name` → `bean_batch_id`(배치 제품명) → 없음.
 */
export function resolveBeanSummary(
  log: BrewLogSummary,
  sources: {
    productsById: ReadonlyMap<number, BeanProduct>;
    batchesById: ReadonlyMap<number, BeanBatch>;
    roastersById: ReadonlyMap<number, Roaster>;
  },
): BeanSummary | undefined {
  const fromProduct = (product: BeanProduct): BeanSummary => {
    const roaster = sources.roastersById.get(product.roasterId);
    const roastLevel = product.roastLevel ?? undefined;
    return {
      name: product.name,
      roasterName: roaster?.name,
      roastLevel,
      roastLabel: roastLevel ? ROAST_LEVEL_LABEL[roastLevel] : undefined,
      isDirectName: false,
    };
  };

  if (log.beanProductId !== undefined) {
    const product = sources.productsById.get(log.beanProductId);
    if (product !== undefined) return fromProduct(product);
  }

  if (log.beanName !== undefined && log.beanName.trim() !== "") {
    return { name: log.beanName, isDirectName: true };
  }

  if (log.beanBatchId !== undefined) {
    const batch = sources.batchesById.get(log.beanBatchId);
    const product =
      batch !== undefined
        ? sources.productsById.get(batch.beanProductId)
        : undefined;
    if (product !== undefined) return fromProduct(product);
  }

  return undefined;
}

/** 분쇄도 표기 조각(`코만단테 C40` · `24클릭`). 값만 있을 때도 숫자는 남긴다. */
export function formatGrinderSetting(
  log: BrewLogSummary,
  grinders: readonly UserGrinder[] | undefined,
  grindSettingUnit?: GrindSettingUnit,
): { grinderName?: string; settingText?: string } {
  const grinder =
    log.userGrinderId !== undefined
      ? grinders?.find((item) => item.id === log.userGrinderId)
      : undefined;
  const grinderName =
    grinder !== undefined
      ? (grinder.nickname ?? `${grinder.brand} ${grinder.grinderModelName}`)
      : undefined;

  if (log.actualGrindSettingValue === undefined) {
    return { grinderName };
  }

  const unit =
    grindSettingUnit !== undefined
      ? GRIND_UNIT_LABEL[grindSettingUnit]
      : log.userGrinderId !== undefined
        ? "클릭"
        : "";
  const settingText = `${trimTrailingZero(log.actualGrindSettingValue)}${unit}`;
  return { grinderName, settingText };
}

/** 기존 홈(DayList) 관찰 문장 재사용 — TDS가 있는 가장 최근 기록의 diagnosis. */
export function observationOf(
  logs: readonly BrewLogSummary[],
): string | undefined {
  const measured = logs.filter((log) => log.tdsPercent !== undefined);
  if (measured.length === 0) return undefined;
  return measured.reduce((a, b) => (b.brewedAt > a.brewedAt ? b : a)).diagnosis;
}

/** 최근 기록 행 오른쪽 대표 수치(TDS가 있으면 수율, 없으면 별점). */
export function recentHeadlineMetric(log: BrewLogSummary): string | undefined {
  if (log.extractionYieldPercent !== undefined) {
    return `${log.extractionYieldPercent}%`;
  }
  if (log.rating !== undefined) {
    return `★ ${log.rating.toFixed(1)}`;
  }
  return undefined;
}
