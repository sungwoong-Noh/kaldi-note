"use client";

import { useGrindPreview, useGrinders } from "@/features/gear/queries";
import { ApiError } from "@/lib/api-client";
import { useDebounced } from "@/lib/useDebounced";
import type { GrindSettingUnit } from "../formState";

/** 타이핑이 멈춘 뒤 환산을 부르기까지 기다리는 시간. */
const PREVIEW_DEBOUNCE_MS = 400;

const UNIT_LABELS: Record<GrindSettingUnit, string> = {
  CLICK: "클릭",
  NUMBER: "숫자",
  MICRON: "마이크론",
};

type Props = {
  grinderModelId: number | null;
  unit: GrindSettingUnit | null;
  value: number | null;
  onGrinderChange: (id: number | null) => void;
  onUnitChange: (unit: GrindSettingUnit | null) => void;
  onValueChange: (value: number | null) => void;
  onSessionLost?: () => void;
};

/**
 * 그라인더·단위·값 입력과 마이크론 미리보기.
 *
 * <p><b>미리보기가 실패해도 저장을 막지 않는다.</b> 무단계 그라인더(422)든 범위 밖 값(400)이든, 저장 요청은 서버가 판정한다. 여기서 막으면
 * 무단계 그라인더 사용자는 분쇄도를 아예 기록할 수 없게 된다.
 */
export function GrindSettingField({
  grinderModelId,
  unit,
  value,
  onGrinderChange,
  onUnitChange,
  onValueChange,
  onSessionLost,
}: Props) {
  const grinders = useGrinders(onSessionLost);
  // 값만 디바운스한다. 그라인더·단위는 선택이라 한 번에 확정된다.
  const settledValue = useDebounced(value, PREVIEW_DEBOUNCE_MS);
  const preview = useGrindPreview(
    { grinderModelId, unit, value: settledValue },
    onSessionLost,
  );

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-base font-semibold">분쇄도</legend>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1 text-sm">
          <span className="text-neutral-500">그라인더</span>
          <select
            aria-label="그라인더"
            value={grinderModelId ?? ""}
            onChange={(e) =>
              onGrinderChange(
                e.target.value === "" ? null : Number(e.target.value),
              )
            }
            className="rounded border border-neutral-300 px-2 py-1"
          >
            <option value="">선택 안 함</option>
            {(grinders.data ?? []).map((grinder) => (
              <option key={grinder.id} value={grinder.id}>
                {grinder.brand} {grinder.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1 text-sm">
          <span className="text-neutral-500">분쇄도 단위</span>
          <select
            aria-label="분쇄도 단위"
            value={unit ?? ""}
            onChange={(e) =>
              onUnitChange(
                e.target.value === ""
                  ? null
                  : (e.target.value as GrindSettingUnit),
              )
            }
            className="rounded border border-neutral-300 px-2 py-1"
          >
            <option value="">선택 안 함</option>
            {Object.entries(UNIT_LABELS).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1 text-sm">
          <span className="text-neutral-500">분쇄도 값</span>
          <input
            aria-label="분쇄도 값"
            type="number"
            step="0.1"
            value={value ?? ""}
            onChange={(e) =>
              onValueChange(
                e.target.value === "" ? null : Number(e.target.value),
              )
            }
            className="w-24 rounded border border-neutral-300 px-2 py-1"
          />
        </label>
      </div>

      <MicronPreview
        unit={unit}
        value={value}
        micron={preview.data?.micron}
        error={preview.error}
      />
    </fieldset>
  );
}

/**
 * 환산 결과 한 줄.
 *
 * <p><b>"추정치"를 반드시 함께 띄운다.</b> 버 형상과 입도 분포가 달라 정확한 등가 변환은 물리적으로 불가능하다 — 확정값처럼 보이면 안 된다.
 */
function MicronPreview({
  unit,
  value,
  micron,
  error,
}: {
  unit: GrindSettingUnit | null;
  value: number | null;
  micron: number | undefined;
  error: unknown;
}) {
  // 마이크론으로 직접 입력했으면 환산할 것이 없다. API를 부르지 않고 그대로 보여준다.
  if (unit === "MICRON" && value !== null) {
    return <Estimate micron={value} />;
  }

  if (error instanceof ApiError) {
    const message =
      error.status === 422
        ? "이 그라인더는 환산 정보가 없습니다"
        : error.message;
    return <p className="text-sm text-amber-600">{message}</p>;
  }

  if (micron === undefined) return null;

  return <Estimate micron={micron} />;
}

function Estimate({ micron }: { micron: number }) {
  return (
    <p className="text-sm text-neutral-600">
      약 {micron} µm <span className="text-neutral-400">(추정치)</span>
    </p>
  );
}
