"use client";

import { useEffect, useRef, useState } from "react";
import { searchRecipes } from "../api";
import { DoseRangeFilter } from "./DoseRangeFilter";
import { DRIPPER_OPTIONS, ROAST_OPTIONS, toggleValue } from "../filterOptions";
import type {
  RecipeDripper,
  RecipeRoast,
  RecipeTemp,
} from "../useRecipeSearchState";
import { Button } from "@/components/ui";

const COUNT_DEBOUNCE_MS = 300;

export interface FilterSheetApplied {
  temp?: RecipeTemp;
  roast: RecipeRoast[];
  dripper: RecipeDripper[];
  doseMin?: number;
  doseMax?: number;
}

/**
 * 모바일 필터 바텀시트 — 스테이징 영역이다(AC-RECIPESBREWS-82). 온도·배전도·기구를 여기서
 * 바꿔도 목록에는 반영되지 않고, "N개 결과 보기" CTA만 300ms 디바운스로 건수를 다시 센다.
 * "적용"(CTA 클릭)해야 비로소 부모 상태(URL·목록)에 반영된다. "초기화"는 스테이징만 되돌린다.
 */
export function FilterSheet({
  q,
  applied,
  onApply,
  onSessionLost,
}: {
  q: string;
  applied: FilterSheetApplied;
  onApply: (patch: Partial<FilterSheetApplied>) => void;
  onSessionLost?: () => void;
}) {
  const [staged, setStaged] = useState<FilterSheetApplied>(applied);
  const [resultCount, setResultCount] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void searchRecipes(0, onSessionLost, {
        scope: "PUBLIC",
        q: q || undefined,
        temp: staged.temp,
        roast: staged.roast.length > 0 ? staged.roast : undefined,
        dripper: staged.dripper.length > 0 ? staged.dripper : undefined,
        doseMin: staged.doseMin,
        doseMax: staged.doseMax,
      }).then((page) => setResultCount(page.totalElements));
    }, COUNT_DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [
    staged.temp,
    staged.roast,
    staged.dripper,
    staged.doseMin,
    staged.doseMax,
    q,
    onSessionLost,
  ]);

  function reset() {
    setStaged({ temp: undefined, roast: [], dripper: [] });
  }

  return (
    <div role="dialog" aria-label="필터" className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="온도">
        <button
          type="button"
          aria-pressed={staged.temp === "HOT"}
          onClick={() =>
            setStaged((s) => ({
              ...s,
              temp: s.temp === "HOT" ? undefined : "HOT",
            }))
          }
          className="min-h-11 rounded-tag border border-border px-3 py-2 text-body-sm aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-on-ink"
        >
          Hot
        </button>
        <button
          type="button"
          aria-pressed={staged.temp === "ICE"}
          onClick={() =>
            setStaged((s) => ({
              ...s,
              temp: s.temp === "ICE" ? undefined : "ICE",
            }))
          }
          className="min-h-11 rounded-tag border border-border px-3 py-2 text-body-sm aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-on-ink"
        >
          Ice
        </button>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="배전도">
        {ROAST_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            aria-pressed={staged.roast.includes(opt.value)}
            onClick={() =>
              setStaged((s) => ({
                ...s,
                roast: toggleValue(s.roast, opt.value),
              }))
            }
            className="min-h-11 rounded-tag border border-border px-3 py-2 text-body-sm aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-on-ink"
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="기구">
        {DRIPPER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            aria-pressed={staged.dripper.includes(opt.value)}
            onClick={() =>
              setStaged((s) => ({
                ...s,
                dripper: toggleValue(s.dripper, opt.value),
              }))
            }
            className="min-h-11 rounded-tag border border-border px-3 py-2 text-body-sm aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-on-ink"
          >
            {opt.label}
          </button>
        ))}
      </div>

      <DoseRangeFilter
        doseMin={staged.doseMin}
        doseMax={staged.doseMax}
        onCommit={(patch) => setStaged((s) => ({ ...s, ...patch }))}
      />

      <div className="flex gap-2">
        <Button type="button" variant="secondary" onClick={reset}>
          초기화
        </Button>
        <Button
          type="button"
          variant="primary"
          block
          onClick={() => onApply(staged)}
        >
          {resultCount === null ? "결과 보기" : `${resultCount}개 결과 보기`}
        </Button>
      </div>
    </div>
  );
}
