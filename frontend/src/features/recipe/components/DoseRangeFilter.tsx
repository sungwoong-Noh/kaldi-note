import { useEffect, useRef, useState } from "react";

const DOSE_MIN = 10;
const DOSE_MAX = 30;
const DOSE_COMMIT_DEBOUNCE_MS = 200;

/**
 * 원두량 슬라이더(10–30g). 드래그는 pointerup에서 1회, 화살표 키는 마지막 입력 후 200ms
 * 디바운스로 1회만 커밋한다(AC-RECIPESBREWS-62).
 */
export function DoseRangeFilter({
  doseMin,
  doseMax,
  onCommit,
}: {
  doseMin?: number;
  doseMax?: number;
  onCommit: (patch: { doseMin?: number; doseMax?: number }) => void;
}) {
  const [draftMin, setDraftMin] = useState(doseMin ?? DOSE_MIN);
  const [draftMax, setDraftMax] = useState(doseMax ?? DOSE_MAX);
  const draggingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function commit(min: number, max: number) {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    onCommit({
      doseMin: min === DOSE_MIN ? undefined : min,
      doseMax: max === DOSE_MAX ? undefined : max,
    });
  }

  function scheduleCommit(min: number, max: number) {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(
      () => commit(min, max),
      DOSE_COMMIT_DEBOUNCE_MS,
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-body-sm text-ink-3">
        원두량 {draftMin}–{draftMax}g
      </span>
      <input
        type="range"
        aria-label="원두량 최소"
        min={DOSE_MIN}
        max={DOSE_MAX}
        value={draftMin}
        onPointerDown={() => {
          draggingRef.current = true;
        }}
        onPointerUp={() => {
          draggingRef.current = false;
          commit(draftMin, draftMax);
        }}
        onChange={(e) => {
          const value = Math.min(Number(e.target.value), draftMax);
          setDraftMin(value);
          if (!draggingRef.current) scheduleCommit(value, draftMax);
        }}
      />
      <input
        type="range"
        aria-label="원두량 최대"
        min={DOSE_MIN}
        max={DOSE_MAX}
        value={draftMax}
        onPointerDown={() => {
          draggingRef.current = true;
        }}
        onPointerUp={() => {
          draggingRef.current = false;
          commit(draftMin, draftMax);
        }}
        onChange={(e) => {
          const value = Math.max(Number(e.target.value), draftMin);
          setDraftMax(value);
          if (!draggingRef.current) scheduleCommit(draftMin, value);
        }}
      />
    </div>
  );
}
