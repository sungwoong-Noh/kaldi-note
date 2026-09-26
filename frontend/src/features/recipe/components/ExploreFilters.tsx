"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { useViewportWidth } from "@/lib/useViewportWidth";
import { DoseRangeFilter } from "./DoseRangeFilter";
import { FilterSheet } from "./FilterSheet";
import { RecipeSearchInput } from "./RecipeSearchInput";
import { DRIPPER_OPTIONS, ROAST_OPTIONS, toggleValue } from "../filterOptions";
import type { RecipeSearchState } from "../useRecipeSearchState";

/** ≥760px는 웹 pill 줄, 그 아래는 모바일 필터 시트다(AC-RECIPESBREWS-61·82). */
const WEB_BREAKPOINT_PX = 760;

/**
 * 둘러보기 전용 검색·필터. 웹(≥760px)은 pill 줄이 즉시 반영되고(AC-61), 모바일은 필터
 * 버튼이 스테이징 시트를 연다(AC-82). owner pill(AC-63)은 내 서랍 전용이라 여기 없다.
 */
export function ExploreFilters({
  state,
  setState,
  onSessionLost,
}: {
  state: RecipeSearchState;
  setState: (patch: Partial<RecipeSearchState>) => void;
  onSessionLost: () => void;
}) {
  const width = useViewportWidth();
  const isMobile = width !== null && width < WEB_BREAKPOINT_PX;
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className="mb-4 flex flex-col gap-3">
      <RecipeSearchInput q={state.q} onCommit={(q) => setState({ q })} />

      {!isMobile && (
        <>
          <div className="flex flex-wrap gap-2" role="group" aria-label="온도">
            <button
              type="button"
              aria-pressed={state.temp === "HOT"}
              onClick={() =>
                setState({ temp: state.temp === "HOT" ? undefined : "HOT" })
              }
              className="min-h-11 rounded-tag border border-border px-3 py-2 text-body-sm aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-on-ink"
            >
              Hot
            </button>
            <button
              type="button"
              aria-pressed={state.temp === "ICE"}
              onClick={() =>
                setState({ temp: state.temp === "ICE" ? undefined : "ICE" })
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
                aria-pressed={state.roast.includes(opt.value)}
                onClick={() =>
                  setState({ roast: toggleValue(state.roast, opt.value) })
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
                aria-pressed={state.dripper.includes(opt.value)}
                onClick={() =>
                  setState({ dripper: toggleValue(state.dripper, opt.value) })
                }
                className="min-h-11 rounded-tag border border-border px-3 py-2 text-body-sm aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-on-ink"
              >
                {opt.label}
              </button>
            ))}
          </div>

          <DoseRangeFilter
            doseMin={state.doseMin}
            doseMax={state.doseMax}
            onCommit={(patch) => setState(patch)}
          />
        </>
      )}

      {isMobile && (
        <Button type="button" onClick={() => setSheetOpen(true)}>
          필터
        </Button>
      )}

      {isMobile && sheetOpen && (
        <FilterSheet
          q={state.q}
          applied={{
            temp: state.temp,
            roast: state.roast,
            dripper: state.dripper,
            doseMin: state.doseMin,
            doseMax: state.doseMax,
          }}
          onApply={(patch) => {
            setState(patch);
            setSheetOpen(false);
          }}
          onSessionLost={onSessionLost}
        />
      )}

      <div className="flex gap-2 text-body-sm" role="group" aria-label="정렬">
        <button
          type="button"
          aria-pressed={state.sort === undefined}
          onClick={() => setState({ sort: undefined })}
          className="min-h-11 rounded-tag border border-border px-3 py-2 aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-on-ink"
        >
          인기순
        </button>
        <button
          type="button"
          aria-pressed={state.sort === "RECENT"}
          onClick={() => setState({ sort: "RECENT" })}
          className="min-h-11 rounded-tag border border-border px-3 py-2 aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-on-ink"
        >
          최신순
        </button>
      </div>
    </div>
  );
}
