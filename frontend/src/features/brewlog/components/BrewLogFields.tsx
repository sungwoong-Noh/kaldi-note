"use client";

import type { UserGrinder } from "@/features/gear/schema";
import type { mapFieldErrors } from "@/lib/fieldErrors";
import type { BrewLogFormState } from "../formState";
import { RatingInput } from "./RatingInput";
import { Button, SELECT_EXTRA, controlClass } from "@/components/ui";

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
      <label className="flex flex-col gap-1 text-body">
        <span className="shrink-0 text-ink-3">내린 시각</span>
        <input
          type="datetime-local"
          aria-label="내린 시각"
          value={state.brewedAt}
          onChange={(e) => set("brewedAt", e.target.value)}
          aria-describedby={
            fieldErrors?.byField.brewedAt ? "brew-brewed-at-error" : undefined
          }
          aria-invalid={fieldErrors?.byField.brewedAt ? true : undefined}
          className={controlClass("", Boolean(fieldErrors?.byField.brewedAt))}
        />
        {fieldErrors?.byField.brewedAt && (
          <span id="brew-brewed-at-error" className="text-body-sm text-danger">
            {fieldErrors.byField.brewedAt}
          </span>
        )}
      </label>

      {beanSlot}

      <fieldset className="flex min-w-0 flex-col gap-2">
        <legend className="text-card-title font-semibold">수치</legend>
        <NumberField
          label="원두량"
          unit="g"
          value={state.actualDoseG}
          onChange={(v) => set("actualDoseG", v)}
          error={fieldErrors?.byField.actualDoseG}
        />
        <NumberField
          label="물량"
          unit="g"
          value={state.actualWaterG}
          onChange={(v) => set("actualWaterG", v)}
          error={fieldErrors?.byField.actualWaterG}
        />
        <NumberField
          label="물 온도"
          unit="°C"
          value={state.actualWaterTempC}
          onChange={(v) => set("actualWaterTempC", v)}
          error={fieldErrors?.byField.actualWaterTempC}
        />
        <MinSecField
          label="추출 시간"
          value={state.actualTotalTimeSeconds}
          onChange={(v) => set("actualTotalTimeSeconds", v)}
          error={fieldErrors?.byField.actualTotalTimeSeconds}
        />
        <MinSecField
          label="드로다운 시간"
          value={state.actualDrawdownSeconds}
          onChange={(v) => set("actualDrawdownSeconds", v)}
          error={fieldErrors?.byField.actualDrawdownSeconds}
        />
      </fieldset>

      <fieldset className="flex min-w-0 flex-col gap-2">
        <legend className="text-card-title font-semibold">장비</legend>
        {grinders.length === 0 && (
          <p className="text-body text-ink-3">등록된 그라인더가 없습니다</p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex w-full items-center gap-2 text-body">
            <span className="shrink-0 text-ink-3">그라인더</span>
            <select
              aria-label="그라인더"
              value={state.userGrinderId ?? ""}
              onChange={(e) =>
                set(
                  "userGrinderId",
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
              className={controlClass(SELECT_EXTRA)}
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
            <Button onClick={onAddGrinder}>+ 그라인더 등록</Button>
          )}
        </div>

        <NumberField
          label="분쇄도 값"
          value={state.actualGrindSettingValue}
          onChange={(v) => set("actualGrindSettingValue", v)}
          error={fieldErrors?.byField.actualGrindSettingValue}
        />
      </fieldset>

      <fieldset className="flex min-w-0 flex-col gap-2">
        <legend className="text-card-title font-semibold">결과</legend>
        <NumberField
          label="음료 중량"
          unit="g"
          value={state.beverageWeightG}
          onChange={(v) => set("beverageWeightG", v)}
          error={fieldErrors?.byField.beverageWeightG}
        />
        {/* TDS는 리프랙토미터가 있을 때만 채운다. 없어도 나머지는 전부 저장된다. */}
        <NumberField
          label="TDS"
          unit="%"
          value={state.tdsPercent}
          onChange={(v) => set("tdsPercent", v)}
          error={fieldErrors?.byField.tdsPercent}
        />
      </fieldset>

      <fieldset className="flex min-w-0 flex-col gap-2">
        <legend className="text-card-title font-semibold">평가</legend>

        <RatingInput value={state.rating} onChange={(v) => set("rating", v)} />

        {!state.sensoryExpanded && (
          <Button onClick={() => set("sensoryExpanded", true)}>
            맛 자세히
          </Button>
        )}

        {state.sensoryExpanded &&
          SENSORY_AXES.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 text-body">
              <span className="w-20 shrink-0 text-ink-3">{label}</span>
              <select
                aria-label={label}
                value={state[key] ?? ""}
                onChange={(e) =>
                  set(
                    key,
                    e.target.value === "" ? null : Number(e.target.value),
                  )
                }
                className={controlClass(SELECT_EXTRA)}
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

        <label className="flex flex-col gap-1 text-body">
          <span className="shrink-0 text-ink-3">메모</span>
          <textarea
            aria-label="메모"
            value={state.overallNote}
            onChange={(e) => set("overallNote", e.target.value)}
            rows={3}
            aria-describedby={
              fieldErrors?.byField.overallNote ? "brew-note-error" : undefined
            }
            aria-invalid={fieldErrors?.byField.overallNote ? true : undefined}
            className={controlClass(
              "",
              Boolean(fieldErrors?.byField.overallNote),
            )}
          />
          {fieldErrors?.byField.overallNote && (
            <span id="brew-note-error" className="text-body-sm text-danger">
              {fieldErrors.byField.overallNote}
            </span>
          )}
        </label>
      </fieldset>

      <VisibilityField
        value={state.visibility}
        onChange={(v) => set("visibility", v)}
      />
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
  unit,
  value,
  onChange,
  error,
}: {
  label: string;
  /** 입력칸 오른쪽 안에 붙는다 — 레시피 폼(`Input`)과 같은 자리다 */
  unit?: string;
  value: number | null;
  onChange: (value: number | null) => void;
  error?: string;
}) {
  const errorId = `brew-${encodeURIComponent(label)}-error`;

  return (
    <label className="flex items-center gap-2 text-body">
      <span className="w-20 shrink-0 text-ink-3">{label}</span>
      <span className="relative flex w-full min-w-0 items-center">
        <input
          type="number"
          aria-label={label}
          value={value ?? ""}
          onChange={(e) =>
            onChange(e.target.value === "" ? null : Number(e.target.value))
          }
          aria-describedby={error ? errorId : undefined}
          aria-invalid={error ? true : undefined}
          className={controlClass(
            `text-metric ${unit !== undefined ? "pr-12" : ""}`,
            Boolean(error),
          )}
        />
        {unit !== undefined && (
          <span
            aria-hidden
            data-unit
            className="pointer-events-none absolute right-2 text-metric text-ink-3"
          >
            {unit}
          </span>
        )}
      </span>
      {error && (
        <span id={errorId} className="text-body-sm text-danger">
          {error}
        </span>
      )}
    </label>
  );
}

/** `3:30` 같은 `m:ss` 텍스트. 숫자 키패드에는 `:`가 없어 `inputMode`를 지정하지 않는다. */
function MinSecField({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const errorId = `brew-${encodeURIComponent(label)}-error`;

  return (
    <label className="flex items-center gap-2 text-body">
      <span className="w-20 shrink-0 text-ink-3">{label}</span>
      <input
        type="text"
        aria-label={label}
        placeholder="0:00"
        value={value}
        onChange={(e) => onChange(e.target.value.trim())}
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? true : undefined}
        className={controlClass("", Boolean(error))}
      />
      {error && (
        <span id={errorId} className="text-body-sm text-danger">
          {error}
        </span>
      )}
    </label>
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

/** 3분할. `radio` 입력이 아니라 버튼이다 — 입력칸 오른쪽 끝 정렬(AC-STRUCT-01)에 섞이지 않는다. */
function VisibilityField({
  value,
  onChange,
}: {
  value: BrewLogFormState["visibility"];
  onChange: (value: BrewLogFormState["visibility"]) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="공개 범위"
      className="flex min-w-0 flex-col gap-2"
    >
      <span className="text-card-title font-semibold">공개 범위</span>
      <div className="flex gap-2">
        {VISIBILITY_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            onClick={() => onChange(option.value)}
            className="min-h-11 flex-1 rounded-tag border border-border px-3 py-2 text-body font-medium aria-checked:border-ink aria-checked:bg-ink aria-checked:text-on-ink"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
