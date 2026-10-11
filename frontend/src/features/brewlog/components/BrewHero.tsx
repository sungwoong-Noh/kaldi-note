import type { ReactNode } from "react";
import {
  formatDuration,
  formatGrams,
  formatGramsCompact,
  formatTemperatureCompact,
} from "@/lib/format";
import { parseMinSec, previewRatio, previewYield } from "../formState";
import type { BrewLogFormState } from "../formState";
import type { RecipeTargets } from "../useEntityLabels";

/**
 * 기록 폼의 히어로 — 입력하는 동안 실측 비율을 보여준다(docs/specs/2026-10-11-brew-form-fidelity.md).
 *
 * <p>대표 수치는 비율이다. 수율은 TDS가 있어야만 나오므로 대표로 세우면 대부분 빈 판이 된다. 둘 다 저장 전
 * 미리보기라 클라이언트가 계산한다.
 *
 * <p>웹은 실측 3열(아래에 레시피 값을 흐리게) + 수율·TDS·음료 줄(AC-BREWFIT-06·07). 모바일은 원두량·물량
 * 칩(`chips`) + 레시피 기준값 한 줄(AC-BREWFIT-10).
 */
export function BrewHero({
  wide,
  state,
  targets,
  chips,
}: {
  wide: boolean;
  state: BrewLogFormState;
  /** 레시피 기준값. 원본 레시피가 지워졌으면 없다 — 기준 표시를 모두 뺀다(AC-BREWFIT-20) */
  targets?: RecipeTargets;
  chips?: ReactNode;
}) {
  const ratio = previewRatio(state.actualDoseG, state.actualWaterG);

  if (!wide) {
    return (
      <div
        data-hero
        className="flex flex-col gap-[14px] rounded-[12px] border border-hero-line bg-hero p-[18px] text-on-hero"
      >
        <Eyebrow />
        <span className="font-mono text-[36px] leading-none font-medium tracking-[-0.04em]">
          {ratio}
        </span>
        <div className="grid grid-cols-2 gap-[8px]">{chips}</div>
        {targets !== undefined && (
          <span className="text-[12.5px] text-on-hero-dim">
            {recipeBaseline(targets)}
          </span>
        )}
      </div>
    );
  }

  const seconds = parseMinSec(state.actualTotalTimeSeconds);
  const yieldPercent = previewYield(
    state.actualDoseG,
    state.beverageWeightG,
    state.tdsPercent,
  );

  return (
    <div
      data-hero
      className="flex flex-col gap-[16px] rounded-[12px] border border-hero-line bg-hero p-[24px] text-on-hero"
    >
      <Eyebrow />
      <span className="font-mono text-[44px] leading-none font-medium tracking-[-0.04em]">
        {ratio}
      </span>
      <hr className="h-px border-0 bg-hero-line" />
      <div className="grid grid-cols-3 gap-[12px]">
        <Col
          label="원두"
          value={
            state.actualDoseG === null ? "—" : formatGrams(state.actualDoseG)
          }
          reference={targets && `레시피 ${trim(targets.doseG)}`}
        />
        <Col
          label="물"
          value={
            state.actualWaterG === null ? "—" : formatGrams(state.actualWaterG)
          }
          reference={targets && `레시피 ${trim(targets.waterG)}`}
        />
        <Col
          label="시간"
          value={typeof seconds === "number" ? formatDuration(seconds) : "—"}
          reference={
            targets?.totalTimeSeconds !== undefined
              ? `레시피 ${formatDuration(targets.totalTimeSeconds)}`
              : undefined
          }
        />
      </div>
      <hr className="h-px border-0 bg-hero-line" />
      <div className="grid grid-cols-3 gap-[12px]">
        <Col
          label="수율"
          value={yieldPercent === null ? "—" : `${yieldPercent} %`}
        />
        <Col
          label="TDS"
          value={state.tdsPercent === null ? "—" : `${state.tdsPercent} %`}
        />
        <Col
          label="음료"
          value={
            state.beverageWeightG === null
              ? "—"
              : formatGrams(state.beverageWeightG)
          }
        />
      </div>
    </div>
  );
}

function Eyebrow() {
  return (
    <span
      data-eyebrow
      className="font-mono text-[10px] tracking-[0.14em] text-on-hero-dim uppercase"
    >
      Ratio · 실측
    </span>
  );
}

function Col({
  label,
  value,
  reference,
}: {
  label: string;
  value: string;
  reference?: string;
}) {
  return (
    <div data-hero-col={label}>
      <div className="font-mono text-[9.5px] tracking-[0.1em] text-on-hero-dim uppercase">
        {label}
      </div>
      <div
        data-hero-value
        className="mt-[4px] font-mono text-[16px] font-medium"
      >
        {value}
      </div>
      {reference !== undefined && (
        <div
          data-hero-reference
          className="mt-[2px] font-mono text-[11px] text-on-hero-dim"
        >
          {reference}
        </div>
      )}
    </div>
  );
}

const trim = (value: number) => value.toFixed(1).replace(/\.0$/, "");

/** `20g → 300g · 92°C · 3:30` — 요약 줄이라 단위를 붙인다(AC-GRAMMAR-07). 레시피에 없는 조각은 뺀다. */
function recipeBaseline(recipe: RecipeTargets): string {
  return [
    `${formatGramsCompact(recipe.doseG)} → ${formatGramsCompact(recipe.waterG)}`,
    recipe.waterTempC !== undefined &&
      formatTemperatureCompact(recipe.waterTempC),
    recipe.totalTimeSeconds !== undefined &&
      formatDuration(recipe.totalTimeSeconds),
  ]
    .filter(Boolean)
    .join(" · ");
}
