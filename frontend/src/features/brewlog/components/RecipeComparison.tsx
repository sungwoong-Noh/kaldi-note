import { formatDuration, formatGrams, formatTemperature } from "@/lib/format";
import { SectionLabel } from "@/components/kit";
import { diffPhrase } from "../diffPhrase";
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
  /** 차이를 옮긴 한국어 문장. 같거나 기준값이 없으면 `null`이다. */
  readonly phrase: string | null;
}

/**
 * 분쇄도 비교에 필요한 값. **같은 모델일 때만** 부르는 쪽이 넘긴다 — 모델이 다르면 「22 클릭」은
 * 다른 굵기다(docs/specs/2026-10-11-brew-detail-fidelity.md 「분쇄도 비교」).
 */
export interface GrindComparison {
  readonly target?: number;
  readonly actual?: number;
  /** `클릭`·`μm`·없으면 `""` */
  readonly unit: string;
}

const withUnit = (value: number, unit: string) =>
  [String(value), unit].filter(Boolean).join(" ");

function buildRows(
  log: BrewLog,
  targets: RecipeTargets,
  grind: GrindComparison | null,
): Row[] {
  const rows: Row[] = [
    {
      label: "원두량",
      target: formatGrams(targets.doseG),
      actual: formatGrams(log.actualDoseG),
      differs: targets.doseG !== log.actualDoseG,
      phrase: diffPhrase("weight", "원두", targets.doseG, log.actualDoseG),
    },
    {
      label: "물량",
      target: formatGrams(targets.waterG),
      actual: formatGrams(log.actualWaterG),
      differs: targets.waterG !== log.actualWaterG,
      phrase: diffPhrase("weight", "물", targets.waterG, log.actualWaterG),
    },
    {
      label: "물 온도",
      target:
        targets.waterTempC === undefined
          ? undefined
          : formatTemperature(targets.waterTempC),
      actual: formatTemperature(log.actualWaterTempC),
      differs: targets.waterTempC !== log.actualWaterTempC,
      phrase: diffPhrase(
        "temperature",
        "물",
        targets.waterTempC,
        log.actualWaterTempC,
      ),
    },
  ];
  if (grind !== null) {
    rows.push({
      label: "분쇄도",
      target:
        grind.target === undefined
          ? undefined
          : withUnit(grind.target, grind.unit),
      actual:
        grind.actual === undefined ? "—" : withUnit(grind.actual, grind.unit),
      differs: grind.target !== grind.actual,
      phrase: diffPhrase("grind", grind.unit, grind.target, grind.actual),
    });
  }
  rows.push({
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
    phrase: diffPhrase(
      "duration",
      "추출",
      targets.totalTimeSeconds,
      log.actualTotalTimeSeconds,
    ),
  });
  return rows;
}

/** 웹 차이 칸 — 문장, 같으면 `같습니다.`, 기준값이 없으면 `—`(AC-BDETAIL-05·15). */
function diffCell(row: Row): string {
  if (row.phrase !== null) return row.phrase;
  return row.target === undefined ? "—" : "같습니다.";
}

const HEAD =
  "py-[10px] text-right font-mono text-[9.5px] font-normal tracking-[0.1em] text-ink-3 uppercase";

export function RecipeComparison({
  log,
  targets,
  grind = null,
  wide = false,
}: {
  log: BrewLog;
  targets: RecipeTargets;
  grind?: GrindComparison | null;
  /** ≥1100px — 4열 표(항목·레시피·실제·차이). 좁은 폭은 문장을 행 아래에 붙인다 */
  wide?: boolean;
}) {
  const rows = buildRows(log, targets, grind);

  if (wide) {
    return (
      <section data-compare className="flex flex-col gap-[10px]">
        <div className="flex items-baseline justify-between gap-2">
          <SectionLabel>레시피 / 실제</SectionLabel>
          <span className="text-[12.5px] text-ink-3">현재 레시피와 비교</span>
        </div>
        <table className="w-full table-fixed border-collapse">
          <colgroup>
            <col />
            <col style={{ width: 110 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 230 }} />
          </colgroup>
          <thead className="border-b border-divider">
            <tr>
              <th scope="col" className={`${HEAD} text-left`}>
                항목
              </th>
              <th scope="col" className={HEAD}>
                레시피
              </th>
              <th scope="col" className={HEAD}>
                실제
              </th>
              <th scope="col" className={HEAD}>
                차이
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.label}
                data-compare-row={row.label}
                className="border-b border-divider"
              >
                <th
                  scope="row"
                  data-compare-label
                  className="py-[14px] text-left text-[14.5px] font-normal text-ink"
                >
                  {row.label}
                </th>
                <td className="py-[14px] text-right font-mono text-[14px] font-medium text-ink-3">
                  {row.target ?? "—"}
                </td>
                <td
                  data-diff={row.differs}
                  className={`py-[14px] text-right font-mono text-[14px] font-medium ${
                    row.differs ? "text-accent" : "text-ink"
                  }`}
                >
                  {row.actual}
                </td>
                <td
                  data-diff-text={row.phrase !== null ? "" : undefined}
                  className={`py-[14px] pl-[12px] text-right text-[13px] ${
                    row.phrase !== null ? "text-accent" : "text-ink-3"
                  }`}
                >
                  {diffCell(row)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    );
  }

  return (
    <section data-compare className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-card-title font-semibold">레시피대로 내렸나</h2>
        <span className="text-body-sm text-ink-3">현재 레시피와 비교</span>
      </div>

      <dl className="flex flex-col gap-1">
        <div className="flex items-baseline gap-3 text-body-sm text-ink-3">
          <dt className="sr-only">항목</dt>
          <dd className="flex-1" />
          <dd className="w-20 text-right">레시피</dd>
          <dd className="w-20 text-right">실제</dd>
        </div>

        {rows.map((row) => (
          <div
            key={row.label}
            data-compare-row={row.label}
            className="flex flex-col gap-1 border-t border-border py-2 text-body"
          >
            <div className="flex items-baseline gap-3">
              <dt data-compare-label className="flex-1">
                {row.label}
              </dt>
              <dd className="w-20 text-right font-num tabular-nums text-ink-3">
                {row.target ?? "—"}
              </dd>
              {/* 같으면 조용하고 다를 때만 드러난다(색만 — 굵기는 목업 W3대로 mono 500, AC-GRAMMAR-22). */}
              <dd
                data-diff={row.differs}
                className={`w-20 text-right font-num tabular-nums ${
                  row.differs ? "text-accent" : ""
                }`}
              >
                {row.actual}
              </dd>
            </div>
            {/*
              숫자만 덜렁 보여주지 않는 것이 이 화면의 요점이다 — 얼마나 달랐는지를
              사용자가 암산하게 두지 않는다(docs/specs/2026-09-17-small-features.md).
            */}
            {row.phrase !== null && (
              <dd
                data-diff-text
                className="text-right text-body-sm text-accent"
              >
                {row.phrase}
              </dd>
            )}
          </div>
        ))}
      </dl>
    </section>
  );
}
