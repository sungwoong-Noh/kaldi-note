import Link from "next/link";
import type { BrewLogSummary } from "@/features/brewlog/schema";
import { formatRatio } from "@/lib/format";
import { brewCountLabel } from "../brewCountLabel";
import { useRoastLevel } from "../useRoastLevel";
import { RoastDot } from "./RoastDot";

const WEEKDAY_EN = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;

/** `2026-09-19` → `09.19`. */
function formatDayHeader(date: string): string {
  return date.slice(5).replace("-", ".");
}

/** JS `Date.getUTCDay()`는 일요일이 0이다 — 월요일을 0으로 다시 세팅한다. */
function weekdayOf(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return WEEKDAY_EN[(d.getUTCDay() + 6) % 7];
}

/** 수율이 있으면 수율, 없으면 비율 — 내 기록과 남의 기록에 같은 규칙을 쓴다(AC-HOMECAL-43). */
function representativeMetric(log: BrewLogSummary): string | undefined {
  if (log.extractionYieldPercent !== undefined) {
    return `${log.extractionYieldPercent} %`;
  }
  if (log.brewRatio !== undefined) {
    return formatRatio(log.brewRatio);
  }
  return undefined;
}

/**
 * 선택된 날짜의 기록 목록. 모바일·웹이 같은 컴포넌트를 쓰고 `variant`로 CSS만 가른다.
 *
 * <p>빈 상태(그 날짜에 기록이 없음)는 부모(`HomePage`)가 그린다 — 이 컴포넌트는 `logs`가
 * 1건 이상일 때만 쓰인다.
 */
export function DayList({
  date,
  logs,
  recipeLabels,
  ownerNickname,
  variant,
}: {
  date: string;
  logs: BrewLogSummary[];
  /** recipeId → 레시피 제목. 페이지가 `useRecipeLabels`로 미리 묶어 온다. */
  recipeLabels?: Map<number, string>;
  ownerNickname?: string;
  variant: "mobile" | "web";
}) {
  const header = ownerNickname
    ? `${formatDayHeader(date)} ${weekdayOf(date)} · ${ownerNickname} · ${brewCountLabel(logs.length)}`
    : `${formatDayHeader(date)} ${weekdayOf(date)} · ${brewCountLabel(logs.length)}`;

  return (
    <div data-day-list data-variant={variant}>
      <p className="text-label text-ink-3">{header}</p>
      <ul>
        {logs.map((log) => (
          <DayListRow
            key={log.id}
            log={log}
            recipeLabel={recipeLabels?.get(log.recipeId)}
          />
        ))}
      </ul>
    </div>
  );
}

function DayListRow({
  log,
  recipeLabel,
}: {
  log: BrewLogSummary;
  recipeLabel?: string;
}) {
  const roastLevel = useRoastLevel(log.beanBatchId, true);
  const metric = representativeMetric(log);

  return (
    <li data-testid="day-list-row">
      <Link href={`/brews/${log.id}`} className="flex items-center gap-2">
        <RoastDot roastLevel={roastLevel} />
        <span className="flex-1 truncate text-body font-medium">
          {recipeLabel ?? ""}
        </span>
        {metric !== undefined && <span className="text-metric">{metric}</span>}
      </Link>
    </li>
  );
}
