import Link from "next/link";
import type { BrewLogSummary } from "@/features/brewlog/schema";
import { brewCountLabel } from "../brewCountLabel";
import { kstTimeOf, representativeMetric } from "../dayListFormat";
import { useRoastLevel } from "../useRoastLevel";
import { DayCard } from "./DayCard";
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

/** 시각 + 별점(있을 때만). 모바일 원장 행 캡션(AC-HOMECAL-108·109) 전용 — 웹 카드는 별점을
 * 태그 줄에 따로 보여준다(AC-HOMECAL-115). */
function formatCaption(brewedAt: string, rating: number | undefined): string {
  const time = kstTimeOf(brewedAt);
  return rating !== undefined ? `${time} · ★ ${rating}` : time;
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
      <ul className={variant === "web" ? "flex flex-col gap-3" : undefined}>
        {logs.map((log) =>
          variant === "web" ? (
            <li key={log.id}>
              <DayCard log={log} recipeLabel={recipeLabels?.get(log.recipeId)} />
            </li>
          ) : (
            <DayListRow
              key={log.id}
              log={log}
              recipeLabel={recipeLabels?.get(log.recipeId)}
              variant={variant}
            />
          ),
        )}
      </ul>
      {ownerNickname !== undefined && (
        <p className="text-body-sm text-ink-3">
          맞팔로우 상태여서 {ownerNickname} 님의 기록이 보입니다.
        </p>
      )}
    </div>
  );
}

function DayListRow({
  log,
  recipeLabel,
  variant,
}: {
  log: BrewLogSummary;
  recipeLabel?: string;
  variant: "mobile" | "web";
}) {
  const roastLevel = useRoastLevel(log.beanBatchId, true);
  const metric = representativeMetric(log);

  return (
    <li data-testid="day-list-row">
      <Link
        href={`/brews/${log.id}`}
        className="flex min-h-11 items-center gap-2"
      >
        <RoastDot roastLevel={roastLevel} />
        <span className="flex-1 truncate">
          <span className="block truncate text-body font-medium">
            {recipeLabel ?? ""}
          </span>
          <span className="text-caption text-ink-3">
            {formatCaption(log.brewedAt, log.rating)}
          </span>
        </span>
        {metric !== undefined && <span className="text-metric">{metric}</span>}
      </Link>
      {variant === "web" && log.overallNote !== undefined && (
        <p className="text-body-sm italic text-ink-2">{log.overallNote}</p>
      )}
      {variant === "web" && log.diagnosis !== undefined && (
        <p className="border-l-2 border-accent bg-surface px-3 py-2 text-body-sm">
          {log.diagnosis}
        </p>
      )}
    </li>
  );
}
