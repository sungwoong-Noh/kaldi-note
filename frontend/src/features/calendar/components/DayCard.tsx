import Link from "next/link";
import type { BrewLogSummary } from "@/features/brewlog/schema";
import { useBrewSubParts } from "@/features/brewlog/useEntityLabels";
import { Badge, Card } from "@/components/ui";
import {
  formatDuration,
  formatRatio,
  formatTemperatureCompact,
} from "@/lib/format";
import { kstTimeOf, representativeMetric } from "../dayListFormat";
import { useRoastLevel } from "../useRoastLevel";
import { RoastDot } from "@/components/ui";

/**
 * 웹 우측 컬럼 전용 카드 — 원장 행 대신 쓴다(AC-HOMECAL-112~117,
 * docs/specs/2026-09-20-home-calendar-mockup-fidelity.md).
 *
 * <p>캡션은 `원두 · 드리퍼 · 시각`이고 못 읽은 조각은 빠진다 — 「내 잔」 표 보조줄과 같은 조회다.
 * 진단은 카드에 넣지 않는다. 그날 1회만 `DayList`의 관찰 블록이 보여준다
 * (docs/specs/2026-10-11-home-fidelity.md AC-HOMEFIT-11·12·15·16·21).
 */
export function DayCard({
  log,
  recipeLabel,
}: {
  log: BrewLogSummary;
  recipeLabel?: string;
}) {
  const roastLevel = useRoastLevel(log.beanBatchId, true);
  const caption = [...useBrewSubParts(log), kstTimeOf(log.brewedAt)].join(
    " · ",
  );

  return (
    <Card
      data-testid="day-card"
      tone="outlined"
      pad="loose"
      className="flex flex-col gap-3 bg-paper"
    >
      <Link href={`/brews/${log.id}`} className="flex items-start gap-2">
        <RoastDot roastLevel={roastLevel} size={10} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15.5px] font-semibold">
            {recipeLabel ?? ""}
          </span>
          <span className="mt-1 block truncate text-[12px] text-ink-3">
            {caption}
          </span>
        </span>
        <span data-testid="day-card-metric" className="text-card-metric">
          {representativeMetric(log)}
        </span>
      </Link>

      <div className="flex flex-wrap gap-2 border-t border-divider pt-3">
        {log.brewRatio !== undefined && (
          <Badge tone="accent">{formatRatio(log.brewRatio)}</Badge>
        )}
        <Badge>{formatTemperatureCompact(log.actualWaterTempC)}</Badge>
        {log.actualTotalTimeSeconds !== undefined && (
          <Badge>{formatDuration(log.actualTotalTimeSeconds)}</Badge>
        )}
        {log.rating !== undefined && <Badge>★ {log.rating}</Badge>}
      </div>

      {log.overallNote !== undefined && (
        <p
          data-testid="day-card-note"
          className="text-body-sm text-ink-2 italic"
        >
          {log.overallNote}
        </p>
      )}
    </Card>
  );
}
