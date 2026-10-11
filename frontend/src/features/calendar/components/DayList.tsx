import Link from "next/link";
import type { BrewLogSummary } from "@/features/brewlog/schema";
import { Eyebrow } from "@/components/ui";
import { brewCountLabel } from "../brewCountLabel";
import { kstTimeOf, representativeMetric } from "../dayListFormat";
import { useRoastLevel } from "../useRoastLevel";
import { DayCard } from "./DayCard";
import { RoastDot } from "@/components/ui";

const WEEKDAY_EN = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;

/** 웹 우측 컬럼 헤더 전용 — 모바일 목록 헤더의 3글자 약어와 다르다(AC-HOMECAL-123). */
const WEEKDAY_EN_FULL = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const;

/** `2026-09-19` → `09.19`. */
function formatDayHeader(date: string): string {
  return date.slice(5).replace("-", ".");
}

/** JS `Date.getUTCDay()`는 일요일이 0이다 — 월요일을 0으로 다시 세팅한다. */
function weekdayOf(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return WEEKDAY_EN[(d.getUTCDay() + 6) % 7];
}

function weekdayEnglishOf(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return WEEKDAY_EN_FULL[(d.getUTCDay() + 6) % 7];
}

/**
 * 그날의 관찰 문구 — TDS가 있는 잔 중 가장 최근(`brewedAt` 최대) 잔의 진단. 카드마다 넣지 않고 1회만
 * 보여준다(docs/specs/2026-10-11-home-fidelity.md AC-HOMEFIT-12·17).
 */
function observationOf(logs: BrewLogSummary[]): string | undefined {
  const measured = logs.filter((log) => log.tdsPercent !== undefined);
  if (measured.length === 0) return undefined;
  return measured.reduce((a, b) => (b.brewedAt > a.brewedAt ? b : a)).diagnosis;
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

  const notice = ownerNickname !== undefined && (
    <p className="rounded-control border-l-2 border-accent bg-surface px-3 py-2 text-body-sm leading-[1.65]">
      맞팔로우 상태여서 {ownerNickname} 님의 기록이 보입니다.
    </p>
  );

  if (variant === "web") {
    const observation = observationOf(logs);
    // 웹 칼럼은 머리가 고정이고 카드 영역만 스크롤한다 — 값은 목업 CW1
    // (docs/specs/2026-10-11-home-fidelity.md AC-HOMEFIT-10·18).
    return (
      <div
        data-day-list
        data-variant={variant}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="flex flex-none flex-col gap-[7px] pb-[18px]">
          <Eyebrow>
            {weekdayEnglishOf(date)}
            {ownerNickname !== undefined ? ` · ${ownerNickname}` : ""}
          </Eyebrow>
          <div className="flex items-baseline justify-between gap-3">
            <p
              data-testid="day-header-date"
              className="text-[26px] font-semibold tracking-[-0.025em]"
            >
              {Number(date.slice(5, 7))}월 {Number(date.slice(8, 10))}일
            </p>
            <span
              data-testid="day-header-count"
              className="font-mono text-[12px] text-ink-3"
            >
              {brewCountLabel(logs.length).toLowerCase()}
            </span>
          </div>
        </div>
        <div
          data-testid="day-cards"
          className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto"
        >
          <ul className="flex flex-col gap-3.5">
            {logs.map((log) => (
              <li key={log.id}>
                <DayCard
                  log={log}
                  recipeLabel={recipeLabels?.get(log.recipeId)}
                />
              </li>
            ))}
          </ul>
          {observation !== undefined && (
            <div
              data-observation
              className="rounded-r-[10px] border-l-2 border-accent bg-paper px-[18px] py-4"
            >
              <p className="mb-1.5 font-mono text-[9.5px] tracking-[0.12em] text-accent uppercase">
                Observation
              </p>
              <p className="text-[13.5px] leading-[1.65] text-ink-2">
                {observation}
              </p>
            </div>
          )}
          {notice}
        </div>
      </div>
    );
  }

  return (
    <div data-day-list data-variant={variant}>
      <p className="text-label text-ink-3">{header}</p>
      <ul>
        {logs.map((log) => (
          <DayListRow
            key={log.id}
            log={log}
            recipeLabel={recipeLabels?.get(log.recipeId)}
            variant={variant}
          />
        ))}
      </ul>
      {notice}
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
