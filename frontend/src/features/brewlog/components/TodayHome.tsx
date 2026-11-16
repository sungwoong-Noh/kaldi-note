"use client";

import Link from "next/link";
import { RoastDot } from "@/components/ui/RoastDot";
import { formatRatio, formatTemperatureCompact } from "@/lib/format";
import { openQuickBrew } from "@/lib/quickBrew";
import { useIsWide } from "@/lib/useIsWide";
import type { BrewLogSummary } from "../schema";
import {
  formatCompactDoseWater,
  formatMonthDayWeekday,
  formatRelativeBrewStamp,
  formatTodayEyebrow,
  observationOf,
  recentHeadlineMetric,
  beanDetailHref,
  resolveBeanSummary,
  formatGrinderSetting,
  trimTrailingZero,
  type BeanSummary,
} from "../todayPresentation";
import type { TodayMetadata } from "../useTodayMetadata";
import type { WeekSummary } from "../weekSummary";

export interface TodayHomeProps {
  readonly todayKst: string;
  readonly logs: readonly BrewLogSummary[];
  readonly week: WeekSummary;
  readonly metadata: TodayMetadata;
  readonly fadeIn: boolean;
}

/**
 * 시안 A(오늘) 홈 화면 — 기록 0건이면 빈 첫 화면(A2), 기록이 있으면
 * 「기록하기」 · 「지난번과 같게」 · 「이번 주」 · 「최근 기록」(A1/AW)을 그린다.
 */
export function TodayHome({
  todayKst,
  logs,
  week,
  metadata,
  fadeIn,
}: TodayHomeProps) {
  const isWide = useIsWide();
  const rootClass = `mx-auto flex w-full max-w-[1080px] flex-col ${fadeIn ? "kn-today-fade-in" : ""}`;

  if (logs.length === 0) {
    return (
      <div className={`${rootClass} min-h-[calc(100dvh-160px)]`}>
        <TodayHeader todayKst={todayKst} showWebCta={false} />
        <TodayEmptyState />
      </div>
    );
  }

  const last = logs[0];
  const observation = isWide ? observationOf(logs) : undefined;
  const visibleLogs = logs.slice(0, isWide ? 5 : 3);
  const hasAside = week.showCard || observation !== undefined;

  return (
    <div
      className={`${rootClass} gap-[18px] min-[1100px]:grid min-[1100px]:grid-cols-[minmax(0,1fr)_300px] min-[1100px]:grid-rows-[auto_auto_1fr] min-[1100px]:gap-x-[40px] min-[1100px]:gap-y-[20px]`}
    >
      <div className="min-[1100px]:col-start-1 min-[1100px]:row-start-1">
        <TodayHeader todayKst={todayKst} showWebCta={isWide} />
      </div>

      {!isWide && <TodayMobileCtaCard />}

      <div className="min-[1100px]:col-start-1 min-[1100px]:row-start-2">
        <TodayLastBrewCard
          log={last}
          todayKst={todayKst}
          isWide={isWide}
          metadata={metadata}
        />
      </div>

      {hasAside && (
        <aside className="flex flex-col gap-[14px] min-[1100px]:col-start-2 min-[1100px]:row-span-2 min-[1100px]:row-start-2 min-[1100px]:self-start">
          {week.showCard && <TodayWeekCard week={week} />}
          {observation !== undefined && <TodayObservation text={observation} />}
        </aside>
      )}

      <div className="min-[1100px]:col-start-1 min-[1100px]:row-start-3">
        <TodayRecentLogs
          logs={visibleLogs}
          isWide={isWide}
          metadata={metadata}
        />
      </div>
    </div>
  );
}

function TodayHeader({
  todayKst,
  showWebCta,
}: {
  todayKst: string;
  showWebCta: boolean;
}) {
  return (
    <div className="flex items-end justify-between gap-[12px]">
      <div className="flex flex-col gap-[7px] min-[1100px]:gap-[8px]">
        <div className="font-mono text-[10px] font-medium tracking-[0.12em] text-ink-3 uppercase">
          {formatTodayEyebrow(todayKst)}
        </div>
        <h1 className="text-[27px] leading-[1.15] font-semibold tracking-[-0.03em] text-ink min-[1100px]:text-[32px]">
          오늘도 한 잔 내려 볼까요?
        </h1>
      </div>

      {showWebCta && (
        <button
          type="button"
          onClick={() => openQuickBrew("record")}
          className="hit-44 kn-press shrink-0 rounded-[8px] border border-ink bg-ink px-[34px] py-[16px] text-center text-[17px] font-semibold tracking-[-0.01em] text-on-ink"
        >
          기록하기
        </button>
      )}
    </div>
  );
}

function TodayEmptyState() {
  return (
    <section className="flex flex-1 flex-col justify-center gap-[18px] py-[24px] min-[1100px]:max-w-[440px]">
      <div className="flex flex-col gap-[8px]">
        <h2 className="text-[21px] font-semibold tracking-[-0.02em] text-ink">
          첫 잔을 기록해 보세요
        </h2>
        <p className="text-[14.5px] leading-[1.65] text-ink-2">
          원두량과 물량만 적으면 됩니다.
          <br />
          원두와 맛은 나중에 채워도 괜찮아요.
        </p>
      </div>
      <div>
        <button
          type="button"
          onClick={() => openQuickBrew("record")}
          className="hit-44 kn-press w-full rounded-[8px] border border-ink bg-ink px-[16px] py-[19px] text-center text-[17px] font-semibold tracking-[-0.01em] text-on-ink min-[1100px]:w-auto min-[1100px]:px-[34px] min-[1100px]:py-[16px]"
        >
          기록하기
        </button>
      </div>
    </section>
  );
}

function TodayMobileCtaCard() {
  return (
    <button
      type="button"
      onClick={() => openQuickBrew("record")}
      className="hit-44 kn-press flex w-full items-center justify-between gap-[12px] rounded-[14px] bg-ink p-[20px] text-left text-on-ink"
    >
      <span className="flex flex-col gap-[4px]">
        <span className="text-[19px] font-semibold tracking-[-0.02em]">
          기록하기
        </span>
        <span className="text-[13px] opacity-75">
          원두량과 물량만 있으면 돼요
        </span>
      </span>
      <span aria-hidden="true" className="font-mono text-[20px] font-medium">
        →
      </span>
    </button>
  );
}

export function TodayLastBrewCard({
  log,
  todayKst,
  isWide,
  metadata,
}: {
  log: BrewLogSummary;
  todayKst: string;
  isWide: boolean;
  metadata: TodayMetadata;
}) {
  const bean = resolveBeanSummary(log, metadata);
  const beanHref = beanDetailHref(log);
  const when = formatRelativeBrewStamp(log.brewedAt, todayKst);
  const grindSettingUnit =
    log.recipeId !== undefined
      ? metadata.recipeGrindUnitsById.get(log.recipeId)
      : undefined;
  const { grinderName, settingText } = formatGrinderSetting(
    log,
    metadata.grinders,
    grindSettingUnit,
  );
  const gearLine = [
    grinderName,
    settingText,
    log.actualWaterTempC !== undefined &&
      formatTemperatureCompact(log.actualWaterTempC),
  ]
    .filter(Boolean)
    .join(" · ");
  const beanSub = bean
    ? [bean.roasterName, bean.roastLabel].filter(Boolean).join(" · ")
    : "";

  const doseWater = (
    <DoseWaterReadout
      doseG={log.actualDoseG}
      waterG={log.actualWaterG}
      ratio={log.brewRatio}
      className={isWide ? "w-[300px]" : ""}
    />
  );

  return (
    <section
      className={
        isWide
          ? "flex flex-row items-center gap-[28px] rounded-[12px] border border-border bg-surface px-[24px] py-[22px]"
          : "flex flex-col gap-[14px] rounded-[12px] border border-border bg-surface p-[18px]"
      }
    >
      <div className="flex min-w-0 flex-1 flex-col gap-[12px]">
        <div className="flex items-center justify-between gap-[8px]">
          <span className="font-mono text-[10px] font-medium tracking-[0.12em] text-ink-3 uppercase">
            {isWide ? `지난번과 같게 · ${when}` : "지난번과 같게"}
          </span>
          {!isWide && (
            <span className="font-mono text-[11px] font-medium text-ink-3">
              {when}
            </span>
          )}
        </div>

        {bean !== undefined && (
          <div className="flex items-center gap-[11px]">
            <RoastDot roastLevel={bean.roastLevel} size={11} />
            <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
              {beanHref ? (
                <Link
                  href={beanHref}
                  className="truncate text-[15px] font-semibold text-ink"
                >
                  {bean.name}
                </Link>
              ) : (
                <div className="truncate text-[15px] font-semibold text-ink">
                  {bean.name}
                </div>
              )}
              {beanSub !== "" && (
                <div className="truncate text-[12.5px] text-ink-3">
                  {beanSub}
                </div>
              )}
            </div>
          </div>
        )}

        {!isWide && doseWater}

        {gearLine !== "" && (
          <div className="font-mono text-[12.5px] font-medium text-ink-3">
            {gearLine}
          </div>
        )}
      </div>

      {isWide && doseWater}

      <button
        type="button"
        onClick={() => openQuickBrew("same")}
        className={
          isWide
            ? "hit-44 kn-press w-auto flex-none rounded-[8px] border border-border bg-surface-muted px-[20px] py-[12px] text-center text-[14px] font-semibold tracking-[-0.01em] text-ink"
            : "hit-44 kn-press w-full flex-none rounded-[8px] border border-border bg-surface-muted px-[16px] py-[15px] text-center text-[15px] font-semibold tracking-[-0.01em] text-ink"
        }
      >
        이대로 기록
      </button>
    </section>
  );
}

function DoseWaterReadout({
  doseG,
  waterG,
  ratio,
  className = "",
}: {
  doseG?: number;
  waterG?: number;
  ratio?: number;
  className?: string;
}) {
  if (doseG === undefined && waterG === undefined) return null;

  return (
    <div className={`flex flex-wrap items-baseline gap-[10px] ${className}`}>
      {doseG !== undefined && (
        <span className="font-mono text-[32px] leading-none font-medium tracking-[-0.04em] text-ink tabular-nums min-[1100px]:text-[34px]">
          {trimTrailingZero(doseG)}
          <span className="ml-[3px] text-[15px] tracking-normal text-ink-3">
            g
          </span>
        </span>
      )}
      {doseG !== undefined && waterG !== undefined && (
        <span
          aria-hidden="true"
          className="font-mono text-[20px] font-medium text-ink-3"
        >
          →
        </span>
      )}
      {waterG !== undefined && (
        <span className="font-mono text-[32px] leading-none font-medium tracking-[-0.04em] text-ink tabular-nums min-[1100px]:text-[34px]">
          {trimTrailingZero(waterG)}
          <span className="ml-[3px] text-[15px] tracking-normal text-ink-3">
            g
          </span>
        </span>
      )}
      {ratio !== undefined && (
        <span className="ml-auto rounded-[3px] bg-accent-wash px-[9px] py-[5px] font-mono text-[11.5px] font-medium whitespace-nowrap text-accent tabular-nums">
          {formatRatio(ratio)}
        </span>
      )}
    </div>
  );
}

function TodayWeekCard({ week }: { week: WeekSummary }) {
  return (
    <section
      data-week-card
      className="flex items-center justify-between gap-[12px] rounded-[12px] border border-border bg-surface px-[18px] py-[16px]"
    >
      <div className="flex flex-col gap-[4px]">
        <div className="font-mono text-[10px] font-medium tracking-[0.12em] text-ink-3 uppercase">
          이번 주
        </div>
        <div className="flex items-baseline gap-[6px]">
          <span className="kn-num-flip font-mono text-[26px] leading-none font-medium tracking-[-0.04em] text-ink tabular-nums">
            {week.thisWeekCount}
          </span>
          <span className="text-[13px] text-ink-2">잔</span>
          <span className="ml-[4px] text-[12px] text-ink-3">
            지난주 {week.lastWeekCount}잔
          </span>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-[8px]">
        {week.days.map((day) => (
          <div key={day.date} className="flex flex-col items-center gap-[6px]">
            <span className="font-mono text-[10px] font-medium text-ink-3">
              {day.weekday}
            </span>
            <span
              aria-hidden="true"
              className={`size-[6px] rounded-full ${day.active ? "bg-accent" : "bg-border"}`}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function TodayObservation({ text }: { text: string }) {
  return (
    <section className="flex flex-col gap-[6px] rounded-r-[8px] border-l-2 border-accent bg-surface px-[16px] py-[14px]">
      <div className="font-mono text-[9.5px] font-medium tracking-[0.14em] text-accent uppercase">
        관찰
      </div>
      <p className="text-[13.5px] leading-[1.65] text-ink-2">{text}</p>
    </section>
  );
}

function TodayRecentLogs({
  logs,
  isWide,
  metadata,
}: {
  logs: readonly BrewLogSummary[];
  isWide: boolean;
  metadata: TodayMetadata;
}) {
  return (
    <section className="flex flex-col">
      <div className="flex items-baseline justify-between pt-[8px] pb-[10px]">
        <h2 className="text-[17px] font-semibold tracking-[-0.015em] text-ink min-[1100px]:text-[18px]">
          최근 기록
        </h2>
        <Link
          href="/brews"
          className="hit-44 inline-flex items-center text-[13px] text-ink-3 hover:text-ink"
        >
          전체 보기
        </Link>
      </div>

      <div>
        {logs.map((log, index) => (
          <RecentLogRow
            key={log.id}
            log={log}
            isFirst={index === 0}
            isLast={index === logs.length - 1}
            isWide={isWide}
            metadata={metadata}
          />
        ))}
      </div>
    </section>
  );
}

function RecentLogRow({
  log,
  isFirst,
  isLast,
  isWide,
  metadata,
}: {
  log: BrewLogSummary;
  isFirst: boolean;
  isLast: boolean;
  isWide: boolean;
  metadata: TodayMetadata;
}) {
  const bean = resolveBeanSummary(log, metadata);
  const recipeTitle =
    log.recipeId !== undefined
      ? metadata.recipeTitlesById.get(log.recipeId)
      : undefined;
  const grindSettingUnit =
    log.recipeId !== undefined
      ? metadata.recipeGrindUnitsById.get(log.recipeId)
      : undefined;
  const doseWater = formatCompactDoseWater(log.actualDoseG, log.actualWaterG);
  const dateWeekday = formatMonthDayWeekday(log.brewedAt);
  const title = recipeTitle || bean?.name || doseWater || "기록";
  const metric = recentHeadlineMetric(log);
  const { grinderName, settingText } = formatGrinderSetting(
    log,
    metadata.grinders,
    grindSettingUnit,
  );

  const borderClass = [
    isFirst ? "border-t border-divider-strong" : "border-t border-divider",
    isLast ? "border-b border-divider-strong" : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (!isWide) {
    const meta = [dateWeekday, recipeTitle && "레시피", doseWater]
      .filter(Boolean)
      .join(" · ");

    return (
      <Link
        href={`/brews/${log.id}`}
        className={`hit-44 flex items-center gap-[12px] py-[14px] ${borderClass}`}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <span className="truncate text-[14.5px] font-medium text-ink">
            {title}
          </span>
          <span className="font-mono text-[11.5px] font-medium text-ink-3 tabular-nums">
            {meta}
          </span>
        </div>
        {metric !== undefined && (
          <span className="shrink-0 font-mono text-[14px] font-medium text-ink tabular-nums">
            {metric}
          </span>
        )}
      </Link>
    );
  }

  const webSub = webRowSubtitle(bean, recipeTitle, grinderName, settingText);

  return (
    <Link
      href={`/brews/${log.id}`}
      className={`hit-44 flex items-center gap-[16px] px-[4px] py-[14px] ${borderClass}`}
    >
      <span className="w-[72px] shrink-0 font-mono text-[12px] font-medium text-ink-3 tabular-nums">
        {dateWeekday}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className="truncate text-[14.5px] font-medium text-ink">
          {title}
        </span>
        {webSub !== "" && (
          <span className="truncate text-[12.5px] text-ink-3">{webSub}</span>
        )}
      </div>
      <span className="w-[170px] shrink-0 text-right font-mono text-[13px] font-medium text-ink-2 tabular-nums">
        {doseWater ?? ""}
      </span>
      <span className="w-[64px] shrink-0 text-right font-mono text-[14px] font-medium text-ink tabular-nums">
        {metric ?? ""}
      </span>
    </Link>
  );
}

function webRowSubtitle(
  bean: BeanSummary | undefined,
  recipeTitle: string | undefined,
  grinderName: string | undefined,
  settingText: string | undefined,
): string {
  if (recipeTitle !== undefined) {
    return ["레시피", bean?.name].filter(Boolean).join(" · ");
  }
  if (bean?.isDirectName) {
    return "원두 이름 직접 입력";
  }
  const grinderCompact = [grinderName, settingText].filter(Boolean).join(" ");
  return [bean?.roasterName, grinderCompact].filter(Boolean).join(" · ");
}
