import { formatDuration, formatGrams, formatTemperature } from "@/lib/format";
import type { RecipeTargets } from "../useEntityLabels";
import type { BrewLog } from "../schema";

/**
 * 레시피가 설계한 값과 실제로 넣은 값을 나란히 놓는다 — docs/specs/2026-09-15-structure.md
 *
 * <p><b>이 서비스의 존재 이유가 여기 있다.</b> 「같은 레시피를 여러 번 내렸을 때 결과 차이를
 * 추적하는 것」(CLAUDE.md 설계 결정 1)인데, 지금까지 화면이 그 대비를 보여주지 않았다.
 *
 * <p><b>비교 대상은 「지금의 레시피」다.</b> 레시피를 나중에 고치면 과거 기록의 비교가 새 값
 * 기준이 된다. 기록 자체(actual_*)는 불변이라 조작되지 않지만, 「그때 설계값」은 어디에도
 * 저장돼 있지 않다. 그래서 「현재 레시피와 비교」라고 밝힌다 — 모르는 것을 아는 척하지 않는다.
 */

interface Row {
  readonly label: string;
  readonly target?: string;
  readonly actual: string;
  readonly differs: boolean;
}

function buildRows(log: BrewLog, targets: RecipeTargets): Row[] {
  return [
    {
      label: "원두량",
      target: formatGrams(targets.doseG),
      actual: formatGrams(log.actualDoseG),
      differs: targets.doseG !== log.actualDoseG,
    },
    {
      label: "물량",
      target: formatGrams(targets.waterG),
      actual: formatGrams(log.actualWaterG),
      differs: targets.waterG !== log.actualWaterG,
    },
    {
      label: "물 온도",
      target:
        targets.waterTempC === undefined
          ? undefined
          : formatTemperature(targets.waterTempC),
      actual: formatTemperature(log.actualWaterTempC),
      differs: targets.waterTempC !== log.actualWaterTempC,
    },
    {
      label: "추출 시간",
      target:
        targets.totalTimeSeconds === undefined
          ? undefined
          : formatDuration(targets.totalTimeSeconds),
      actual:
        log.actualTotalTimeSeconds === undefined
          ? "—"
          : formatDuration(log.actualTotalTimeSeconds),
      differs: targets.totalTimeSeconds !== log.actualTotalTimeSeconds,
    },
  ];
}

export function RecipeComparison({
  log,
  targets,
}: {
  log: BrewLog;
  targets: RecipeTargets;
}) {
  const rows = buildRows(log, targets);

  return (
    <section data-compare className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">레시피대로 내렸나</h2>
        <span className="text-sm text-ink-3">현재 레시피와 비교</span>
      </div>

      <dl className="flex flex-col gap-1">
        <div className="flex items-baseline gap-3 text-sm text-ink-3">
          <dt className="sr-only">항목</dt>
          <dd className="flex-1" />
          <dd className="w-20 text-right">레시피</dd>
          <dd className="w-20 text-right">실제</dd>
        </div>

        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-baseline gap-3 border-t border-border py-2 text-base"
          >
            <dt data-compare-label className="flex-1">
              {row.label}
            </dt>
            <dd className="w-20 text-right tabular-nums text-ink-3">
              {row.target ?? "—"}
            </dd>
            {/* 같으면 조용하고 다를 때만 드러난다. 값 자체는 언제나 보인다. */}
            <dd
              data-diff={row.differs}
              className={`w-20 text-right tabular-nums ${
                row.differs ? "font-semibold text-accent" : ""
              }`}
            >
              {row.actual}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
