/**
 * 날짜는 언제나 한국 시간 기준이다 — docs/specs/2026-09-19-home-calendar.md
 *
 * <p>서버가 주는 brewedAt은 UTC다. 앞 10글자를 그냥 자르면 한국 시간 아침에 내린 기록이
 * 전날로 보인다. 오프셋 값을 여기 한 곳에만 둔다.
 */
const KST_OFFSET_MINUTES = 540;

/** `2026-09-18T23:00:00Z` → `2026-09-19` */
export function toKstDate(iso: string): string {
  const shifted = new Date(new Date(iso).getTime() + KST_OFFSET_MINUTES * 60_000);
  return shifted.toISOString().slice(0, 10);
}

/** KST 기준 오늘 날짜. `YYYY-MM-DD`. */
export function kstToday(): string {
  return toKstDate(new Date().toISOString());
}

/** `2026-09-19` → `2026-09` */
export function kstMonthOf(date: string): string {
  return date.slice(0, 7);
}

/** `2026-09` ± delta개월. 연도 경계를 넘긴다. */
export function addMonths(month: string, delta: number): string {
  const [year, mon] = month.split("-").map(Number);
  const total = year * 12 + (mon - 1) + delta;
  const nextYear = Math.floor(total / 12);
  const nextMonth = (total % 12) + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}
