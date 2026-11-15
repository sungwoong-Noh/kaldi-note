"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { searchRecipes } from "@/features/recipe/api";
import type { RecipeSummary } from "@/features/recipe/schema";
import {
  formatGramsCompact,
  formatRatio,
  formatTemperatureCompact,
} from "@/lib/format";

/** 한 번에 가져오는 서랍 레시피 최대 건수(AC-QUICKBREW-73·76). */
const DRAWER_PAGE_SIZE = 50;

export interface RecipeLinkSheetProps {
  selectedId: number | null;
  onSelect: (recipe: RecipeSummary | null) => void;
  onBack: () => void;
  onClose?: () => void;
}

function recipeMeta(recipe: RecipeSummary): string {
  const parts = [
    `${formatGramsCompact(recipe.doseG)} → ${formatGramsCompact(recipe.waterG)}`,
    formatRatio(recipe.ratio),
  ];
  if (recipe.waterTempC !== undefined) {
    parts.push(formatTemperatureCompact(recipe.waterTempC));
  }
  if (recipe.sourceAuthorName) {
    parts.push(`${recipe.sourceAuthorName} 님 레시피`);
  }
  return parts.join(" · ");
}

function RadioDot({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`size-[18px] shrink-0 rounded-full ${
        active ? "border-[5px] border-ink" : "border-[1.5px] border-border"
      }`}
    />
  );
}

/**
 * 레시피 연결 시트 — docs/specs/2026-11-14-quick-brew.md Task 14, 시안 B4c.
 *
 * <p>빠른 기록 시트(`z-40`) 위에 한 장 더 쌓인다(`z-50`). 고르면 입력값을 덮어쓰지 않고
 * `recipeId`만 연결하며(비교용), 한 번에 `scope=DRAWER&size=50`만 불러온다.
 */
export function RecipeLinkSheet({
  selectedId,
  onSelect,
  onBack,
  onClose,
}: RecipeLinkSheetProps) {
  const sheetRef = useRef<HTMLElement>(null);
  const backRef = useRef(onBack);
  useEffect(() => {
    backRef.current = onBack;
  }, [onBack]);

  // 500 오류 시 자동 재시도를 기다리지 않고 즉시 「다시 시도」 버튼을 노출한다(AC-QUICKBREW-76).
  const query = useQuery({
    queryKey: ["recipes", "drawer-link"],
    queryFn: () =>
      searchRecipes(0, undefined, { scope: "DRAWER", size: DRAWER_PAGE_SIZE }),
    retry: false,
  });

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    if (
      sheetRef.current &&
      !sheetRef.current.contains(document.activeElement)
    ) {
      sheetRef.current.focus({ preventScroll: true });
    }
    return () => {
      if (prev && prev.isConnected && prev !== document.body) {
        prev.focus({ preventScroll: true });
      }
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing || e.keyCode === 229) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        backRef.current();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, []);

  const rowClass =
    "kn-press hit-44 flex min-h-[44px] w-full items-center gap-[12px] py-[14px] text-left";
  const recipes = query.data?.content ?? [];

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end min-[760px]:flex-row min-[760px]:justify-end">
      <div
        aria-hidden="true"
        onClick={onBack}
        className="kn-scrim-in absolute inset-0 bg-scrim"
      />
      <section
        ref={sheetRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="레시피 연결"
        className="relative flex max-h-[82dvh] w-full animate-[sheet-slide-in_240ms_cubic-bezier(0.2,0.8,0.2,1)] flex-col gap-[18px] overflow-y-auto rounded-t-[18px] border-t border-border bg-paper px-[24px] pt-[10px] pb-[20px] outline-none motion-reduce:animate-none min-[760px]:h-full min-[760px]:max-h-none min-[760px]:w-[min(100vw,520px)] min-[760px]:animate-[panel-slide-in_240ms_cubic-bezier(0.2,0.8,0.2,1)] min-[760px]:rounded-none min-[760px]:border-t-0 min-[760px]:border-l min-[760px]:px-[28px] min-[760px]:py-[22px] min-[1024px]:w-[400px] min-[1280px]:w-[440px]"
      >
        <div
          aria-hidden="true"
          className="mx-auto -mt-[2px] -mb-[10px] flex h-[28px] w-[120px] shrink-0 items-center justify-center min-[760px]:hidden"
        >
          <span className="h-[4px] w-[36px] rounded-full bg-border" />
        </div>

        <div className="flex items-center justify-between text-[13px] text-ink-3">
          <button type="button" onClick={onBack} className="hit-44">
            ‹ 이전
          </button>
          <button type="button" onClick={onClose ?? onBack} className="hit-44">
            닫기
          </button>
        </div>

        <div className="flex flex-col gap-[6px]">
          <h2 className="text-[21px] font-semibold tracking-[-0.02em] text-ink">
            어떤 레시피로 내렸나요?
          </h2>
          <p className="text-[14px] text-ink-3">
            값은 바뀌지 않아요. 비교만 생겨요.
          </p>
        </div>

        {query.isPending && (
          <p className="text-[14px] text-ink-3">불러오는 중…</p>
        )}

        {query.isError && (
          <div className="flex flex-col gap-[12px]">
            <p role="alert" className="text-[14px] text-accent">
              레시피를 불러오지 못했어요.
            </p>
            <button
              type="button"
              onClick={() => void query.refetch()}
              className="kn-press hit-44 self-start rounded-[8px] border border-border bg-paper px-[16px] py-[11px] text-[14px] font-medium text-ink"
            >
              다시 시도
            </button>
          </div>
        )}

        {query.isSuccess && recipes.length === 0 && (
          <div className="flex flex-col gap-[12px]">
            <p className="text-[14px] text-ink-3">서랍에 레시피가 없어요.</p>
            <ul className="divide-y divide-border border-t border-border">
              <li>
                <button
                  type="button"
                  aria-pressed={selectedId === null}
                  onClick={() => onSelect(null)}
                  className={rowClass}
                >
                  <RadioDot active={selectedId === null} />
                  <span className="flex flex-col gap-[2px]">
                    <span className="text-[14.5px] font-medium text-ink">
                      연결 안 함
                    </span>
                    <span className="font-mono text-[11.5px] text-ink-3">
                      레시피 없이 기록
                    </span>
                  </span>
                </button>
              </li>
            </ul>
          </div>
        )}

        {query.isSuccess && recipes.length > 0 && (
          <div>
            <div className="font-mono text-[10px] font-medium tracking-[0.12em] text-ink-3 uppercase">
              내 레시피 · 최근 내린 순
            </div>
            <ul className="mt-[8px] divide-y divide-border border-t border-border">
              <li>
                <button
                  type="button"
                  aria-pressed={selectedId === null}
                  onClick={() => onSelect(null)}
                  className={rowClass}
                >
                  <RadioDot active={selectedId === null} />
                  <span className="flex flex-col gap-[2px]">
                    <span className="text-[14.5px] font-medium text-ink">
                      연결 안 함
                    </span>
                    <span className="font-mono text-[11.5px] text-ink-3">
                      레시피 없이 기록
                    </span>
                  </span>
                </button>
              </li>
              {recipes.map((recipe) => (
                <li key={recipe.id}>
                  <button
                    type="button"
                    aria-pressed={selectedId === recipe.id}
                    onClick={() => onSelect(recipe)}
                    className={rowClass}
                  >
                    <RadioDot active={selectedId === recipe.id} />
                    <span className="flex min-w-0 flex-col gap-[2px]">
                      <span className="text-[14.5px] font-medium text-ink">
                        {recipe.title}
                      </span>
                      <span className="font-mono text-[11.5px] text-ink-3 tabular-nums">
                        {recipeMeta(recipe)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
