/**
 * 레시피 편집 화면의 파생값 — 비율 히어로, 물 합계 Observation, 미리보기 타임라인.
 *
 * <p>전부 순수 함수다. 화면은 폼 상태를 넘겨 받은 문자열·숫자를 그리기만 한다.
 */

import { formatDuration, roundHalfUp1, tenths } from "@/lib/format";
import {
  isPouringStep,
  pouredWaterTotal,
  STEP_TYPE_LABELS,
  type EditableStep,
} from "./stepSequence";

/** 서버 DTO와 같은 범위다(`CreateRecipeRequest`). */
export const DOSE_RANGE = { min: 1, max: 200 } as const;
export const WATER_RANGE = { min: 10, max: 3000 } as const;

const inRange = (value: number | null, range: { min: number; max: number }) =>
  value !== null && value >= range.min && value <= range.max;

/** 소수 1자리, `.0`이면 지운다. `20` → `20`, `2.5` → `2.5` */
const trim = (value: number) => (Math.round(value * 10) / 10).toString();

/** `물 / 원두`를 소수 1자리 HALF_UP으로 `1:15.6`. 둘 중 하나라도 비었거나 범위 밖이면 `—`. */
export function ratioLabel(doseG: number | null, waterG: number | null) {
  if (!inRange(doseG, DOSE_RANGE) || !inRange(waterG, WATER_RANGE)) return "—";
  return `1:${roundHalfUp1(tenths(waterG as number), tenths(doseG as number))}`;
}

/**
 * 붓는 스텝 물 합계와 총 물량의 차이. 스텝이 없으면 `null`.
 *
 * <p>서버는 합계가 다르면 400으로 거부한다(AC-RECIPE-50) — 그래서 다를 때는 「맞춰 주세요」까지 말한다.
 */
export function waterObservation(
  steps: EditableStep[],
  waterG: number | null,
): { text: string; mismatch: boolean } | null {
  if (steps.length === 0) return null;

  const diff = pouredWaterTotal(steps) - (waterG ?? 0);
  if (Math.abs(diff) < 0.05) {
    return { text: "스텝 물 합계가 총 물량과 같습니다.", mismatch: false };
  }
  const direction = diff < 0 ? "적습니다" : "많습니다";
  return {
    text: `스텝 물 합계가 총 물량보다 ${trim(Math.abs(diff))} g ${direction}. 저장하려면 합계를 맞춰 주세요.`,
    mismatch: true,
  };
}

export type TimelineBar = {
  uid: string;
  label: string;
  /** 누적 물량. 붓지 않는 스텝은 `—`. */
  cumulative: string;
  leftPct: number;
  widthPct: number;
};

/** 축 끝 = max(총 시간, 마지막 스텝 종료). 축 눈금은 `0:00 / 중간 / 끝`. */
export function timeline(
  steps: EditableStep[],
  totalTimeSeconds: number | null,
): { bars: TimelineBar[]; axis: string[] } {
  const lastEnd = Math.max(
    0,
    ...steps.map((step) => step.startAtSeconds + step.durationSeconds),
  );
  const end = Math.max(totalTimeSeconds ?? 0, lastEnd, 1);

  let poured = 0;
  const bars = steps.map((step) => {
    const pouring = isPouringStep(step);
    if (pouring) poured += step.waterG ?? 0;
    return {
      uid: step.uid,
      label: STEP_TYPE_LABELS[step.stepType],
      cumulative: pouring ? trim(poured) : "—",
      leftPct: (step.startAtSeconds / end) * 100,
      widthPct: (step.durationSeconds / end) * 100,
    };
  });

  return {
    bars,
    axis: [
      formatDuration(0),
      formatDuration(Math.round(end / 2)),
      formatDuration(end),
    ],
  };
}
