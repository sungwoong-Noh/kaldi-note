"use client";

import { useState } from "react";
import { NumberCell, stripLeadingZeros, useNumberText } from "@/components/kit";
import { formatDuration, parseMinSec } from "@/lib/format";
import { gramsText, waterObservation } from "../preview";
import {
  AGITATION_LABELS,
  appendStep,
  insertStepAfter,
  isPouringStep,
  MAX_STEPS,
  STEP_TYPE_LABELS,
  moveStep,
  POUR_TECHNIQUE_LABELS,
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
  /** ≥1100px — 요약 표 + 행 아래 편집 패널(목업 03 W). 아니면 카드 행. */
  wide?: boolean;
};

type ViewProps = Required<Omit<Props, "waterG" | "wide">> & {
  atLimit: boolean;
  update: (index: number, patch: Partial<EditableStep>) => void;
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
  wide = false,
}: Props) {
  const view: ViewProps = {
    steps,
    onChange,
    errors,
    atLimit: steps.length >= MAX_STEPS,
    update: (index, patch) =>
      onChange(steps.map((s, i) => (i === index ? { ...s, ...patch } : s))),
  };

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

      {wide ? <StepTable {...view} /> : <StepRows {...view} />}

      <Button
        aria-label="스텝 추가"
        disabled={view.atLimit}
        onClick={() => onChange(appendStep(steps))}
      >
        + 스텝 추가
      </Button>
    </section>
  );
}

/** <1100px의 카드 행. 모바일 요약 행·시트(Task 11)와 태블릿 인라인 편집(Task 13)으로 바뀔 자리다. */
function StepRows({ steps, onChange, errors, atLimit, update }: ViewProps) {
  return (
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
              <span className="text-body font-medium text-ink-3">{number}</span>
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
  );
}

const MOVE_BUTTON =
  "inline-flex size-11 items-center justify-center rounded-control font-mono text-[12px] text-ink-3 disabled:opacity-40";

/** 붓지 않는 스텝이나 비어 있는 물은 `—`. */
function waterCell(step: EditableStep): string {
  return isPouringStep(step) && step.waterG !== null
    ? `${gramsText(step.waterG)} g`
    : "—";
}

/** 「나선 · 돌리기 · 메모」. 교반 「없음」은 쓰지 않는다(목업 03 W). */
function techniqueSummary(step: EditableStep): string {
  return [
    step.pourTechnique && POUR_TECHNIQUE_LABELS[step.pourTechnique],
    step.agitation && step.agitation !== "NONE"
      ? AGITATION_LABELS[step.agitation]
      : null,
    step.note,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * 웹 스텝 표(목업 03 W). 행은 요약만 보여주고, 행을 누르면 표 아래 편집 패널이 열린다. 패널의 입력은 바로 반영된다 —
 * 「적용」이 있는 쪽은 모바일 시트다(AC-RECIPEEDIT-43).
 *
 * <p>「방식 · 메모」 열은 1280px 미만에서 숨긴다(AC-RECIPEEDIT-41).
 */
function StepTable(view: ViewProps) {
  const { steps, onChange, errors } = view;
  const [openUid, setOpenUid] = useState<string | null>(null);
  const openIndex = steps.findIndex((s) => s.uid === openUid);
  if (steps.length === 0) return null;

  return (
    <>
      <div className="overflow-hidden rounded-[10px] border border-border">
        <table className="w-full table-fixed border-collapse">
          <thead className="border-b border-divider bg-surface font-mono text-[9px] tracking-[0.1em] text-ink-3 uppercase">
            <tr>
              <th
                scope="col"
                className="w-[34px] py-[10px] pl-[12px] text-left font-normal"
              >
                #
              </th>
              <th scope="col" className="w-[80px] text-left font-normal">
                종류
              </th>
              <th scope="col" className="w-[56px] text-right font-normal">
                시작
              </th>
              <th scope="col" className="w-[56px] text-right font-normal">
                지속
              </th>
              <th scope="col" className="w-[64px] text-right font-normal">
                물
              </th>
              <th
                scope="col"
                className="hidden pl-[16px] text-left font-normal whitespace-nowrap min-[1280px]:table-cell"
              >
                방식 · 메모
              </th>
              <th scope="col" className="w-[140px]" />
            </tr>
          </thead>
          <tbody>
            {steps.map((step, index) => {
              const number = index + 1;
              const open = index === openIndex;
              const errorId = `step-${step.uid}-error`;
              return (
                <StepTableRow
                  key={step.uid}
                  {...{ step, index, number, open, errorId, view }}
                  error={errors[index]}
                  onToggle={() => setOpenUid(open ? null : step.uid)}
                  onMove={(delta) => onChange(moveStep(steps, index, delta))}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {openIndex >= 0 && (
        <StepPanel
          key={steps[openIndex].uid}
          step={steps[openIndex]}
          index={openIndex}
          view={view}
        />
      )}
    </>
  );
}

function StepTableRow({
  step,
  index,
  number,
  open,
  error,
  errorId,
  view,
  onToggle,
  onMove,
}: {
  step: EditableStep;
  index: number;
  number: number;
  open: boolean;
  error: string | undefined;
  errorId: string;
  view: ViewProps;
  onToggle: () => void;
  onMove: (delta: -1 | 1) => void;
}) {
  const { steps, onChange } = view;
  return (
    <>
      <tr
        aria-label={`스텝 ${number}`}
        aria-describedby={error ? errorId : undefined}
        className={`relative border-t border-divider font-mono text-[13px] text-ink-2 tabular-nums ${open ? "bg-surface" : ""}`}
      >
        <td className="pl-[12px] text-[12.5px] text-ink-3">
          {/* 행 전체가 이 버튼이다 — ::after가 행을 덮는다. 위·아래·삭제는 그 위(z-10)에 있다. */}
          <button
            type="button"
            aria-label={`스텝 ${number} 열기`}
            aria-expanded={open}
            onClick={onToggle}
            className="after:absolute after:inset-0"
          >
            {number}
          </button>
        </td>
        <td>
          <span className="rounded-[3px] bg-accent-wash px-[8px] py-[5px] text-[10.5px] text-accent">
            {STEP_TYPE_LABELS[step.stepType]}
          </span>
        </td>
        <td className="text-right">{formatDuration(step.startAtSeconds)}</td>
        <td className="text-right">{formatDuration(step.durationSeconds)}</td>
        <td className="text-right font-medium text-ink">{waterCell(step)}</td>
        <td className="hidden truncate pl-[16px] font-sans text-[12.5px] text-ink-3 min-[1280px]:table-cell">
          {techniqueSummary(step)}
        </td>
        <td className="py-[2px] pr-[4px]">
          <div className="relative z-10 flex justify-end">
            <button
              type="button"
              aria-label={`스텝 ${number} 위로`}
              disabled={index === 0}
              onClick={() => onMove(-1)}
              className={MOVE_BUTTON}
            >
              ↑
            </button>
            <button
              type="button"
              aria-label={`스텝 ${number} 아래로`}
              disabled={index === steps.length - 1}
              onClick={() => onMove(1)}
              className={MOVE_BUTTON}
            >
              ↓
            </button>
            <button
              type="button"
              aria-label={`스텝 ${number} 삭제`}
              onClick={() => onChange(removeStep(steps, index))}
              className={MOVE_BUTTON}
            >
              ×
            </button>
          </div>
        </td>
      </tr>
      {error && (
        <tr>
          <td colSpan={7} className="px-[12px] pb-[10px]">
            <p
              id={errorId}
              className="whitespace-pre-line text-body text-danger"
            >
              {error}
            </p>
          </td>
        </tr>
      )}
    </>
  );
}

/** 표 아래 「스텝 N 편집」 패널. 스텝마다 `key`가 달라 m:ss 입력 중 글자가 다른 스텝으로 새지 않는다. */
function StepPanel({
  step,
  index,
  view,
}: {
  step: EditableStep;
  index: number;
  view: ViewProps;
}) {
  const { steps, onChange, atLimit, update } = view;
  const number = index + 1;
  const water = useNumberText(step.waterG, (waterG) =>
    update(index, { waterG }),
  );

  return (
    <section
      aria-label={`스텝 ${number} 편집`}
      className="flex flex-col gap-[12px] rounded-[10px] border border-border bg-paper px-[16px] py-[14px]"
    >
      <span className="font-mono text-[9.5px] tracking-[0.12em] text-ink-3 uppercase">
        스텝 {number} 편집
      </span>
      <div className="grid grid-cols-2 gap-[10px]">
        <label className="flex min-h-[52px] items-center justify-between gap-[8px] rounded-[7px] border border-border bg-paper px-[14px]">
          <span className="text-[13.5px] text-ink-3">종류</span>
          <select
            aria-label={`스텝 ${number} 타입`}
            value={step.stepType}
            onChange={(e) =>
              update(index, { stepType: e.target.value as StepType })
            }
            className="appearance-none select-chevron bg-transparent pr-[24px] text-right text-[14px] text-ink"
          >
            {Object.entries(STEP_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {isPouringStep(step) ? (
          <NumberCell
            label="물"
            accessibleName={`스텝 ${number} 물량`}
            unit="g"
            {...water}
          />
        ) : (
          <span />
        )}
        <MinSecCell
          label="시작"
          accessibleName={`스텝 ${number} 시작`}
          seconds={step.startAtSeconds}
          onChange={(startAtSeconds) => update(index, { startAtSeconds })}
        />
        <MinSecCell
          label="지속"
          accessibleName={`스텝 ${number} 지속`}
          seconds={step.durationSeconds}
          onChange={(durationSeconds) => update(index, { durationSeconds })}
        />
      </div>
      <button
        type="button"
        aria-label={`스텝 ${number} 아래에 추가`}
        disabled={atLimit}
        onClick={() => onChange(insertStepAfter(steps, index))}
        className="inline-flex min-h-11 items-center self-start text-body text-ink-3 disabled:opacity-40"
      >
        여기 아래에 추가
      </button>
    </section>
  );
}

/**
 * `m:ss` 입력(AC-RECIPEEDIT-47). 형식이 맞을 때만 초로 올린다 — `1:3`을 치는 동안에는 글자만 들고 값은 그대로 둔다.
 * 바깥에서 값이 바뀌면(밀기·당기기) 그 값을 보인다.
 */
function MinSecCell({
  label,
  accessibleName,
  seconds,
  onChange,
}: {
  label: string;
  accessibleName: string;
  seconds: number;
  onChange: (seconds: number) => void;
}) {
  // 글자는 그 글자를 쓸 때의 초와 함께 든다. 초가 달라졌으면(밀기·당기기) 바깥 값을 보인다.
  const [draft, setDraft] = useState({
    text: formatDuration(seconds),
    seconds,
  });
  return (
    <NumberCell
      label={label}
      accessibleName={accessibleName}
      inputMode={undefined}
      placeholder="0:00"
      value={draft.seconds === seconds ? draft.text : formatDuration(seconds)}
      onChange={(e) => {
        const text = e.target.value.trim();
        const parsed = parseMinSec(text);
        const valid = typeof parsed === "number";
        setDraft({ text, seconds: valid ? parsed : seconds });
        if (valid) onChange(parsed);
      }}
    />
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
  const [cleared, setCleared] = useState(false);

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
        inputMode={step ? "decimal" : "numeric"}
        step={step}
        value={cleared ? "" : (value ?? "")}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={() => setCleared(false)}
        onChange={(e) => {
          const clean = stripLeadingZeros(e.currentTarget.value);
          if (clean !== e.currentTarget.value) {
            e.currentTarget.value = clean;
          }
          if (clean === "") {
            setCleared(true);
            onChange(null);
            return;
          }
          setCleared(false);
          onChange(Number(clean));
        }}
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
