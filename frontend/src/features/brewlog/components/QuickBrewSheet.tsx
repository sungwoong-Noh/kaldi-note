"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  NumberCell,
  Segmented,
  TasteDots,
  useNumberText,
} from "@/components/kit";
import { SELECT_EXTRA } from "@/components/ui/Field";
import { useBeanProducts, useRoasters } from "@/features/catalog/api";
import type { BeanProduct } from "@/features/catalog/schema";
import { useUserGrinders } from "@/features/gear/queries";
import { fetchRecipe } from "@/features/recipe/api";
import { useMe } from "@/features/user/queries";
import type { BrewLogCreateRequest } from "@/types/generated/2026-11-14-quick-brew";
import type { QuickBrewPrefill } from "@/lib/quickBrew";
import { createBrewLog, fetchBrewLogPage } from "../api";
import { MIN_SEC_MESSAGE, parseMinSec, previewYield } from "../formState";
import type { BrewLog, BrewLogSummary } from "../schema";
import { RecipeLinkSheet } from "./RecipeLinkSheet";

/**
 * 빠른 기록 시트 — docs/specs/2026-11-14-quick-brew.md Task 7~9, 시안 `10 Brew First` B.
 *
 * <p>① 지난번과 같은가요 / 얼마나 내렸나요 → ② 맛 → ③ 완료. 필수는 원두량·물량뿐이고 나머지는 「자세히」에 접는다.
 * 「지난번」은 내 기록 목록의 첫 항목이다(AC-QUICKBREW-07) — 같은 요청(20건)에서 최근 원두도 뽑는다.
 */

export type QuickBrewStart = "record" | "same";

type Step = "confirm" | "amount" | "bean" | "taste" | "done";
type Visibility = BrewLog["visibility"];

/** 이 시간 안에 저장이 끝나면 「저장하는 중…」을 그리지 않는다(시안 B11, AC-QUICKBREW-66). */
export const SAVING_LABEL_DELAY_MS = 400;
const RECENT_LOGS = 20;

const VISIBILITY_OPTIONS = [
  { value: "PRIVATE", label: "나만" },
  { value: "FRIENDS", label: "맞팔로우" },
  { value: "PUBLIC", label: "전체" },
] as const satisfies readonly { value: Visibility; label: string }[];

const TASTE_AXES = [
  { key: "acidity", label: "산미" },
  { key: "sweetness", label: "단맛" },
  { key: "body", label: "바디" },
  { key: "bitterness", label: "쓴맛" },
  { key: "aftertaste", label: "여운" },
] as const;

type DetailErrorKey =
  "totalTimeText" | "drawdownText" | "tdsPercent" | "beverageWeightG";
type DetailErrors = Partial<Record<DetailErrorKey, string>>;

interface Draft {
  beanProductId: number | null;
  beanName: string | null;
  doseG: number | null;
  waterG: number | null;
  waterTempC: number | null;
  totalTimeText: string;
  drawdownText: string;
  userGrinderId: number | null;
  grindValue: number | null;
  acidity: number | null;
  sweetness: number | null;
  body: number | null;
  bitterness: number | null;
  aftertaste: number | null;
  tdsPercent: number | null;
  beverageWeightG: number | null;
  roastedAt: string;
  visibility: Visibility;
  recipeId: number | null;
  rating: number | null;
  note: string;
}

/** 미리 채우는 값 — 원두·양·장비·온도·공개 범위·레시피. 별점·메모·측정값은 매번 새로 쓴다(AC-QUICKBREW-24·74·78). */
function draftFrom(
  last: BrewLogSummary | undefined,
  prefill?: QuickBrewPrefill,
): Draft {
  const emptyMeasurements = {
    totalTimeText: "",
    drawdownText: "",
    acidity: null,
    sweetness: null,
    body: null,
    bitterness: null,
    aftertaste: null,
    tdsPercent: null,
    beverageWeightG: null,
    roastedAt: "",
    rating: null,
    note: "",
  };
  if (prefill) {
    return {
      ...emptyMeasurements,
      beanProductId: prefill.beanProductId ?? null,
      beanName: prefill.beanName ?? null,
      doseG: prefill.doseG ?? null,
      waterG: prefill.waterG ?? null,
      waterTempC: prefill.waterTempC ?? null,
      userGrinderId: prefill.userGrinderId ?? null,
      grindValue: prefill.grindValue ?? null,
      visibility: prefill.visibility ?? "PRIVATE",
      recipeId: null,
    };
  }
  return {
    ...emptyMeasurements,
    beanProductId: last?.beanProductId ?? null,
    beanName: last?.beanName ?? null,
    doseG: last?.actualDoseG ?? null,
    waterG: last?.actualWaterG ?? null,
    waterTempC: last?.actualWaterTempC ?? null,
    userGrinderId: last?.userGrinderId ?? null,
    grindValue: last?.actualGrindSettingValue ?? null,
    visibility: last?.visibility ?? "PRIVATE",
    recipeId: last?.recipeId ?? null,
  };
}

/** 총 시간(1초 이상)·드로다운(0초 이상)·TDS [0.01, 99.99]·음료 중량 [0.1, 9999.9]을 검사한다(AC-QUICKBREW-79·80). */
function validateDetails(d: Draft): DetailErrors {
  const errors: DetailErrors = {};
  const total = parseMinSec(d.totalTimeText);
  if (total === "invalid" || total === 0) {
    errors.totalTimeText = MIN_SEC_MESSAGE;
  }
  if (parseMinSec(d.drawdownText) === "invalid") {
    errors.drawdownText = MIN_SEC_MESSAGE;
  }
  if (d.tdsPercent !== null) {
    if (d.tdsPercent < 0.01) errors.tdsPercent = "0.01 이상이어야 합니다";
    else if (d.tdsPercent > 99.99) errors.tdsPercent = "99.99 이하여야 합니다";
  }
  if (d.beverageWeightG !== null) {
    if (d.beverageWeightG < 0.1)
      errors.beverageWeightG = "0.1 이상이어야 합니다";
    else if (d.beverageWeightG > 9999.9)
      errors.beverageWeightG = "9999.9 이하여야 합니다";
  }
  return errors;
}

/** 값이 있는 키만 싣는다 — 백엔드 `non_null` 응답과 대칭(formState.omitEmpty와 같은 규칙). */
function toBody(d: Draft): BrewLogCreateRequest {
  const totalTime = parseMinSec(d.totalTimeText);
  const drawdown = parseMinSec(d.drawdownText);
  const entries: [string, unknown][] = [
    ["recipeId", d.recipeId],
    ["actualDoseG", d.doseG],
    ["actualWaterG", d.waterG],
    ["beanProductId", d.beanProductId],
    ["beanName", d.beanName],
    ["roastedAt", d.roastedAt || null],
    ["actualWaterTempC", d.waterTempC],
    [
      "actualTotalTimeSeconds",
      typeof totalTime === "number" && totalTime > 0 ? totalTime : null,
    ],
    ["actualDrawdownSeconds", typeof drawdown === "number" ? drawdown : null],
    ["userGrinderId", d.userGrinderId],
    ["actualGrindSettingValue", d.userGrinderId === null ? null : d.grindValue],
    ["beverageWeightG", d.beverageWeightG],
    ["tdsPercent", d.tdsPercent],
    ["visibility", d.visibility],
    ["rating", d.rating],
    ["acidity", d.acidity],
    ["sweetness", d.sweetness],
    ["body", d.body],
    ["bitterness", d.bitterness],
    ["aftertaste", d.aftertaste],
    ["overallNote", d.note.trim() || null],
  ];
  return Object.fromEntries(
    entries.filter(([, v]) => v !== null),
  ) as unknown as BrewLogCreateRequest;
}

function ratioText(doseG: number | null, waterG: number | null): string {
  if (!doseG || !waterG) return "1:—";
  return `1:${(waterG / doseG).toFixed(1)}`;
}

/** 최근 고른 원두 — 내 기록에서 카탈로그 상품·직접 입력 이름을 중복 없이, 최근 순(AC-QUICKBREW-26). */
type BeanChoice =
  { kind: "product"; id: number } | { kind: "name"; name: string };
function recentBeans(logs: BrewLogSummary[]): BeanChoice[] {
  const seen = new Set<string>();
  const out: BeanChoice[] = [];
  for (const log of logs) {
    const choice: BeanChoice | null =
      log.beanProductId !== undefined
        ? { kind: "product", id: log.beanProductId }
        : log.beanName !== undefined
          ? { kind: "name", name: log.beanName }
          : null;
    if (!choice) continue;
    const key = choice.kind === "product" ? `p${choice.id}` : `n${choice.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(choice);
  }
  return out;
}

/** 높이의 이 비율보다 더 아래로 끌어 놓으면 시트를 닫는다(AC-QUICKBREW-68). */
const DRAG_DISMISS_RATIO = 0.3;

export function QuickBrewSheet({
  start,
  prefill,
  open = true,
  onClose,
  onExitComplete,
}: {
  start: QuickBrewStart;
  prefill?: QuickBrewPrefill;
  open?: boolean;
  onClose: () => void;
  onExitComplete?: () => void;
}) {
  const me = useMe();
  const logs = useQuery({
    queryKey: ["brew-logs", "quick", me.data?.id],
    enabled: me.data !== undefined,
    queryFn: () =>
      fetchBrewLogPage(0, RECENT_LOGS, undefined, { userId: me.data?.id }),
  });

  useEffect(() => {
    if (!open && !logs.data && !prefill) onExitComplete?.();
  }, [open, logs.data, prefill, onExitComplete]);

  if (!prefill && !logs.data) return null;
  return (
    <Sheet
      start={start}
      prefill={prefill}
      open={open}
      onClose={onClose}
      onExitComplete={onExitComplete}
      logs={logs.data?.content ?? []}
    />
  );
}

function Sheet({
  start,
  prefill,
  open,
  onClose,
  onExitComplete,
  logs,
}: {
  start: QuickBrewStart;
  prefill?: QuickBrewPrefill;
  open: boolean;
  onClose: () => void;
  onExitComplete?: () => void;
  logs: BrewLogSummary[];
}) {
  const last = logs[0];
  const [initial] = useState(() => draftFrom(last, prefill));
  const [draft, setDraft] = useState(initial);
  const [detailErrors, setDetailErrors] = useState<DetailErrors>({});
  const [details, setDetails] = useState(false);
  const [pickedRecipe, setPickedRecipe] = useState<{
    id: number;
    title: string;
  } | null>(null);
  const [pickingRecipe, setPickingRecipe] = useState(false);
  const patch = (p: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...p }));
    setDetailErrors((prev) => {
      if (Object.keys(prev).length === 0) return prev;
      let changed = false;
      const next = { ...prev };
      for (const key of [
        "totalTimeText",
        "drawdownText",
        "tdsPercent",
        "beverageWeightG",
      ] as const) {
        if (key in p && next[key]) {
          delete next[key];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  };
  const [step, setStep] = useState<Step>(
    prefill || !last ? "amount" : start === "same" ? "taste" : "confirm",
  );
  const [changing, setChanging] = useState(false);
  const [confirmingClose, setConfirmingClose] = useState(false);

  const inheritedRecipeId = prefill ? null : (last?.recipeId ?? null);
  const inheritedRecipe = useQuery({
    queryKey: ["recipe", inheritedRecipeId],
    queryFn: () => fetchRecipe(inheritedRecipeId as number),
    enabled: inheritedRecipeId !== null,
    retry: false,
    staleTime: 30_000,
  });

  // 403/404로 못 보는 지난번 레시피는 UI·저장에서 비우되 dirty 판정은 건드리지 않는다(AC-QUICKBREW-74·44).
  const inheritedUnavailable =
    draft.recipeId !== null &&
    draft.recipeId === inheritedRecipeId &&
    inheritedRecipe.isError;
  const effectiveRecipeId = inheritedUnavailable ? null : draft.recipeId;
  const linkedRecipeTitle =
    effectiveRecipeId === null
      ? null
      : pickedRecipe?.id === effectiveRecipeId
        ? pickedRecipe.title
        : effectiveRecipeId === inheritedRecipeId
          ? (inheritedRecipe.data?.title ?? null)
          : null;

  const products = useBeanProducts();
  const roasters = useRoasters();
  const productName = (id: number) =>
    products.data?.find((p) => p.id === id)?.name ?? "원두";
  const beanLabel =
    draft.beanProductId !== null
      ? productName(draft.beanProductId)
      : draft.beanName;

  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: (body: BrewLogCreateRequest) => createBrewLog(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["brew-logs"] });
      void queryClient.invalidateQueries({ queryKey: ["calendar"] });
      setStep("done");
    },
  });
  const lastBody = useRef<BrewLogCreateRequest | null>(null);
  const submittingRef = useRef(false);
  const saveDraft = async (overrideRating?: number | null) => {
    if (save.isPending || submittingRef.current) return;
    const targetDraft: Draft = {
      ...draft,
      recipeId: effectiveRecipeId,
      ...(overrideRating !== undefined ? { rating: overrideRating } : {}),
    };
    const errors = validateDetails(targetDraft);
    if (Object.keys(errors).length > 0) {
      setDetailErrors(errors);
      setDetails(true);
      return;
    }
    submittingRef.current = true;
    try {
      let resolvedRecipeId = targetDraft.recipeId;
      if (
        resolvedRecipeId !== null &&
        resolvedRecipeId === inheritedRecipeId &&
        pickedRecipe?.id !== resolvedRecipeId
      ) {
        try {
          await queryClient.fetchQuery({
            queryKey: ["recipe", resolvedRecipeId],
            queryFn: () => fetchRecipe(resolvedRecipeId as number),
            retry: false,
            staleTime: 30_000,
          });
        } catch {
          resolvedRecipeId = null;
        }
      }
      lastBody.current =
        lastBody.current ??
        toBody({ ...targetDraft, recipeId: resolvedRecipeId });
      save.mutate(lastBody.current);
    } finally {
      submittingRef.current = false;
    }
  };
  const submit = () => {
    void saveDraft();
  };
  const showSaving = useDelayedFlag(save.isPending, SAVING_LABEL_DELAY_MS);

  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const close = () => {
    if (step !== "done" && dirty) setConfirmingClose(true);
    else onClose();
  };

  const sheetRef = useRef<HTMLElement>(null);
  const amountPrimaryRef = useRef<(() => void) | null>(null);
  const registerAmountPrimary = useCallback((fn: (() => void) | null) => {
    amountPrimaryRef.current = fn;
  }, []);

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

  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [hasDragged, setHasDragged] = useState(false);
  const [dragDismissed, setDragDismissed] = useState(false);
  const dragSessionRef = useRef<{ startY: number; pointerId: number } | null>(
    null,
  );
  const dragCallbacksRef = useRef({ dirty, step, onClose });
  useEffect(() => {
    dragCallbacksRef.current = { dirty, step, onClose };
  });

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => {
      const session = dragSessionRef.current;
      if (
        !session ||
        (session.pointerId !== 0 &&
          e.pointerId !== 0 &&
          e.pointerId !== session.pointerId)
      ) {
        return;
      }
      setDragY(Math.max(0, e.clientY - session.startY));
    };
    const onEnd = (e: PointerEvent) => {
      const session = dragSessionRef.current;
      if (
        !session ||
        (session.pointerId !== 0 &&
          e.pointerId !== 0 &&
          e.pointerId !== session.pointerId)
      ) {
        return;
      }
      const dy = Math.max(0, e.clientY - session.startY);
      dragSessionRef.current = null;
      setDragging(false);

      const height = sheetRef.current?.getBoundingClientRect().height ?? 0;
      if (height > 0 && dy > height * DRAG_DISMISS_RATIO) {
        const {
          dirty: isDirty,
          step: currentStep,
          onClose: closeNow,
        } = dragCallbacksRef.current;
        if (currentStep !== "done" && isDirty) {
          setDragY(0);
          setConfirmingClose(true);
        } else {
          setDragDismissed(true);
          closeNow();
        }
        return;
      }
      setDragY(0);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
    };
  }, [dragging]);

  const startDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!open || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      // jsdom 등 합성 이벤트에는 포인터 캡처가 없을 수 있다
    }
    dragSessionRef.current = { startY: e.clientY, pointerId: e.pointerId };
    setHasDragged(true);
    setDragging(true);
    setDragY(0);
  };

  const keyHandlerRef = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    keyHandlerRef.current = (e: KeyboardEvent) => {
      if (!open || e.defaultPrevented || e.isComposing || e.keyCode === 229) {
        return;
      }
      if (pickingRecipe) return;
      if (e.key === "Escape") {
        e.preventDefault();
        if (confirmingClose) {
          setConfirmingClose(false);
          return;
        }
        close();
        return;
      }
      if (e.key === "Enter") {
        if (e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
        const target = e.target as HTMLElement | null;
        if (
          target?.closest(
            'button:not([role="radio"]), a[href], select, textarea, [contenteditable="true"]',
          )
        ) {
          return;
        }
        const primary: (() => void) | null = confirmingClose
          ? () => setConfirmingClose(false)
          : step === "confirm"
            ? () => setStep("taste")
            : step === "amount"
              ? amountPrimaryRef.current
              : step === "taste"
                ? submit
                : step === "done"
                  ? onClose
                  : null;
        if (!primary) return;
        e.preventDefault();
        primary();
      }
    };
  });

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => keyHandlerRef.current(e);
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const progress =
    step === "taste" ? "2 / 3" : step === "done" ? null : "1 / 3";
  const back =
    step === "bean"
      ? () => setStep("amount")
      : step === "amount" && changing
        ? () => {
            setChanging(false);
            setStep("confirm");
          }
        : null;

  const motionClass = !open
    ? dragDismissed
      ? "pointer-events-none transition-transform duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
      : "pointer-events-none animate-[sheet-slide-out_200ms_cubic-bezier(0.2,0.8,0.2,1)_forwards] min-[760px]:animate-[panel-slide-out_200ms_cubic-bezier(0.2,0.8,0.2,1)_forwards]"
    : dragging
      ? ""
      : hasDragged
        ? "transition-transform duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
        : "animate-[sheet-slide-in_240ms_cubic-bezier(0.2,0.8,0.2,1)] min-[760px]:animate-[panel-slide-in_240ms_cubic-bezier(0.2,0.8,0.2,1)]";

  const dragStyle = dragging
    ? { transform: `translateY(${dragY}px)` }
    : !open && dragDismissed
      ? { transform: "translateY(100%)" }
      : hasDragged
        ? { transform: "translateY(0px)" }
        : undefined;

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end min-[760px]:flex-row min-[760px]:justify-end">
      <div
        aria-hidden="true"
        onClick={open ? close : undefined}
        className={`absolute inset-0 bg-scrim ${open ? "kn-scrim-in" : "kn-scrim-out pointer-events-none"}`}
      />
      <section
        ref={sheetRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="빠른 기록"
        data-state={open ? "open" : "closed"}
        onAnimationEnd={(e) => {
          if (!open && !dragDismissed && e.target === e.currentTarget) {
            onExitComplete?.();
          }
        }}
        onTransitionEnd={(e) => {
          if (!open && dragDismissed && e.target === e.currentTarget) {
            onExitComplete?.();
          }
        }}
        style={dragStyle}
        className={`relative flex max-h-[92dvh] w-full flex-col gap-[18px] overflow-y-auto rounded-t-[18px] border-t border-border bg-paper px-[24px] pt-[10px] pb-[20px] outline-none min-[760px]:h-full min-[760px]:max-h-none min-[760px]:w-[min(100vw,520px)] min-[760px]:rounded-none min-[760px]:border-t-0 min-[760px]:border-l min-[760px]:px-[28px] min-[760px]:py-[22px] min-[1024px]:w-[400px] min-[1280px]:w-[440px] motion-reduce:animate-none motion-reduce:transition-none ${motionClass}`}
      >
        <div
          data-sheet-handle
          aria-hidden="true"
          onPointerDown={startDrag}
          className="mx-auto -mt-[2px] -mb-[10px] flex h-[28px] w-[120px] shrink-0 cursor-grab items-center justify-center touch-none select-none active:cursor-grabbing min-[760px]:hidden"
        >
          <span className="h-[4px] w-[36px] rounded-full bg-border" />
        </div>
        <div className="flex items-center justify-between text-[13px] text-ink-3">
          {back ? (
            <button type="button" onClick={back} className="hit-44">
              ‹ 이전
            </button>
          ) : (
            <span>{progress}</span>
          )}
          <button type="button" onClick={close} className="hit-44">
            닫기
          </button>
        </div>

        {step === "confirm" && last && (
          <ConfirmStep
            last={last}
            beanLabel={beanLabel}
            onChange={() => {
              setChanging(true);
              setStep("amount");
            }}
            onSame={() => setStep("taste")}
          />
        )}
        {step === "amount" && (
          <AmountStep
            title={changing ? "무엇이 달라졌나요?" : "얼마나 내렸나요?"}
            draft={draft}
            beanLabel={beanLabel}
            patch={patch}
            registerPrimary={registerAmountPrimary}
            onPickBean={() => setStep("bean")}
            onNext={() => setStep("taste")}
          />
        )}
        {step === "bean" && (
          <BeanStep
            recent={recentBeans(logs)}
            products={products.data ?? []}
            roasterName={(id) =>
              roasters.data?.find((r) => r.id === id)?.name ?? ""
            }
            productName={productName}
            onPick={(choice) => {
              patch(
                choice.kind === "product"
                  ? { beanProductId: choice.id, beanName: null }
                  : { beanProductId: null, beanName: choice.name },
              );
              setStep("amount");
            }}
          />
        )}
        {step === "taste" && (
          <TasteStep
            draft={draft}
            details={details}
            onToggleDetails={() => setDetails((d) => !d)}
            errors={detailErrors}
            linkedRecipeTitle={linkedRecipeTitle}
            onPickRecipe={() => setPickingRecipe(true)}
            patch={(p) => {
              lastBody.current = null;
              patch(p);
            }}
            saving={showSaving}
            failed={save.isError}
            onSave={submit}
            onSkip={() => {
              patch({ rating: null });
              void saveDraft(null);
            }}
          />
        )}
        {step === "done" && <DoneStep draft={draft} onConfirm={onClose} />}

        {pickingRecipe && (
          <RecipeLinkSheet
            selectedId={effectiveRecipeId}
            onSelect={(recipe) => {
              lastBody.current = null;
              setPickedRecipe(
                recipe ? { id: recipe.id, title: recipe.title } : null,
              );
              patch({ recipeId: recipe ? recipe.id : null });
              setPickingRecipe(false);
            }}
            onBack={() => setPickingRecipe(false)}
            onClose={() => {
              setPickingRecipe(false);
              close();
            }}
          />
        )}

        {confirmingClose && (
          <div
            role="alertdialog"
            aria-label="기록을 그만둘까요?"
            className="rounded-[12px] border border-border bg-paper p-[16px]"
          >
            <p className="text-[15px] font-semibold text-ink">
              기록을 그만둘까요?
            </p>
            <p className="mt-[4px] text-[13px] text-ink-3">
              그만두면 저장되지 않아요.
            </p>
            <div className="mt-[12px] flex gap-[8px]">
              <button
                type="button"
                onClick={onClose}
                className="kn-press hit-44 flex-1 rounded-[8px] border border-border p-[12px] text-[14px]"
              >
                그만두기
              </button>
              <button
                type="button"
                onClick={() => setConfirmingClose(false)}
                className="kn-press hit-44 flex-1 rounded-[8px] bg-ink p-[12px] text-[14px] text-on-ink"
              >
                계속 쓰기
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

/** 참이 된 지 `ms`가 지나야 참이 된다. 짧은 대기에 깜빡이는 문구를 막는다. */
function useDelayedFlag(on: boolean, ms: number): boolean {
  const [late, setLate] = useState(false);
  useEffect(() => {
    if (!on) return;
    const timer = setTimeout(() => setLate(true), ms);
    return () => {
      clearTimeout(timer);
      setLate(false);
    };
  }, [on, ms]);
  return on && late;
}

function Heading({ children }: { children: string }) {
  return (
    <h2 className="kn-step-forward text-[21px] font-semibold tracking-[-0.02em] text-ink">
      {children}
    </h2>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled = false,
}: {
  children: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-disabled={disabled}
      onClick={onClick}
      className="kn-press block w-full rounded-[8px] bg-ink p-[15px] text-center text-[15px] font-medium text-on-ink aria-disabled:opacity-60"
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  onClick,
}: {
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="kn-press block w-full rounded-[8px] border border-border p-[15px] text-center text-[15px] text-ink"
    >
      {children}
    </button>
  );
}

function ConfirmStep({
  last,
  beanLabel,
  onChange,
  onSame,
}: {
  last: BrewLogSummary;
  beanLabel: string | null;
  onChange: () => void;
  onSame: () => void;
}) {
  return (
    <>
      <Heading>지난번과 같은가요?</Heading>
      <div className="rounded-[12px] border border-border p-[16px]">
        {beanLabel && (
          <p className="text-[15px] font-medium text-ink">{beanLabel}</p>
        )}
        <p className="mt-[6px] font-mono text-[20px] text-ink tabular-nums">
          {last.actualDoseG} g → {last.actualWaterG} g{" "}
          <span className="text-[14px] text-ink-3">
            {ratioText(last.actualDoseG, last.actualWaterG)}
          </span>
        </p>
        {last.actualGrindSettingValue !== undefined && (
          <p className="mt-[4px] text-[13px] text-ink-3">
            분쇄도 {last.actualGrindSettingValue}
          </p>
        )}
        {last.actualWaterTempC !== undefined && (
          <p className="text-[13px] text-ink-3">
            물 온도 {last.actualWaterTempC}°C
          </p>
        )}
      </div>
      <div className="flex gap-[8px]">
        <SecondaryButton onClick={onChange}>바꿀래요</SecondaryButton>
        <PrimaryButton onClick={onSame}>네, 같아요</PrimaryButton>
      </div>
    </>
  );
}

function AmountStep({
  title,
  draft,
  beanLabel,
  patch,
  registerPrimary,
  onPickBean,
  onNext,
}: {
  title: string;
  draft: Draft;
  beanLabel: string | null;
  patch: (p: Partial<Draft>) => void;
  registerPrimary: (fn: (() => void) | null) => void;
  onPickBean: () => void;
  onNext: () => void;
}) {
  const dose = useNumberText(draft.doseG, (doseG) => patch({ doseG }));
  const water = useNumberText(draft.waterG, (waterG) => patch({ waterG }));
  const doseRef = useRef<HTMLInputElement>(null);
  const waterRef = useRef<HTMLInputElement>(null);
  const [missing, setMissing] = useState<"dose" | "water" | null>(null);
  const ready = !!draft.doseG && !!draft.waterG;
  const bothEmpty = draft.doseG === null && draft.waterG === null;

  const next = () => {
    if (ready) {
      onNext();
      return;
    }
    const empty = !draft.doseG ? "dose" : "water";
    setMissing(empty);
    (empty === "dose" ? doseRef : waterRef).current?.focus();
  };

  useEffect(() => {
    registerPrimary(next);
    return () => registerPrimary(null);
  });

  return (
    <>
      <Heading>{title}</Heading>
      <p className="text-[13px] text-ink-3">
        원두량과 물량만 있으면 기록할 수 있어요.
      </p>
      <div className="flex items-center justify-between gap-[8px] text-[14px]">
        <span className={beanLabel ? "text-ink" : "text-ink-3"}>
          {beanLabel ?? "원두 (선택)"}
        </span>
        <button
          type="button"
          aria-label="원두 고르기"
          onClick={onPickBean}
          className="hit-44 text-ink-2 underline"
        >
          {beanLabel ? "바꾸기" : "고르기"}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-[8px]">
        <NumberCell
          label="원두량"
          accessibleName="원두량"
          unit="g"
          ref={doseRef}
          {...dose}
          aria-invalid={missing === "dose"}
        />
        <NumberCell
          label="물량"
          accessibleName="물량"
          unit="g"
          ref={waterRef}
          {...water}
          aria-invalid={missing === "water"}
        />
      </div>
      {missing && (
        <p className="text-[13px] text-accent">
          {missing === "dose" ? "원두량을 적어 주세요" : "물량을 적어 주세요"}
        </p>
      )}
      <p className="font-mono text-[14px] text-ink-3 tabular-nums">
        {bothEmpty
          ? "비율은 두 칸을 채우면 나와요"
          : ratioText(draft.doseG, draft.waterG)}
      </p>
      <PrimaryButton disabled={!ready} onClick={next}>
        다음
      </PrimaryButton>
    </>
  );
}

function BeanStep({
  recent,
  products,
  roasterName,
  productName,
  onPick,
}: {
  recent: BeanChoice[];
  products: BeanProduct[];
  roasterName: (id: number) => string;
  productName: (id: number) => string;
  onPick: (choice: BeanChoice) => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim();
  // ponytail: 카탈로그 전체를 프론트에서 거른다. 1,000건을 넘으면 서버 검색(스펙 「열어둔 결정」).
  const matches = q
    ? products.filter(
        (p) => p.name.includes(q) || roasterName(p.roasterId).includes(q),
      )
    : [];
  const row =
    "kn-press hit-44 block w-full py-[12px] text-left text-[15px] text-ink";

  return (
    <>
      <Heading>어떤 원두인가요?</Heading>
      <input
        aria-label="원두 검색"
        placeholder="원두 이름이나 로스터로 찾기"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="rounded-[8px] border border-border bg-paper px-[14px] py-[12px] text-[15px] text-ink"
      />
      {!q && (
        <ul aria-label="최근 고른 원두" className="divide-y divide-border">
          {recent.map((choice) => (
            <li
              key={
                choice.kind === "product" ? `p${choice.id}` : `n${choice.name}`
              }
            >
              <button
                type="button"
                className={row}
                onClick={() => onPick(choice)}
              >
                {choice.kind === "product"
                  ? productName(choice.id)
                  : choice.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {q && matches.length > 0 && (
        <ul aria-label="카탈로그" className="divide-y divide-border">
          {matches.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className={row}
                onClick={() => onPick({ kind: "product", id: p.id })}
              >
                {p.name}
                <span className="block text-[12px] text-ink-3">
                  {roasterName(p.roasterId)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {q && matches.length === 0 && (
        <p className="text-[14px] text-ink-2">「{q}」를 찾지 못했어요</p>
      )}
      {q && (
        <SecondaryButton onClick={() => onPick({ kind: "name", name: q })}>
          {`「${q}」로 기록`}
        </SecondaryButton>
      )}
    </>
  );
}

function Stars({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (rating: number) => void;
}) {
  // 별 하나 = 44×44 버튼 하나(누르는 영역 잠금). 왼쪽 절반을 누르면 0.5(DECISIONS 6절 #9). 키보드는 정수.
  const pick = (star: number) => (e: MouseEvent<HTMLButtonElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const leftHalf = e.detail > 0 && e.clientX - box.left < box.width / 2;
    onChange(leftHalf ? star - 0.5 : star);
  };
  return (
    <div className="flex items-center gap-[4px]">
      <div role="radiogroup" aria-label="별점" className="flex">
        {[1, 2, 3, 4, 5].map((star) => {
          const filled =
            value !== null && value >= star
              ? 1
              : value !== null && value >= star - 0.5
                ? 0.5
                : 0;
          return (
            <button
              key={star}
              type="button"
              role="radio"
              aria-label={`별 ${star}`}
              aria-checked={value !== null && Math.ceil(value) === star}
              onClick={pick(star)}
              className="kn-press relative h-[44px] w-[44px] text-[28px] leading-none text-ink-disabled"
            >
              ★
              {filled > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute inset-0 flex items-center justify-center overflow-hidden text-ink"
                  style={{
                    clipPath: filled === 0.5 ? "inset(0 50% 0 0)" : undefined,
                  }}
                >
                  ★
                </span>
              )}
            </button>
          );
        })}
      </div>
      {value !== null && (
        <span className="font-mono text-[15px] text-ink tabular-nums">
          {value.toFixed(1)}
        </span>
      )}
    </div>
  );
}

/** `NumberCell`의 오류 id·ARIA·안내 줄 한 쌍을 묶는다. */
function fieldErrorProps(id: string, message?: string) {
  return {
    "aria-invalid": message ? (true as const) : undefined,
    "aria-describedby": message ? id : undefined,
  };
}

function DetailField({
  errorId,
  error,
  children,
}: {
  errorId: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-[4px]">
      {children}
      {error && (
        <span id={errorId} role="alert" className="text-[12.5px] text-danger">
          {error}
        </span>
      )}
    </div>
  );
}

function TasteStep({
  draft,
  details,
  onToggleDetails,
  errors,
  linkedRecipeTitle,
  onPickRecipe,
  patch,
  saving,
  failed,
  onSave,
  onSkip,
}: {
  draft: Draft;
  details: boolean;
  onToggleDetails: () => void;
  errors: DetailErrors;
  linkedRecipeTitle: string | null;
  onPickRecipe: () => void;
  patch: (p: Partial<Draft>) => void;
  saving: boolean;
  failed: boolean;
  onSave: () => void;
  onSkip: () => void;
}) {
  const temp = useNumberText(draft.waterTempC, (waterTempC) =>
    patch({ waterTempC }),
  );
  const grind = useNumberText(draft.grindValue, (grindValue) =>
    patch({ grindValue }),
  );
  const tds = useNumberText(draft.tdsPercent, (tdsPercent) =>
    patch({ tdsPercent }),
  );
  const beverageWeight = useNumberText(
    draft.beverageWeightG,
    (beverageWeightG) => patch({ beverageWeightG }),
  );
  const grinders = useUserGrinders();
  const yieldPercent = previewYield(
    draft.doseG,
    draft.beverageWeightG,
    draft.tdsPercent,
  );

  return (
    <>
      <Heading>맛은 어땠나요?</Heading>
      <p className="text-[13px] text-ink-3">건너뛰어도 기록은 남아요.</p>
      <Stars value={draft.rating} onChange={(rating) => patch({ rating })} />
      <label className="flex flex-col gap-[6px] text-[13px] text-ink-3">
        한 줄 메모 (선택)
        <input
          aria-label="한 줄 메모 (선택)"
          maxLength={1000}
          value={draft.note}
          onChange={(e) => patch({ note: e.target.value })}
          className="rounded-[8px] border border-border bg-paper px-[14px] py-[12px] text-[15px] text-ink"
        />
      </label>
      <button
        type="button"
        aria-expanded={details}
        onClick={onToggleDetails}
        className="hit-44 text-left text-[14px] text-ink-2"
      >
        {details ? "▾ 자세히" : "▸ 자세히"}
      </button>
      {details && (
        <div className="flex flex-col gap-[10px]">
          <NumberCell
            label="물 온도"
            accessibleName="물 온도"
            unit="°C"
            {...temp}
          />
          <DetailField errorId="qb-err-total-time" error={errors.totalTimeText}>
            <NumberCell
              label="총 시간"
              accessibleName="총 시간"
              unit="m:ss"
              placeholder="0:00"
              inputMode={undefined}
              value={draft.totalTimeText}
              onChange={(e) => patch({ totalTimeText: e.target.value.trim() })}
              {...fieldErrorProps("qb-err-total-time", errors.totalTimeText)}
            />
          </DetailField>
          <DetailField errorId="qb-err-drawdown" error={errors.drawdownText}>
            <NumberCell
              label="드로다운"
              accessibleName="드로다운"
              unit="m:ss"
              placeholder="0:00"
              inputMode={undefined}
              value={draft.drawdownText}
              onChange={(e) => patch({ drawdownText: e.target.value.trim() })}
              {...fieldErrorProps("qb-err-drawdown", errors.drawdownText)}
            />
          </DetailField>
          <label className="flex min-h-[44px] items-center justify-between gap-[8px] text-[13.5px] text-ink-3">
            그라인더
            <select
              aria-label="그라인더"
              value={draft.userGrinderId ?? ""}
              onChange={(e) =>
                patch({
                  userGrinderId:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
              className={`${SELECT_EXTRA} hit-44 min-h-[44px] bg-transparent text-[14px] text-ink`}
            >
              <option value="">선택 안 함</option>
              {(grinders.data ?? []).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nickname ?? `${g.brand} ${g.grinderModelName}`}
                </option>
              ))}
            </select>
          </label>
          {draft.userGrinderId !== null && (
            <NumberCell
              label="분쇄도"
              accessibleName="분쇄도"
              unit="클릭"
              {...grind}
            />
          )}
          <div className="flex flex-col gap-[6px]">
            <span className="font-mono text-[10px] font-medium tracking-[0.12em] text-ink-3 uppercase">
              맛 5축
            </span>
            {TASTE_AXES.map(({ key, label }) => (
              <TasteDots
                key={key}
                label={label}
                value={draft[key]}
                onChange={(value) => patch({ [key]: value })}
              />
            ))}
          </div>
          <DetailField errorId="qb-err-tds" error={errors.tdsPercent}>
            <NumberCell
              label="TDS (선택)"
              accessibleName="TDS"
              unit="%"
              {...tds}
              {...fieldErrorProps("qb-err-tds", errors.tdsPercent)}
            />
          </DetailField>
          <DetailField errorId="qb-err-beverage" error={errors.beverageWeightG}>
            <NumberCell
              label="음료 중량 (선택)"
              accessibleName="음료 중량"
              unit="g"
              {...beverageWeight}
              {...fieldErrorProps("qb-err-beverage", errors.beverageWeightG)}
            />
          </DetailField>
          <div className="flex flex-col gap-[4px]">
            <div className="flex items-center justify-between text-[13.5px] text-ink-3">
              <span>수율</span>{" "}
              <span className="font-mono text-[14px] text-ink tabular-nums">
                {yieldPercent !== null ? `${yieldPercent} %` : "—"}
              </span>
            </div>
            {draft.tdsPercent === null && (
              <p className="text-[12px] text-ink-3">
                TDS가 없으면 수율을 계산할 수 없습니다.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-[6px]">
            <span className="text-[12.5px] font-medium text-ink-2">
              공개 범위
            </span>
            <Segmented
              label="공개 범위"
              options={VISIBILITY_OPTIONS}
              value={draft.visibility}
              onChange={(visibility) => patch({ visibility })}
            />
          </div>
          <NumberCell
            label="로스팅 날짜 (선택)"
            accessibleName="로스팅 날짜"
            type="date"
            inputMode={undefined}
            value={draft.roastedAt}
            onChange={(e) => patch({ roastedAt: e.target.value })}
          />
          <div className="flex flex-col gap-[6px]">
            <span className="text-[12.5px] font-medium text-ink-2">
              레시피 연결 (선택)
            </span>
            <button
              type="button"
              aria-label={`레시피 연결 ${linkedRecipeTitle ?? "연결 안 함"} 고르기`}
              onClick={onPickRecipe}
              className="kn-press hit-44 flex min-h-[44px] w-full items-center justify-between gap-[8px] rounded-[7px] border border-border bg-paper px-[14px] py-[12px] text-left text-[14.5px]"
            >
              <span className={linkedRecipeTitle ? "text-ink" : "text-ink-3"}>
                {linkedRecipeTitle ?? "연결 안 함"}
              </span>
              <span className="shrink-0 text-[13px] font-medium text-accent">
                고르기
              </span>
            </button>
            <p className="text-[12px] text-ink-3">
              연결하면 상세에 레시피 / 실제 비교가 생겨요.
            </p>
          </div>
        </div>
      )}
      {failed && !saving && (
        <p role="alert" className="text-[13px] text-accent">
          저장하지 못했어요. 입력한 내용은 그대로 있어요.
        </p>
      )}
      <div className="flex gap-[8px]">
        <SecondaryButton onClick={onSkip}>건너뛰기</SecondaryButton>
        <PrimaryButton onClick={onSave}>
          {saving ? "저장하는 중…" : failed ? "다시 시도" : "저장"}
        </PrimaryButton>
      </div>
    </>
  );
}

function DoneStep({
  draft,
  onConfirm,
}: {
  draft: Draft;
  onConfirm: () => void;
}) {
  return (
    <>
      <svg
        aria-hidden="true"
        viewBox="0 0 56 56"
        className="kn-check h-[56px] w-[56px] text-ink"
      >
        <circle
          cx="28"
          cy="28"
          r="26"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="170"
        />
        <path
          d="M18 29l7 7 13-15"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeDasharray="30"
        />
      </svg>
      <Heading>기록했어요</Heading>
      <p className="font-mono text-[14px] text-ink-3 tabular-nums">
        {draft.doseG}g → {draft.waterG}g ·{" "}
        {ratioText(draft.doseG, draft.waterG)}
      </p>
      <PrimaryButton onClick={onConfirm}>확인</PrimaryButton>
    </>
  );
}
