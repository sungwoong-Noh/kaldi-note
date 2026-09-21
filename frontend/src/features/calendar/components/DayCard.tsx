import Link from "next/link";
import type { BrewLogSummary } from "@/features/brewlog/schema";
import { Badge, Card } from "@/components/ui";
import {
  formatDuration,
  formatRatio,
  formatTemperature,
} from "@/lib/format";
import { kstTimeOf, representativeMetric } from "../dayListFormat";
import { useRoastLevel } from "../useRoastLevel";
import { RoastDot } from "./RoastDot";

/**
 * 웹 우측 컬럼 전용 카드 — 원장 행 대신 쓴다(AC-HOMECAL-112~117,
 * docs/specs/2026-09-20-home-calendar-mockup-fidelity.md).
 *
 * <p>목업은 상단 캡션을 "원두·기구·시각"으로 정의하지만, `BrewLogSummary`에는 원두·기구
 * 이름이 없다(둘 다 별도 엔티티 조회가 필요하고 이 계획의 범위 밖이다 — Recipe가 원두를
 * 참조하지 않는 것과 같은 종류의 제약). **시각만** 표시한다.
 */
export function DayCard({
  log,
  recipeLabel,
}: {
  log: BrewLogSummary;
  recipeLabel?: string;
}) {
  const roastLevel = useRoastLevel(log.beanBatchId, true);
  const time = kstTimeOf(log.brewedAt);

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
          <span className="block truncate text-body font-semibold">
            {recipeLabel ?? ""}
          </span>
          <span className="text-caption text-ink-3">{time}</span>
        </span>
        <span data-testid="day-card-metric" className="text-card-metric">
          {representativeMetric(log)}
        </span>
      </Link>

      <div className="flex flex-wrap gap-2 border-t border-divider pt-3">
        {log.brewRatio !== undefined && (
          <Badge tone="accent">{formatRatio(log.brewRatio)}</Badge>
        )}
        <Badge>{formatTemperature(log.actualWaterTempC)}</Badge>
        {log.actualTotalTimeSeconds !== undefined && (
          <Badge>{formatDuration(log.actualTotalTimeSeconds)}</Badge>
        )}
        {log.rating !== undefined && <Badge>★ {log.rating}</Badge>}
      </div>

      {log.overallNote !== undefined && (
        <p data-testid="day-card-note" className="text-body-sm text-ink-2 italic">
          {log.overallNote}
        </p>
      )}

      {log.diagnosis !== undefined && (
        <p className="border-l-2 border-accent bg-surface px-3 py-2 text-body-sm">
          {log.diagnosis}
        </p>
      )}
    </Card>
  );
}
