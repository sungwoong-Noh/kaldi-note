"use client";

import { useState, type ChangeEvent } from "react";
import { NumberCell, TasteDots } from "@/components/kit";
import { SELECT_EXTRA } from "@/components/ui";
import type { UserGrinder } from "@/features/gear/schema";
import type { MappedFieldErrors } from "@/lib/fieldErrors";
import type { BrewLogFormState } from "../formState";
import type { RecipeTargets } from "../useEntityLabels";

/**
 * 기록 폼의 입력칸들 — 웹 2열 폼과 모바일 묶음 시트가 같은 것을 쓴다
 * (docs/specs/2026-10-11-brew-form-fidelity.md). 접근 이름은 예전 폼 그대로다(`원두량`·`물 온도`…).
 */

export type BrewFormSetter = <K extends keyof BrewLogFormState>(
  key: K,
  value: BrewLogFormState[K],
) => void;

export interface FieldContext {
  state: BrewLogFormState;
  set: BrewFormSetter;
  errors: MappedFieldErrors | null;
}

type NumericField = {
  [K in keyof BrewLogFormState]: BrewLogFormState[K] extends number | null
    ? K
    : never;
}[keyof BrewLogFormState];

type TimeField = "actualTotalTimeSeconds" | "actualDrawdownSeconds";

const errorId = (field: string) => `brew-${field}-error`;

function errorProps(ctx: FieldContext, field: string) {
  const message = ctx.errors?.byField[field];
  return {
    message,
    input: {
      "aria-invalid": message ? true : undefined,
      "aria-describedby": message ? errorId(field) : undefined,
    },
  };
}

function FieldError({ field, message }: { field: string; message?: string }) {
  if (!message) return null;
  return (
    <span id={errorId(field)} className="text-[12.5px] text-danger">
      {message}
    </span>
  );
}

/** 빈칸은 `null`, 숫자가 아니면 `null`. */
function parseNumber(text: string): number | null {
  if (text === "") return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

/**
 * 숫자 입력의 글자. `type="text"`라 `30.`처럼 입력 중인 글자를 상태 숫자로 되돌리면 소수점을 칠 수 없다 —
 * 입력한 글자를 따로 들고, 바깥 값이 그 글자와 다를 때만(다른 곳에서 바뀌었을 때) 바깥 값을 보인다.
 */
function useNumberText(
  value: number | null,
  onChange: (value: number | null) => void,
) {
  const [text, setText] = useState(value === null ? "" : String(value));
  return {
    value:
      parseNumber(text) === value ? text : value === null ? "" : String(value),
    onChange: (e: ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value.trim();
      setText(next);
      onChange(parseNumber(next));
    },
  };
}

export function NumField({
  ctx,
  field,
  label,
  accessibleName,
  unit,
}: {
  ctx: FieldContext;
  field: NumericField;
  label: string;
  accessibleName: string;
  unit?: string;
}) {
  const text = useNumberText(ctx.state[field], (v) => ctx.set(field, v));
  const { message, input } = errorProps(ctx, field);

  return (
    <div className="flex min-w-0 flex-col gap-[4px]">
      <NumberCell
        label={label}
        accessibleName={accessibleName}
        unit={unit}
        {...text}
        {...input}
      />
      <FieldError field={field} message={message} />
    </div>
  );
}

/** `3:30` 같은 `m:ss`. 숫자 키패드에는 `:`가 없어 `inputMode`를 풀어 둔다. */
export function TimeField({
  ctx,
  field,
  label,
  accessibleName,
}: {
  ctx: FieldContext;
  field: TimeField;
  label: string;
  accessibleName: string;
}) {
  const { message, input } = errorProps(ctx, field);
  return (
    <div className="flex min-w-0 flex-col gap-[4px]">
      <NumberCell
        label={label}
        accessibleName={accessibleName}
        inputMode={undefined}
        placeholder="0:00"
        value={ctx.state[field]}
        onChange={(e) => ctx.set(field, e.target.value.trim())}
        {...input}
      />
      <FieldError field={field} message={message} />
    </div>
  );
}

export function BrewedAtField({ ctx }: { ctx: FieldContext }) {
  const { message, input } = errorProps(ctx, "brewedAt");
  return (
    <div className="flex min-w-0 flex-col gap-[4px]">
      <NumberCell
        label="내린 시각"
        accessibleName="내린 시각"
        type="datetime-local"
        inputMode={undefined}
        value={ctx.state.brewedAt}
        onChange={(e) => ctx.set("brewedAt", e.target.value)}
        {...input}
      />
      <FieldError field="brewedAt" message={message} />
    </div>
  );
}

/** 별명을 넣지 않았으면 모델 이름으로 부른다 — 선택란이 빈 항목처럼 보이면 고를 수 없다. */
export function grinderLabel(grinder: UserGrinder): string {
  const model = `${grinder.brand} ${grinder.grinderModelName}`;
  return grinder.nickname ? `${grinder.nickname} (${model})` : model;
}

/** 원장 행 안의 그라인더 고르기. 등록된 것이 없으면 그 사실을 쓴다(AC-WEBBREW-01). */
export function GrinderSelect({
  ctx,
  grinders,
}: {
  ctx: FieldContext;
  grinders: UserGrinder[];
}) {
  if (grinders.length === 0) {
    return <span className="text-ink-3">등록된 그라인더가 없습니다</span>;
  }
  // `<select>`는 의사 요소를 그리지 않아 `hit-44`를 감싼 라벨에 단다.
  return (
    <label className="hit-44 flex min-w-0">
      <select
        aria-label="그라인더"
        value={ctx.state.userGrinderId ?? ""}
        onChange={(e) =>
          ctx.set(
            "userGrinderId",
            e.target.value === "" ? null : Number(e.target.value),
          )
        }
        className={`${SELECT_EXTRA} w-full min-w-0 truncate pr-[24px]! bg-transparent text-[15px] text-ink`}
      >
        <option value="">선택 안 함</option>
        {grinders.map((grinder) => (
          <option key={grinder.id} value={grinder.id}>
            {grinderLabel(grinder)}
          </option>
        ))}
      </select>
    </label>
  );
}

/** 레시피 분쇄 단위의 표기 — 기록 폼과 기록 상세 비교표가 같이 쓴다. */
export const GRIND_UNIT_LABEL = {
  CLICK: "클릭",
  NUMBER: "",
  MICRON: "μm",
} as const;

/**
 * 고른 그라인더가 레시피와 같은 모델일 때만 레시피의 분쇄도를 기준으로 보인다(AC-BREWFIT-09).
 * 모델이 다르면 「22 클릭」은 다른 굵기다.
 */
export function grindBaseline(
  state: BrewLogFormState,
  grinders: UserGrinder[],
  targets: RecipeTargets | undefined,
): { unit: string; reference: string | null } {
  const chosen = grinders.find((g) => g.id === state.userGrinderId);
  const sameModel =
    chosen !== undefined &&
    targets?.grinderModelId !== undefined &&
    chosen.grinderModelId === targets.grinderModelId;
  if (!sameModel || targets?.grindSettingUnit === undefined) {
    return { unit: "", reference: null };
  }
  const unit = GRIND_UNIT_LABEL[targets.grindSettingUnit];
  const reference =
    targets.grindSettingValue === undefined
      ? null
      : `레시피 ${[String(targets.grindSettingValue), unit].filter(Boolean).join(" ")}`;
  return { unit, reference };
}

/** 원장 행 안의 분쇄도 값. 칸 테두리 없이 값 자리에 놓인다. */
export function GrindValueInput({
  ctx,
  unit,
}: {
  ctx: FieldContext;
  unit: string;
}) {
  const text = useNumberText(ctx.state.actualGrindSettingValue, (v) =>
    ctx.set("actualGrindSettingValue", v),
  );
  const { message, input } = errorProps(ctx, "actualGrindSettingValue");

  return (
    <span className="flex flex-col gap-[2px]">
      {/* `<input>`은 의사 요소를 그리지 않아 `hit-44`를 감싼 라벨에 단다. */}
      <label className="hit-44 flex items-baseline gap-[6px]">
        <input
          type="text"
          inputMode="decimal"
          aria-label="분쇄도 값"
          placeholder="—"
          {...text}
          className="w-[64px] bg-transparent font-mono text-[15px] font-medium text-ink tabular-nums outline-none aria-invalid:text-danger"
          {...input}
        />
        {unit !== "" && (
          <span className="text-[12.5px] text-ink-3">{unit}</span>
        )}
      </label>
      <FieldError field="actualGrindSettingValue" message={message} />
    </span>
  );
}

const NOTE_MAX = 1000;

export function MemoField({ ctx }: { ctx: FieldContext }) {
  const { message, input } = errorProps(ctx, "overallNote");
  return (
    <div className="flex flex-col gap-[4px]">
      <label className="relative flex">
        <textarea
          aria-label="메모"
          rows={3}
          value={ctx.state.overallNote}
          onChange={(e) => ctx.set("overallNote", e.target.value)}
          className="min-h-[84px] w-full rounded-[7px] border border-border bg-paper px-[14px] pt-[12px] pb-[24px] text-[14.5px] text-ink-2 outline-none aria-invalid:border-danger"
          {...input}
        />
        <span className="pointer-events-none absolute right-[12px] bottom-[8px] font-mono text-[11px] text-ink-3">
          {ctx.state.overallNote.length}/{NOTE_MAX}
        </span>
      </label>
      <FieldError field="overallNote" message={message} />
    </div>
  );
}

const VISIBILITY_OPTIONS: ReadonlyArray<{
  value: BrewLogFormState["visibility"];
  label: string;
}> = [
  { value: "PRIVATE", label: "나만 보기" },
  { value: "FRIENDS", label: "맞팔로우 친구" },
  { value: "PUBLIC", label: "전체" },
];

/**
 * 공개 범위 3분할 — 시안 `.seg`. 폭과 상관없이 같은 라벨이고 한 줄이다(AC-BREWFIT-16). 보이는 높이는
 * 40px 미만, 누르는 영역은 `hit-44`.
 */
export function VisibilityField({ ctx }: { ctx: FieldContext }) {
  return (
    <div
      role="radiogroup"
      aria-label="공개 범위"
      className="flex gap-[3px] rounded-[7px] bg-sunken p-[3px]"
    >
      {VISIBILITY_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={ctx.state.visibility === option.value}
          onClick={() => ctx.set("visibility", option.value)}
          className="hit-44 flex-1 rounded-[5px] border border-transparent px-[6px] py-[9px] text-center text-[13.5px] leading-[1.4] whitespace-nowrap text-ink-3 aria-checked:border-border aria-checked:bg-paper aria-checked:font-medium aria-checked:text-ink"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

const SENSORY_AXES = [
  { key: "acidity", label: "산미" },
  { key: "sweetness", label: "단맛" },
  { key: "body", label: "바디" },
  { key: "bitterness", label: "쓴맛" },
  { key: "aftertaste", label: "여운" },
] as const;

/** 5축 맛 도트. 고르지 않은 축은 `null`이라 요청에서 빠진다. */
export function TasteAxes({ ctx }: { ctx: FieldContext }) {
  return (
    <div className="flex flex-col">
      {SENSORY_AXES.map(({ key, label }) => (
        <TasteDots
          key={key}
          label={label}
          value={ctx.state[key]}
          onChange={(v) => ctx.set(key, v)}
        />
      ))}
    </div>
  );
}

/**
 * 모바일 히어로 안의 원두량·물량 칩 — 시안 `.chip`. 비율을 바꾸는 값이라 히어로 안에서 바로 고친다
 * (AC-BREWFIT-10).
 */
export function HeroNumberChip({
  ctx,
  field,
  accessibleName,
  caption,
}: {
  ctx: FieldContext;
  field: "actualDoseG" | "actualWaterG";
  accessibleName: string;
  caption: string;
}) {
  const text = useNumberText(ctx.state[field], (v) => ctx.set(field, v));
  const { message, input } = errorProps(ctx, field);
  return (
    <div className="flex min-w-0 flex-col gap-[4px]">
      <label className="hit-44 flex items-baseline justify-between gap-[8px] rounded-[7px] bg-hero-line px-[12px] py-[10px] has-[[aria-invalid=true]]:outline has-[[aria-invalid=true]]:outline-danger">
        <input
          type="text"
          inputMode="decimal"
          aria-label={accessibleName}
          className="w-full min-w-0 bg-transparent font-mono text-[16px] font-medium text-on-hero tabular-nums outline-none"
          {...text}
          {...input}
        />
        <span className="shrink-0 font-mono text-[10.5px] text-on-hero-dim">
          {caption}
        </span>
      </label>
      <FieldError field={field} message={message} />
    </div>
  );
}
