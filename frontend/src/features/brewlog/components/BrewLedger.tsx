"use client";

import Link from "next/link";
import {
  formatLedgerGroupHeading,
  resolveLedgerEntryPresentation,
  type BrewDateGroup,
} from "../brewLedgerPresentation";
import type { BeanMetadataSources } from "../useTodayMetadata";

/**
 * 시안 F1(모바일)·FW(웹) 날짜 그룹 원장.
 * 날짜별로 묶고, 첫 행 위와 마지막 행 아래는 `divider-strong` 선을 쓴다.
 */
export function BrewLedger({
  groups,
  isWide,
  today,
  recipeLabels,
  beanSources,
  registerDateGroupRef,
}: {
  groups: readonly BrewDateGroup[];
  isWide: boolean;
  today: string;
  recipeLabels: ReadonlyMap<number, string>;
  beanSources: BeanMetadataSources;
  registerDateGroupRef: (date: string) => (el: HTMLElement | null) => void;
}) {
  return (
    <div
      data-brew-ledger={isWide ? "web" : "mobile"}
      className="flex flex-col"
    >
      {groups.map((group) => (
        <section
          key={group.date}
          data-date-group={group.date}
          ref={registerDateGroupRef(group.date)}
        >
          <h2
            className={
              isWide
                ? "px-[4px] pt-[16px] pb-[6px] font-mono text-[10.5px] tracking-[0.1em] text-ink-3"
                : "pt-[14px] pb-[4px] font-mono text-[10.5px] tracking-[0.1em] text-ink-3"
            }
          >
            {formatLedgerGroupHeading(group.date, today)}
          </h2>
          <ul>
            {group.logs.map((log) => {
              const entry = resolveLedgerEntryPresentation(log, {
                recipeLabels,
                beanSources,
              });
              return (
                <li
                  key={log.id}
                  className="border-t border-divider first:border-divider-strong last:border-b last:border-b-divider-strong"
                >
                  {isWide ? (
                    <Link
                      href={`/brews/${log.id}`}
                      className="flex min-h-11 items-center gap-[16px] px-[4px] py-[14px]"
                    >
                      <span className="w-[72px] shrink-0 font-mono text-[12px] text-ink-3">
                        {entry.timeText}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                        <span className="truncate text-[14.5px] font-medium text-ink">
                          {entry.title}
                        </span>
                        <span className="truncate text-[12.5px] text-ink-3">
                          {entry.isRecipeBrew ? (
                            "레시피"
                          ) : (
                            <DoseWaterValue
                              doseText={entry.doseText}
                              waterText={entry.waterText}
                            />
                          )}
                        </span>
                      </span>
                      <span className="w-[140px] shrink-0 text-right font-mono text-[13px] text-ink-2 min-[1280px]:w-[170px]">
                        {entry.isRecipeBrew ? (
                          <DoseWaterValue
                            doseText={entry.doseText}
                            waterText={entry.waterText}
                          />
                        ) : (
                          (entry.ratioText ?? "")
                        )}
                      </span>
                      <span className="w-[64px] shrink-0 text-right font-mono text-[14px] font-medium text-ink">
                        {entry.metric ?? ""}
                      </span>
                    </Link>
                  ) : (
                    <Link
                      href={`/brews/${log.id}`}
                      className="flex min-h-11 items-center gap-[12px] py-[14px]"
                    >
                      <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                        <span className="truncate text-[14.5px] font-medium text-ink">
                          {entry.title}
                        </span>
                        <span className="truncate font-mono text-[11.5px] text-ink-3">
                          {[
                            entry.timeText,
                            entry.isRecipeBrew ? "레시피" : undefined,
                            entry.compactDoseWater,
                            !entry.isRecipeBrew ? entry.ratioText : undefined,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      {entry.metric !== undefined && (
                        <span className="shrink-0 font-mono text-[14px] font-medium text-ink">
                          {entry.metric}
                        </span>
                      )}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function DoseWaterValue({
  doseText,
  waterText,
}: {
  doseText: string | undefined;
  waterText: string | undefined;
}) {
  if (doseText === undefined && waterText === undefined) return null;
  return (
    <>
      {doseText !== undefined && <span className="font-num">{doseText}</span>}
      {doseText !== undefined && waterText !== undefined && " → "}
      {waterText !== undefined && <span className="font-num">{waterText}</span>}
    </>
  );
}
