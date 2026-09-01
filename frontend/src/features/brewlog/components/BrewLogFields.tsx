"use client";

import type { UserGrinder } from "@/features/gear/schema";
import type { mapFieldErrors } from "@/lib/fieldErrors";
import type { BrewLogFormState } from "../formState";
import { RatingInput } from "./RatingInput";

/** 5축 관능 평가. 접혀 있을 때는 그리지 않으므로 요청 본문에도 담기지 않는다. */
const SENSORY_AXES = [
  { key: "acidity", label: "산미" },
  { key: "sweetness", label: "단맛" },
  { key: "body", label: "바디" },
  { key: "bitterness", label: "쓴맛" },
  { key: "aftertaste", label: "여운" },
] as const;

interface BrewLogFieldsProps {
  state: BrewLogFormState;
  grinders: UserGrinder[];
  fieldErrors: ReturnType<typeof mapFieldErrors> | null;
  onChange: <K extends keyof BrewLogFormState>(
    key: K,
    value: BrewLogFormState[K],
  ) => void;
  /** 없으면 `+ 그라인더 등록` 버튼을 그리지 않는다 — 편집 화면은 모달을 갖지 않는다 */
  onAddGrinder?: () => void;
  /** `내린 시각`과 `그라인더` 사이에 끼울 것. 작성 화면은 원두 선택란을, 편집 화면은 잠긴 원두 표시를 넣는다 */
  beanSlot: React.ReactNode;
}

/**
 * 작성 화면과 편집 화면이 함께 쓰는 입력칸 묶음.
 *
 * <p>여기에는 저장 버튼도 모달도 없다 — 저장 방식(POST와 PATCH)과 모달 유무가 화면마다 다르다.
 */
export function BrewLogFields({
  state,
  grinders,
  fieldErrors,
  onChange: set,
  onAddGrinder,
  beanSlot,
}: BrewLogFieldsProps) {
  return (
    <>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-neutral-500">내린 시각</span>
        <input
          type="datetime-local"
          aria-label="내린 시각"
          value={state.brewedAt}
          onChange={(e) => set("brewedAt", e.target.value)}
          aria-describedby={
            fieldErrors?.byField.brewedAt ? "brew-brewed-at-error" : undefined
          }
          className="rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700"
        />
        {fieldErrors?.byField.brewedAt && (
          <span id="brew-brewed-at-error" className="text-xs text-red-600">
            {fieldErrors.byField.brewedAt}
          </span>
        )}
      </label>

      {beanSlot}

      <fieldset className="flex flex-col gap-2">
        <legend className="text-base font-semibold">그라인더</legend>
        {grinders.length === 0 && (
          <p className="text-sm text-neutral-500">등록된 그라인더가 없습니다</p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1 text-sm">
            <span className="text-neutral-500">그라인더</span>
            <select
              aria-label="그라인더"
              value={state.userGrinderId ?? ""}
              onChange={(e) =>
                set(
                  "userGrinderId",
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
              className="rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700"
            >
              <option value="">선택 안 함</option>
              {grinders.map((grinder) => (
                <option key={grinder.id} value={grinder.id}>
                  {grinderLabel(grinder)}
                </option>
              ))}
            </select>
          </label>

          {onAddGrinder && (
            <button
              type="button"
              onClick={onAddGrinder}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
            >
              + 그라인더 등록
            </button>
          )}
        </div>

        <NumberField
          label="분쇄도 값"
          value={state.actualGrindSettingValue}
          onChange={(v) => set("actualGrindSettingValue", v)}
          error={fieldErrors?.byField.actualGrindSettingValue}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-base font-semibold">실측값</legend>
        <NumberField
          label="원두량"
          value={state.actualDoseG}
          onChange={(v) => set("actualDoseG", v)}
          error={fieldErrors?.byField.actualDoseG}
        />
        <NumberField
          label="물량"
          value={state.actualWaterG}
          onChange={(v) => set("actualWaterG", v)}
          error={fieldErrors?.byField.actualWaterG}
        />
        <NumberField
          label="물 온도"
          value={state.actualWaterTempC}
          onChange={(v) => set("actualWaterTempC", v)}
          error={fieldErrors?.byField.actualWaterTempC}
        />
        <NumberField
          label="추출 시간"
          value={state.actualTotalTimeSeconds}
          onChange={(v) => set("actualTotalTimeSeconds", v)}
          error={fieldErrors?.byField.actualTotalTimeSeconds}
        />
        <NumberField
          label="드로다운 시간"
          value={state.actualDrawdownSeconds}
          onChange={(v) => set("actualDrawdownSeconds", v)}
          error={fieldErrors?.byField.actualDrawdownSeconds}
        />
        <NumberField
          label="음료 중량"
          value={state.beverageWeightG}
          onChange={(v) => set("beverageWeightG", v)}
          error={fieldErrors?.byField.beverageWeightG}
        />
        {/* TDS는 리프랙토미터가 있을 때만 채운다. 없어도 나머지는 전부 저장된다. */}
        <NumberField
          label="TDS"
          value={state.tdsPercent}
          onChange={(v) => set("tdsPercent", v)}
          error={fieldErrors?.byField.tdsPercent}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-base font-semibold">평가</legend>

        <RatingInput value={state.rating} onChange={(v) => set("rating", v)} />

        {!state.sensoryExpanded && (
          <button
            type="button"
            onClick={() => set("sensoryExpanded", true)}
            className="self-start rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
          >
            맛 자세히
          </button>
        )}

        {state.sensoryExpanded &&
          SENSORY_AXES.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <span className="w-20 text-neutral-500">{label}</span>
              <select
                aria-label={label}
                value={state[key] ?? ""}
                onChange={(e) =>
                  set(key, e.target.value === "" ? null : Number(e.target.value))
                }
                className="rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700"
              >
                <option value="">선택 안 함</option>
                {[1, 2, 3, 4, 5].map((score) => (
                  <option key={score} value={score}>
                    {score}
                  </option>
                ))}
              </select>
            </label>
          ))}

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">메모</span>
          <textarea
            aria-label="메모"
            value={state.overallNote}
            onChange={(e) => set("overallNote", e.target.value)}
            rows={3}
            aria-describedby={
              fieldErrors?.byField.overallNote ? "brew-note-error" : undefined
            }
            className="rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700"
          />
          {fieldErrors?.byField.overallNote && (
            <span id="brew-note-error" className="text-xs text-red-600">
              {fieldErrors.byField.overallNote}
            </span>
          )}
        </label>
      </fieldset>
    </>
  );
}

/** 별명을 넣지 않았으면 모델 이름으로 부른다 — 선택란이 빈 항목처럼 보이면 고를 수 없다. */
function grinderLabel(grinder: UserGrinder): string {
  const model = `${grinder.brand} ${grinder.grinderModelName}`;
  return grinder.nickname ? `${grinder.nickname} (${model})` : model;
}

function NumberField({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  error?: string;
}) {
  const errorId = `brew-${encodeURIComponent(label)}-error`;

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="w-20 text-neutral-500">{label}</span>
      <input
        type="number"
        aria-label={label}
        value={value ?? ""}
        onChange={(e) =>
          onChange(e.target.value === "" ? null : Number(e.target.value))
        }
        aria-describedby={error ? errorId : undefined}
        className="w-32 rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700"
      />
      {error && (
        <span id={errorId} className="text-xs text-red-600">
          {error}
        </span>
      )}
    </label>
  );
}
