import type { BrewLogSummary } from "@/features/brewlog/schema";
import { formatRatio } from "@/lib/format";

/**
 * `DayList.tsx`와 `DayCard.tsx`가 공유하는 서식 함수들. 두 컴포넌트가 서로를 import하면
 * 순환 참조가 되므로 여기 따로 둔다.
 */

/** UTC ISO `brewedAt` → KST `HH:mm`. */
export function kstTimeOf(brewedAt: string): string {
  const d = new Date(brewedAt);
  const kstHour = (d.getUTCHours() + 9) % 24;
  const hh = String(kstHour).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** 수율이 있으면 수율, 없으면 비율 — 내 기록과 남의 기록에 같은 규칙을 쓴다(AC-HOMECAL-43). */
export function representativeMetric(log: BrewLogSummary): string | undefined {
  if (log.extractionYieldPercent !== undefined) {
    return `${log.extractionYieldPercent} %`;
  }
  if (log.brewRatio !== undefined) {
    return formatRatio(log.brewRatio);
  }
  return undefined;
}
