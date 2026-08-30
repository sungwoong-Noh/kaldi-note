"use client";

import { useEffect, useMemo, useState } from "react";
import { errorMessageOf } from "@/components/ErrorState";
import { useBrewFilters, useBrewers } from "@/features/gear/queries";
import { ApiError } from "@/lib/api-client";
import { mapFieldErrors } from "@/lib/fieldErrors";
import { formatDuration } from "@/lib/format";
import {
  toRequestBody,
  type GrindSettingUnit,
  type RecipeFormState,
  type RecipeRequestBody,
  type Visibility,
} from "../formState";
import { GrindSettingField } from "./GrindSettingField";
import { RecipeStepEditor } from "./RecipeStepEditor";

const VISIBILITY_LABELS: Record<Visibility, string> = {
  PRIVATE: "나만 보기",
  FRIENDS: "맞팔로우만",
  PUBLIC: "전체 공개",
};

type Props = {
  initial: RecipeFormState;
  submitting: boolean;
  error: unknown;
  onSubmit: (body: RecipeRequestBody) => void;
  onSessionLost?: () => void;
};

/**
 * 레시피 생성·편집 폼. 두 화면이 같은 것을 쓴다 — `PUT`이 전체 교체라 편집이 생성과 같은 모양이다.
 *
 * <p><b>저장을 막지 않는다.</b> 물량 합계가 어긋나도, 분쇄도 환산이 실패해도 요청은 나간다. 시퀀스의 옳고 그름을 판정하는 쪽은 서버 하나뿐이다.
 */
export function RecipeForm({
  initial,
  submitting,
  error,
  onSubmit,
  onSessionLost,
}: Props) {
  const [state, setState] = useState(initial);
  const [dirty, setDirty] = useState(false);

  const brewers = useBrewers(onSessionLost);
  const filters = useBrewFilters(onSessionLost);

  const fieldErrors = useMemo(
    () =>
      error instanceof ApiError
        ? mapFieldErrors(error.fieldErrors)
        : { byField: {}, byStepIndex: {}, unmapped: [] },
    [error],
  );

  // 고친 것이 있을 때만 새로고침·탭 닫기를 경고한다. 앱 안에서의 이동은 막지 않는다.
  useEffect(() => {
    if (!dirty) return;

    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function patch(changes: Partial<RecipeFormState>) {
    setDirty(true);
    setState((previous) => ({ ...previous, ...changes }));
  }

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(toRequestBody(state));
      }}
    >
      {error !== null && error !== undefined && (
        <div role="alert" className="flex flex-col gap-1 text-sm text-red-600">
          <p>{errorMessageOf(error)}</p>
          {fieldErrors.unmapped.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      )}

      <TextField
        label="제목"
        value={state.title}
        error={fieldErrors.byField.title}
        onChange={(title) => patch({ title })}
      />

      <TextField
        label="설명"
        value={state.description}
        error={fieldErrors.byField.description}
        multiline
        onChange={(description) => patch({ description })}
      />

      <div className="flex flex-wrap gap-4">
        <NumberField
          label="원두량"
          suffix="g"
          step="0.1"
          value={state.doseG}
          error={fieldErrors.byField.doseG}
          onChange={(doseG) => patch({ doseG })}
        />
        <NumberField
          label="물량"
          suffix="g"
          step="0.1"
          value={state.waterG}
          error={fieldErrors.byField.waterG}
          onChange={(waterG) => patch({ waterG })}
        />
        <NumberField
          label="물 온도"
          suffix="°C"
          step="0.1"
          value={state.waterTempC}
          error={fieldErrors.byField.waterTempC}
          onChange={(waterTempC) => patch({ waterTempC })}
        />
        <NumberField
          label="총 시간"
          suffix="초"
          value={state.totalTimeSeconds}
          error={fieldErrors.byField.totalTimeSeconds}
          hint={
            state.totalTimeSeconds === null
              ? undefined
              : `(${formatDuration(state.totalTimeSeconds)})`
          }
          onChange={(totalTimeSeconds) => patch({ totalTimeSeconds })}
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <span className="text-neutral-500">공개 범위</span>
        <select
          aria-label="공개 범위"
          value={state.visibility}
          onChange={(e) => patch({ visibility: e.target.value as Visibility })}
          className="rounded border border-neutral-300 px-2 py-1"
        >
          {Object.entries(VISIBILITY_LABELS).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-wrap gap-4">
        <SelectField
          label="드리퍼"
          value={state.brewerId}
          options={(brewers.data ?? []).map((b) => ({
            id: b.id,
            name: `${b.brand} ${b.name}`,
          }))}
          onChange={(brewerId) => patch({ brewerId })}
        />
        <SelectField
          label="필터"
          value={state.filterId}
          options={(filters.data ?? []).map((f) => ({ id: f.id, name: f.name }))}
          onChange={(filterId) => patch({ filterId })}
        />
      </div>

      <GrindSettingField
        grinderModelId={state.grinderModelId}
        unit={state.grindSettingUnit}
        value={state.grindSettingValue}
        onGrinderChange={(grinderModelId) => patch({ grinderModelId })}
        onUnitChange={(grindSettingUnit: GrindSettingUnit | null) =>
          patch({ grindSettingUnit })
        }
        onValueChange={(grindSettingValue) => patch({ grindSettingValue })}
        onSessionLost={onSessionLost}
      />

      <RecipeStepEditor
        steps={state.steps}
        waterG={state.waterG}
        errors={fieldErrors.byStepIndex}
        onChange={(steps) => patch({ steps })}
      />

      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-md bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        저장
      </button>
    </form>
  );
}

function fieldIds(label: string) {
  const base = `field-${encodeURIComponent(label)}`;
  return { inputId: base, errorId: `${base}-error` };
}

function TextField({
  label,
  value,
  error,
  multiline,
  onChange,
}: {
  label: string;
  value: string;
  error?: string;
  multiline?: boolean;
  onChange: (value: string) => void;
}) {
  const { inputId, errorId } = fieldIds(label);
  const shared = {
    id: inputId,
    value,
    "aria-describedby": error ? errorId : undefined,
    onChange: (e: { target: { value: string } }) => onChange(e.target.value),
    className: "rounded border border-neutral-300 px-2 py-1 text-sm",
  };

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm text-neutral-500">
        {label}
      </label>
      {multiline ? <textarea {...shared} rows={3} /> : <input {...shared} />}
      <FieldError id={errorId} message={error} />
    </div>
  );
}

function NumberField({
  label,
  value,
  suffix,
  step,
  hint,
  error,
  onChange,
}: {
  label: string;
  value: number | null;
  suffix: string;
  step?: string;
  hint?: string;
  error?: string;
  onChange: (value: number | null) => void;
}) {
  const { inputId, errorId } = fieldIds(label);

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm text-neutral-500">
        {label}
      </label>
      <span className="flex items-baseline gap-1">
        <input
          id={inputId}
          type="number"
          step={step}
          value={value ?? ""}
          aria-describedby={error ? errorId : undefined}
          onChange={(e) =>
            onChange(e.target.value === "" ? null : Number(e.target.value))
          }
          className="w-24 rounded border border-neutral-300 px-2 py-1 text-sm"
        />
        <span className="text-sm text-neutral-500">{suffix}</span>
        {hint && <span className="text-sm text-neutral-400">{hint}</span>}
      </span>
      <FieldError id={errorId} message={error} />
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: number | null;
  options: { id: number; name: string }[];
  onChange: (value: number | null) => void;
}) {
  const { inputId } = fieldIds(label);

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm text-neutral-500">
        {label}
      </label>
      <select
        id={inputId}
        value={value ?? ""}
        onChange={(e) =>
          onChange(e.target.value === "" ? null : Number(e.target.value))
        }
        className="rounded border border-neutral-300 px-2 py-1 text-sm"
      >
        <option value="">선택 안 함</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="whitespace-pre-line text-sm text-red-600">
      {message}
    </p>
  );
}
