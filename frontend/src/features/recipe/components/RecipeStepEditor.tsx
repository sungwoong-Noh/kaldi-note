"use client";

import { formatDuration, formatGrams } from "@/lib/format";
import {
  appendStep,
  insertStepAfter,
  isPouringStep,
  MAX_STEPS,
  moveStep,
  pouredWaterTotal,
  removeStep,
  type EditableStep,
  type StepType,
} from "../stepSequence";

const STEP_TYPE_LABELS: Record<StepType, string> = {
  BLOOM: "블룸",
  POUR: "붓기",
  WAIT: "대기",
  SWIRL: "스월",
  STIR: "젓기",
  DRAWDOWN: "드로다운",
};

type Props = {
  steps: EditableStep[];
  /** 레시피 총 물량. 합계 표시에만 쓰고 저장을 막는 데는 쓰지 않는다. */
  waterG: number | null;
  onChange: (steps: EditableStep[]) => void;
  /** 서버가 준 스텝별 오류. 인덱스는 0부터이고 화면 번호는 여기에 1을 더한 값이다. */
  errors?: Record<number, string>;
};

/**
 * 푸어 스텝 시퀀스 편집기.
 *
 * <p>상태를 들지 않는다 — 부모가 들고 있는 배열을 받아 `onChange`로 새 배열을 돌려준다. 시간 규칙은 전부 `stepSequence.ts`의 순수
 * 함수에 있고 여기서는 그것을 부르기만 한다.
 *
 * <p><b>합계는 보여주기만 한다.</b> 물량이 안 맞아도 저장을 막지 않는다 — 거부는 서버 몫이다.
 */
export function RecipeStepEditor({
  steps,
  waterG,
  onChange,
  errors = {},
}: Props) {
  const atLimit = steps.length >= MAX_STEPS;

  function update(index: number, patch: Partial<EditableStep>) {
    onChange(steps.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-semibold">푸어 스텝</h2>
        <WaterSummary steps={steps} waterG={waterG} />
      </div>

      <ol className="flex flex-col gap-3">
        {steps.map((step, index) => {
          const number = index + 1;
          return (
            <li
              key={step.uid}
              aria-label={`스텝 ${number}`}
              className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-3"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-neutral-500">
                  {number}
                </span>
                <label className="sr-only" htmlFor={`step-${step.uid}-type`}>
                  스텝 {number} 타입
                </label>
                <select
                  id={`step-${step.uid}-type`}
                  aria-label={`스텝 ${number} 타입`}
                  value={step.stepType}
                  onChange={(e) =>
                    update(index, { stepType: e.target.value as StepType })
                  }
                  className="rounded border border-neutral-300 px-2 py-1 text-sm"
                >
                  {Object.entries(STEP_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>

                <div className="ml-auto flex gap-1">
                  <button
                    type="button"
                    aria-label={`스텝 ${number} 위로`}
                    disabled={index === 0}
                    onClick={() => onChange(moveStep(steps, index, -1))}
                    className="rounded border border-neutral-300 px-2 py-1 text-sm disabled:opacity-40"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`스텝 ${number} 아래로`}
                    disabled={index === steps.length - 1}
                    onClick={() => onChange(moveStep(steps, index, 1))}
                    className="rounded border border-neutral-300 px-2 py-1 text-sm disabled:opacity-40"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    aria-label={`스텝 ${number} 삭제`}
                    onClick={() => onChange(removeStep(steps, index))}
                    className="rounded border border-neutral-300 px-2 py-1 text-sm"
                  >
                    삭제
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <NumberField
                  label={`스텝 ${number} 시작`}
                  id={`step-${step.uid}-start`}
                  value={step.startAtSeconds}
                  suffix="초"
                  hint={`(${formatDuration(step.startAtSeconds)})`}
                  onChange={(value) =>
                    update(index, { startAtSeconds: value ?? 0 })
                  }
                />
                <NumberField
                  label={`스텝 ${number} 소요`}
                  id={`step-${step.uid}-duration`}
                  value={step.durationSeconds}
                  suffix="초"
                  onChange={(value) =>
                    update(index, { durationSeconds: value ?? 0 })
                  }
                />
                {isPouringStep(step) && (
                  <NumberField
                    label={`스텝 ${number} 물량`}
                    id={`step-${step.uid}-water`}
                    value={step.waterG}
                    suffix="g"
                    step="0.1"
                    onChange={(value) => update(index, { waterG: value })}
                  />
                )}
              </div>

              {errors[index] && (
                <p className="whitespace-pre-line text-sm text-red-600">
                  {errors[index]}
                </p>
              )}

              <button
                type="button"
                aria-label={`스텝 ${number} 아래에 추가`}
                disabled={atLimit}
                onClick={() => onChange(insertStepAfter(steps, index))}
                className="self-start text-sm text-neutral-500 disabled:opacity-40"
              >
                여기 아래에 추가
              </button>
            </li>
          );
        })}
      </ol>

      <button
        type="button"
        disabled={atLimit}
        onClick={() => onChange(appendStep(steps))}
        className="self-start rounded border border-neutral-300 px-3 py-2 text-sm disabled:opacity-40"
      >
        스텝 추가
      </button>
    </section>
  );
}

/** 붓는 스텝의 물량 합계와 총 물량의 차이. 경고일 뿐 저장을 막지 않는다. */
function WaterSummary({
  steps,
  waterG,
}: {
  steps: EditableStep[];
  waterG: number | null;
}) {
  if (waterG === null) return null;

  const poured = pouredWaterTotal(steps);
  const difference = Number((waterG - poured).toFixed(1));

  return (
    <p className="flex items-baseline gap-2 text-sm">
      <span className="tabular-nums">
        {formatGrams(poured)} / {formatGrams(waterG)}
      </span>
      {difference > 0 && (
        <span className="text-amber-600">
          {formatGrams(difference)} 부족합니다
        </span>
      )}
      {difference < 0 && (
        <span className="text-amber-600">
          {formatGrams(-difference)} 초과합니다
        </span>
      )}
    </p>
  );
}

function NumberField({
  label,
  id,
  value,
  suffix,
  hint,
  step,
  onChange,
}: {
  label: string;
  id: string;
  value: number | null;
  suffix: string;
  hint?: string;
  step?: string;
  onChange: (value: number | null) => void;
}) {
  return (
    <span className="flex items-baseline gap-1">
      <label htmlFor={id} className="text-sm text-neutral-500">
        {label.replace(/^스텝 \d+ /, "")}
      </label>
      <input
        id={id}
        aria-label={label}
        type="number"
        step={step}
        value={value ?? ""}
        onChange={(e) =>
          onChange(e.target.value === "" ? null : Number(e.target.value))
        }
        className="w-20 rounded border border-neutral-300 px-2 py-1 text-sm"
      />
      <span className="text-sm text-neutral-500">{suffix}</span>
      {hint && <span className="text-sm text-neutral-400">{hint}</span>}
    </span>
  );
}
