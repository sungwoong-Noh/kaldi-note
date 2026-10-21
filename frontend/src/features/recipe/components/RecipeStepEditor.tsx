"use client";

import { formatDuration } from "@/lib/format";
import { gramsText, waterObservation } from "../preview";
import {
  appendStep,
  insertStepAfter,
  isPouringStep,
  MAX_STEPS,
  STEP_TYPE_LABELS,
  moveStep,
  pouredWaterTotal,
  removeStep,
  type EditableStep,
  type StepType,
} from "../stepSequence";
import { Button, cardClass, controlClass } from "@/components/ui";

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
 * <p><b>합계는 보여주기만 한다.</b> 물량이 안 맞으면 합계를 `danger`로 칠할 뿐 요청은 나간다 — 거부는 서버 몫이고(AC-RECIPE-50),
 * 차이를 문장으로 말하는 쪽은 미리보기 Observation이다(AC-RECIPEEDIT-06).
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
        <h2 className="font-mono text-[10px] tracking-[0.14em] text-ink-3 uppercase">
          스텝 · {steps.length} / {MAX_STEPS}
        </h2>
        <WaterTotal steps={steps} waterG={waterG} />
      </div>

      {steps.length === 0 && (
        <div className="flex flex-col gap-[4px] rounded-[10px] border border-dashed border-border px-[16px] py-[18px] text-center">
          <p className="text-[14px] text-ink-2">스텝이 없습니다.</p>
          <p className="text-[12.5px] text-ink-3">
            스텝 없이도 저장할 수 있습니다. 타이머는 총 시간만 셉니다.
          </p>
        </div>
      )}

      <ol className="flex flex-col gap-3">
        {steps.map((step, index) => {
          const number = index + 1;
          return (
            <li
              // 스텝 행은 전폭 규칙의 예외다 — 한 줄에 컨트롤 여럿이 들어간다.
              // 전폭으로 펴면 7스텝 편집이 7줄에서 28줄로 늘어난다
              // (docs/specs/2026-09-15-structure.md).
              data-step-row
              key={step.uid}
              aria-label={`스텝 ${number}`}
              className={cardClass("flex flex-col gap-2", { pad: "tight" })}
            >
              <div className="flex items-center gap-2">
                <span className="text-body font-medium text-ink-3">
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
                  className="h-11 shrink-0 appearance-none select-chevron rounded-control border border-border pr-10 pl-3 text-body"
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
                    className="inline-flex size-11 items-center justify-center rounded-control border border-border text-body disabled:opacity-40"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`스텝 ${number} 아래로`}
                    disabled={index === steps.length - 1}
                    onClick={() => onChange(moveStep(steps, index, 1))}
                    className="inline-flex size-11 items-center justify-center rounded-control border border-border text-body disabled:opacity-40"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    aria-label={`스텝 ${number} 삭제`}
                    onClick={() => onChange(removeStep(steps, index))}
                    className="inline-flex size-11 items-center justify-center rounded-control border border-border text-body"
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
                <p className="whitespace-pre-line text-body text-danger">
                  {errors[index]}
                </p>
              )}

              <button
                type="button"
                aria-label={`스텝 ${number} 아래에 추가`}
                disabled={atLimit}
                onClick={() => onChange(insertStepAfter(steps, index))}
                className="inline-flex min-h-11 min-w-11 items-center justify-center self-start text-body text-ink-3 disabled:opacity-40"
              >
                여기 아래에 추가
              </button>
            </li>
          );
        })}
      </ol>

      <Button
        aria-label="스텝 추가"
        disabled={atLimit}
        onClick={() => onChange(appendStep(steps))}
      >
        + 스텝 추가
      </Button>
    </section>
  );
}

/** 붓는 스텝 물 합계 / 총 물량. 다르면 `danger`(R4). 스텝이 없거나 총 물량이 비면 그리지 않는다. */
function WaterTotal({
  steps,
  waterG,
}: {
  steps: EditableStep[];
  waterG: number | null;
}) {
  if (waterG === null || steps.length === 0) return null;
  const mismatch = waterObservation(steps, waterG)?.mismatch ?? false;

  return (
    <p
      data-testid="step-water-total"
      className={`font-mono text-[11px] tabular-nums ${mismatch ? "text-danger" : "text-accent"}`}
    >
      물 합계 {gramsText(pouredWaterTotal(steps))} / {gramsText(waterG)} g
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
      {/*
        접근명은 aria-label("스텝 3 물량")이 담당하고, 눈에 보이는 글자는 장식이다.
        <label htmlFor>로 두면 레시피 전체의 "물량" 입력과 라벨 텍스트가 겹쳐
        어느 쪽을 가리키는지 사람도 스크린리더도 알 수 없다.
      */}
      <span
        aria-hidden="true"
        className="shrink-0 text-body whitespace-nowrap text-ink-3"
      >
        {label.replace(/^스텝 \d+ /, "")}
      </span>
      <input
        id={id}
        aria-label={label}
        type="number"
        step={step}
        value={value ?? ""}
        onChange={(e) =>
          onChange(e.target.value === "" ? null : Number(e.target.value))
        }
        className={controlClass("w-20 text-body")}
      />
      <span className="shrink-0 text-body whitespace-nowrap text-ink-3">
        {suffix}
      </span>
      {hint && (
        <span className="shrink-0 text-body whitespace-nowrap text-ink-3">
          {hint}
        </span>
      )}
    </span>
  );
}
