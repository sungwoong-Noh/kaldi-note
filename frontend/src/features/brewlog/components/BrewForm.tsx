"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { BottomSheet, LedgerField, SectionLabel } from "@/components/kit";
import { TopBarActions } from "@/components/layout/TopBarActions";
import { Button } from "@/components/ui";
import type { UserGrinder } from "@/features/gear/schema";
import type { MappedFieldErrors } from "@/lib/fieldErrors";
import { focusFirstInvalidField } from "@/lib/focusFirstError";
import { formatGrams, formatTemperature } from "@/lib/format";
import { useIsWide } from "@/lib/useIsWide";
import { diffPhrases } from "../diffPhrase";
import {
  parseMinSec,
  previewYield,
  type BrewLogFormState,
  type SectionWarning,
} from "../formState";
import type { RecipeTargets } from "../useEntityLabels";
import { BrewHero } from "./BrewHero";
import {
  BrewedAtField,
  GrinderSelect,
  GrindValueInput,
  HeroNumberChip,
  MemoField,
  NumField,
  TasteAxes,
  TimeField,
  VisibilityField,
  grindBaseline,
  type BrewFormSetter,
  type FieldContext,
} from "./brewFormFields";
import { RatingInput } from "./RatingInput";

/** 작성·편집이 함께 쓰는 기록 폼 — docs/specs/2026-10-11-brew-form-fidelity.md */
interface BrewFormProps {
  mode: "create" | "edit";
  state: BrewLogFormState;
  onChange: BrewFormSetter;
  grinders: UserGrinder[];
  /** 없으면 `+ 그라인더 등록`을 그리지 않는다 — 편집 화면은 모달을 갖지 않는다 */
  onAddGrinder?: () => void;
  fieldErrors: MappedFieldErrors | null;
  /** 한 묶음(장비·결과)에 붙는 서버 문구(AC-BREWFORM-21·AC-BREWFIT-24) */
  sectionWarning?: SectionWarning | null;
  /** 필드에도 묶음에도 붙지 않는 서버 문구. 폼 맨 위에 둔다(AC-BREWFORM-22) */
  generalError?: string | null;
  /** 폼 아래에 붙는 것(편집 화면의 오류 안내) */
  footer?: ReactNode;
  recipeTitle: string;
  targets?: RecipeTargets;
  /** 고른 원두. `null`이면 고르지 않았다 */
  bean: { label: string; sub?: string } | null;
  /** 없으면 원두는 바꿀 수 없다(편집 화면) */
  onChangeBean?: () => void;
  submitLabel: string;
  submitting: boolean;
  submitDisabled?: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  /**
   * 값 중 하나가 바뀌고 그중 참인 것이 있으면 첫 오류로 포커스를 옮긴다(예: `[save.error, 막힌 횟수]`).
   * 모바일에서는 그 필드가 든 시트를 먼저 연다(AC-BREWFIT-22·23).
   */
  focusKeys?: readonly unknown[];
  children?: ReactNode;
}

type SheetId = "내린 시각" | "온도·시간" | "장비" | "결과" | "맛" | "메모";

/** 원장 행(= 모바일 시트)에 속한 필드. 오류가 난 필드의 시트를 열고 행에 `data-invalid`를 단다. */
const ROW_FIELDS: Record<SheetId, readonly string[]> = {
  "내린 시각": ["brewedAt"],
  "온도·시간": [
    "actualWaterTempC",
    "actualTotalTimeSeconds",
    "actualDrawdownSeconds",
  ],
  장비: ["userGrinderId", "actualGrindSettingValue"],
  결과: ["beverageWeightG", "tdsPercent"],
  맛: ["acidity", "sweetness", "body", "bitterness", "aftertaste"],
  메모: ["overallNote"],
};

/** 화면 순서. 여러 필드가 틀리면 이 순서로 첫 번째에 간다(AC-ERRFOCUS-01). */
const FIELD_ORDER = [
  "brewedAt",
  "actualDoseG",
  "actualWaterG",
  ...ROW_FIELDS["온도·시간"],
  ...ROW_FIELDS.장비,
  ...ROW_FIELDS.결과,
  ...ROW_FIELDS.맛,
  ...ROW_FIELDS.메모,
];

function sheetOf(field: string): SheetId | undefined {
  return (Object.keys(ROW_FIELDS) as SheetId[]).find((id) =>
    ROW_FIELDS[id].includes(field),
  );
}

export function BrewForm(props: BrewFormProps) {
  const wide = useIsWide();
  const [sheet, setSheet] = useState<SheetId | null>(null);
  const closeSheet = useCallback(() => setSheet(null), []);

  // 오류가 새로 생기면(값 중 하나가 바뀌고 그중 참인 것이 있으면) 포커스를 요청한다. 렌더 중에 상태를
  // 맞추는 패턴이다 — 모바일은 그 필드가 든 시트를 함께 연다(시트가 열리며 안의 첫 오류에 포커스한다).
  const { fieldErrors, focusKeys } = props;
  const [seenKeys, setSeenKeys] = useState(focusKeys);
  const [focusRequest, setFocusRequest] = useState(0);
  if (
    focusKeys !== undefined &&
    seenKeys !== undefined &&
    focusKeys.some((key, i) => key !== seenKeys[i])
  ) {
    setSeenKeys(focusKeys);
    if (focusKeys.some(Boolean)) {
      const first = FIELD_ORDER.find((field) => fieldErrors?.byField[field]);
      const target = first === undefined ? undefined : sheetOf(first);
      if (!wide && target !== undefined) setSheet(target);
      else setFocusRequest((n) => n + 1);
    }
  }

  const handled = useRef(0);
  useEffect(() => {
    if (focusRequest === handled.current) return;
    handled.current = focusRequest;
    focusFirstInvalidField(
      document.querySelector<HTMLElement>("[data-brew-form]"),
    );
  }, [focusRequest]);

  const ctx: FieldContext = {
    state: props.state,
    set: props.onChange,
    errors: fieldErrors,
  };

  return (
    <>
      {wide ? (
        <WebForm {...props} ctx={ctx} />
      ) : (
        <MobileForm {...props} ctx={ctx} onOpenSheet={setSheet} />
      )}
      {!wide && sheet !== null && (
        <FormSheet title={sheet} onClose={closeSheet}>
          <SheetFields id={sheet} {...props} ctx={ctx} />
        </FormSheet>
      )}
      {props.children}
    </>
  );
}

interface LayoutProps extends BrewFormProps {
  ctx: FieldContext;
}

function Section({
  label,
  group,
  children,
}: {
  label: string;
  /** 접근 이름을 붙여 `group`으로 만든다(경고 블록이 그 묶음 안에 있는지 보인다) */
  group?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      role={group ? "group" : undefined}
      aria-label={group ? label : undefined}
      className="flex min-w-0 flex-col gap-[10px]"
    >
      <SectionLabel>{label}</SectionLabel>
      {children}
    </section>
  );
}

function Warning({
  section,
  warning,
}: {
  section: SectionWarning["section"];
  warning?: SectionWarning | null;
}) {
  if (warning?.section !== section) return null;
  // 필드에 붙지 않으니 포커스 대상이 되도록 `data-general-error`를 단다(AC-ERRFOCUS-04와 같은 규칙).
  return (
    <p
      data-warning
      data-general-error
      tabIndex={-1}
      className="rounded-[7px] border-l-2 border-accent bg-surface px-[12px] py-[8px] text-[13px]"
    >
      {warning.message}
    </p>
  );
}

function GeneralError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p data-general-error tabIndex={-1} className="text-body text-danger">
      {message}
    </p>
  );
}

const NOTE_CLASS = "text-[12.5px] text-ink-3";

/** ≥1100px — 왼쪽 2열 폼 + 오른쪽 360/420px 미리보기(AC-BREWFIT-04·05). */
function WebForm(props: LayoutProps) {
  const { ctx, grinders, targets } = props;
  const grind = grindBaseline(ctx.state, grinders, targets);

  return (
    <>
      <TopBarActions>
        <button
          type="button"
          onClick={props.onCancel}
          className="hit-44 px-[8px] py-[11px] text-[14px] font-medium text-ink-3"
        >
          취소
        </button>
        <Button
          variant="primary"
          disabled={props.submitting || props.submitDisabled}
          onClick={props.onSubmit}
        >
          {props.submitting ? "저장 중…" : props.submitLabel}
        </Button>
      </TopBarActions>

      <div className="flex items-start gap-[40px]">
        <div data-brew-form className="flex min-w-0 flex-1 flex-col gap-[28px]">
          <div className="flex flex-col">
            <span className="font-mono text-[10px] tracking-[0.14em] text-ink-3 uppercase">
              {props.mode === "create" ? "New brew" : "Edit brew"}
            </span>
            <h1 className="mt-[6px] mb-[2px] text-[30px] leading-[1.2] font-semibold tracking-[-0.01em] text-ink">
              {props.mode === "create" ? "이 레시피로 내렸다" : "기록 편집"}
            </h1>
            <div className="text-[13.5px] text-accent">
              <span className="sr-only">레시피</span>
              {props.recipeTitle}
            </div>
          </div>

          <GeneralError message={props.generalError} />

          <div className="grid grid-cols-2 gap-[36px]">
            <div className="flex min-w-0 flex-col gap-[26px]">
              <Section label="기본">
                <BrewedAtField ctx={ctx} />
                <VisibilityField ctx={ctx} />
              </Section>
              <Section label="수치">
                <div className="grid grid-cols-2 gap-[10px]">
                  <NumField
                    ctx={ctx}
                    field="actualDoseG"
                    label="원두"
                    accessibleName="원두량"
                    unit="g"
                  />
                  <NumField
                    ctx={ctx}
                    field="actualWaterG"
                    label="물"
                    accessibleName="물량"
                    unit="g"
                  />
                  <NumField
                    ctx={ctx}
                    field="actualWaterTempC"
                    label="물 온도"
                    accessibleName="물 온도"
                    unit="°C"
                  />
                  <TimeField
                    ctx={ctx}
                    field="actualTotalTimeSeconds"
                    label="추출 시간"
                    accessibleName="추출 시간"
                  />
                  <TimeField
                    ctx={ctx}
                    field="actualDrawdownSeconds"
                    label="드로다운"
                    accessibleName="드로다운 시간"
                  />
                </div>
              </Section>
              <Section label="원두와 장비">
                <div className="flex flex-col">
                  <BeanRow {...props} />
                  <div role="group" aria-label="장비" className="flex flex-col">
                    <Warning
                      section="equipment"
                      warning={props.sectionWarning}
                    />
                    <LedgerField
                      label="그라인더"
                      value={<GrinderSelect ctx={ctx} grinders={grinders} />}
                      action={<AddGrinder onAdd={props.onAddGrinder} />}
                    />
                    <LedgerField
                      label="분쇄도"
                      value={<GrindValueInput ctx={ctx} unit={grind.unit} />}
                      sub={grind.reference ?? undefined}
                    />
                  </div>
                </div>
              </Section>
            </div>

            <div className="flex min-w-0 flex-col gap-[26px]">
              <Section label="결과" group>
                <Warning section="result" warning={props.sectionWarning} />
                <ResultFields ctx={ctx} />
              </Section>
              <Section label="평가">
                <RatingInput
                  value={ctx.state.rating}
                  onChange={(v) => ctx.set("rating", v)}
                />
                <TasteAxes ctx={ctx} />
                <span className={NOTE_CLASS}>
                  점을 누르면 고르고, 같은 점을 다시 누르면 지웁니다.
                </span>
              </Section>
              <Section label="메모">
                <MemoField ctx={ctx} />
              </Section>
            </div>
          </div>
          {props.footer}
        </div>

        <aside className="sticky top-6 flex w-[360px] shrink-0 flex-col gap-[16px] min-[1280px]:w-[420px]">
          <BrewHero wide state={ctx.state} targets={targets} />
          <RecipeDiff state={ctx.state} targets={targets} />
          <span className={NOTE_CLASS}>
            저장하면 SCA 구간은 서버가 판정합니다.
          </span>
        </aside>
      </div>
    </>
  );
}

function AddGrinder({ onAdd }: { onAdd?: () => void }) {
  if (onAdd === undefined) return null;
  return (
    <button
      type="button"
      onClick={onAdd}
      className="hit-44 text-[13.5px] whitespace-nowrap text-ink-3"
    >
      + 그라인더 등록
    </button>
  );
}

function ResultFields({ ctx }: { ctx: FieldContext }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-[10px]">
        <NumField
          ctx={ctx}
          field="beverageWeightG"
          label="음료 중량"
          accessibleName="음료 중량"
          unit="g"
        />
        {/* TDS는 리프랙토미터가 있을 때만 채운다. 없어도 나머지는 전부 저장된다. */}
        <NumField
          ctx={ctx}
          field="tdsPercent"
          label="TDS"
          accessibleName="TDS"
          unit="%"
        />
      </div>
      <span className={NOTE_CLASS}>
        TDS는 리프랙토미터가 있을 때만 채웁니다.
      </span>
    </>
  );
}

function BeanRow(props: LayoutProps) {
  return (
    <LedgerField
      label="원두"
      value={
        <span className={props.bean ? "" : "text-ink-3"}>
          {props.bean?.label ?? "고르지 않음"}
        </span>
      }
      sub={props.bean?.sub}
      action={
        props.onChangeBean && (
          <RowAction label="원두 변경" onClick={props.onChangeBean} />
        )
      }
    />
  );
}

function RowAction({
  label,
  onClick,
  children = "변경",
}: {
  label: string;
  onClick: () => void;
  children?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="hit-44 text-[13.5px] whitespace-nowrap text-ink-3"
    >
      {children}
    </button>
  );
}

/** 레시피와 다른 점 — 기록 상세의 비교표와 같은 문장을 저장 전에 미리 보인다(AC-BREWFIT-08). */
function RecipeDiff({
  state,
  targets,
}: {
  state: BrewLogFormState;
  targets?: RecipeTargets;
}) {
  if (targets === undefined) return null;
  const seconds = parseMinSec(state.actualTotalTimeSeconds);
  const phrases = diffPhrases(targets, {
    doseG: state.actualDoseG ?? undefined,
    waterG: state.actualWaterG ?? undefined,
    waterTempC: state.actualWaterTempC ?? undefined,
    totalTimeSeconds: typeof seconds === "number" ? seconds : undefined,
  });
  if (phrases.length === 0) return null;

  return (
    <section
      data-recipe-diff
      aria-label="레시피와 다른 점"
      className="flex flex-col gap-[6px] rounded-r-[8px] border-l-2 border-accent bg-surface px-[16px] py-[14px]"
    >
      <span className="font-mono text-[10px] tracking-[0.14em] text-accent uppercase">
        레시피와 다른 점
      </span>
      <p className="text-[13.5px] leading-[1.65] text-ink">
        {phrases.map((phrase) => (
          <span key={phrase} className="block">
            {phrase}
          </span>
        ))}
      </p>
    </section>
  );
}

const dash = (value: string | null | undefined) =>
  value === null || value === undefined || value === "" ? "—" : value;

/** `2026-08-31T09:00` → `08.31 09:00` */
function shortDateTime(local: string): string {
  if (local.length < 16) return "—";
  return `${local.slice(5, 7)}.${local.slice(8, 10)} ${local.slice(11, 16)}`;
}

/** <1100px — 히어로 칩 + 원장 요약 8행 + 공개 범위 + 하단 CTA(AC-BREWFIT-10·11). */
function MobileForm(
  props: LayoutProps & { onOpenSheet: (id: SheetId) => void },
) {
  const { ctx, grinders, targets, onOpenSheet } = props;
  const s = ctx.state;
  const invalid = (id: SheetId) =>
    ROW_FIELDS[id].some((field) => ctx.errors?.byField[field]);
  const open = (id: SheetId) => () => onOpenSheet(id);

  const chosen = grinders.find((g) => g.id === s.userGrinderId);
  const grind = grindBaseline(s, grinders, targets);
  const yieldPercent = previewYield(
    s.actualDoseG,
    s.beverageWeightG,
    s.tdsPercent,
  );
  const submitText = props.submitting ? "저장 중…" : props.submitLabel;

  return (
    <div data-brew-form className="flex flex-col gap-[18px]">
      <div className="grid grid-cols-[60px_minmax(0,1fr)_60px] items-center text-[14.5px]">
        <button
          type="button"
          onClick={props.onCancel}
          className="hit-44 justify-self-start text-ink-3"
        >
          취소
        </button>
        <h1 className="text-center font-semibold text-ink">
          {props.mode === "create" ? "새 기록" : "기록 편집"}
        </h1>
        <button
          type="button"
          disabled={props.submitting || props.submitDisabled}
          onClick={props.onSubmit}
          className="hit-44 justify-self-end font-medium text-accent disabled:text-ink-disabled"
        >
          저장
        </button>
      </div>

      <GeneralError message={props.generalError} />

      <BrewHero
        wide={false}
        state={s}
        targets={targets}
        chips={
          <>
            <HeroNumberChip
              ctx={ctx}
              field="actualDoseG"
              accessibleName="원두량"
              caption="원두 g"
            />
            <HeroNumberChip
              ctx={ctx}
              field="actualWaterG"
              accessibleName="물량"
              caption="물 g"
            />
          </>
        }
      />

      <div className="flex flex-col">
        <LedgerField label="레시피" value={props.recipeTitle} />
        <LedgerField
          label="내린 시각"
          value={<span className="font-mono">{shortDateTime(s.brewedAt)}</span>}
          invalid={invalid("내린 시각")}
          action={
            <RowAction label="내린 시각 변경" onClick={open("내린 시각")} />
          }
        />
        <BeanRow {...props} />
        <LedgerField
          label="온도·시간"
          value={
            <span className="font-mono">
              {s.actualWaterTempC === null
                ? "—"
                : formatTemperature(s.actualWaterTempC)}
              {" · "}
              {dash(s.actualTotalTimeSeconds)}
            </span>
          }
          sub={`드로다운 ${dash(s.actualDrawdownSeconds)}`}
          invalid={invalid("온도·시간")}
          action={
            <RowAction label="온도·시간 변경" onClick={open("온도·시간")} />
          }
        />
        <Warning section="equipment" warning={props.sectionWarning} />
        <LedgerField
          label="장비"
          value={`${chosen ? (chosen.nickname ?? chosen.grinderModelName) : "—"} · ${
            s.actualGrindSettingValue === null
              ? "—"
              : [String(s.actualGrindSettingValue), grind.unit]
                  .filter(Boolean)
                  .join(" ")
          }`}
          sub={grind.reference ?? undefined}
          invalid={invalid("장비")}
          action={<RowAction label="장비 변경" onClick={open("장비")} />}
        />
        <Warning section="result" warning={props.sectionWarning} />
        <LedgerField
          label="결과"
          value={
            <span className="font-mono">
              {s.beverageWeightG === null
                ? "—"
                : formatGrams(s.beverageWeightG)}
              {` · TDS ${s.tdsPercent ?? "—"}`}
            </span>
          }
          sub={`수율 ${yieldPercent === null ? "—" : `${yieldPercent} %`}`}
          invalid={invalid("결과")}
          action={<RowAction label="결과 변경" onClick={open("결과")} />}
        />
        <LedgerField
          label="평가"
          value={
            <RatingInput
              compact
              value={s.rating}
              onChange={(v) => ctx.set("rating", v)}
            />
          }
          invalid={invalid("맛")}
          action={
            <button
              type="button"
              onClick={open("맛")}
              className="hit-44 text-[13.5px] whitespace-nowrap text-accent"
            >
              맛 자세히
            </button>
          }
        />
        <LedgerField
          label="메모"
          value={dash(s.overallNote.split("\n")[0])}
          invalid={invalid("메모")}
          action={<RowAction label="메모 변경" onClick={open("메모")} />}
        />
      </div>

      <section className="flex flex-col gap-[10px]">
        <SectionLabel>공개 범위</SectionLabel>
        <VisibilityField ctx={ctx} />
      </section>

      {props.footer}

      {/* 흐름 안에 남는 `sticky`라 마지막 줄을 가리지 않는다(AC-BREWFORM-12). */}
      <div className="sticky bottom-0 z-10 -mx-6 border-t border-divider bg-paper px-[20px] pt-[12px] pb-[22px]">
        <Button
          variant="primary"
          className="w-full py-[15px] text-[15px]"
          disabled={props.submitting || props.submitDisabled}
          onClick={props.onSubmit}
        >
          {submitText}
        </Button>
      </div>
    </div>
  );
}

/** 원장 행을 누르면 뜨는 시트의 입력. 그 행에 속한 것만 담는다(「묶음 시트 구성」). */
function SheetFields(
  props: BrewFormProps & { id: SheetId; ctx: FieldContext },
) {
  const { ctx, grinders, targets } = props;
  switch (props.id) {
    case "내린 시각":
      return <BrewedAtField ctx={ctx} />;
    case "온도·시간":
      return (
        <div className="flex flex-col gap-[10px]">
          <NumField
            ctx={ctx}
            field="actualWaterTempC"
            label="물 온도"
            accessibleName="물 온도"
            unit="°C"
          />
          <TimeField
            ctx={ctx}
            field="actualTotalTimeSeconds"
            label="추출 시간"
            accessibleName="추출 시간"
          />
          <TimeField
            ctx={ctx}
            field="actualDrawdownSeconds"
            label="드로다운"
            accessibleName="드로다운 시간"
          />
        </div>
      );
    case "장비": {
      const grind = grindBaseline(ctx.state, grinders, targets);
      return (
        <div className="flex flex-col">
          <LedgerField
            label="그라인더"
            value={<GrinderSelect ctx={ctx} grinders={grinders} />}
            action={<AddGrinder onAdd={props.onAddGrinder} />}
          />
          <LedgerField
            label="분쇄도"
            value={<GrindValueInput ctx={ctx} unit={grind.unit} />}
            sub={grind.reference ?? undefined}
          />
        </div>
      );
    }
    case "결과":
      return (
        <div className="flex flex-col gap-[10px]">
          <ResultFields ctx={ctx} />
        </div>
      );
    case "맛":
      return <TasteAxes ctx={ctx} />;
    case "메모":
      return <MemoField ctx={ctx} />;
  }
}

/**
 * 묶음 시트. `완료`·Escape·딤 클릭이 모두 같은 `onClose`다 — 시트는 폼 상태를 직접 바꾸므로 어떻게
 * 닫아도 값이 남는다(AC-BREWFIT-13). 열리면 안의 첫 오류 입력에 포커스한다(AC-BREWFIT-22).
 */
function FormSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    focusFirstInvalidField(ref.current);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-30 flex flex-col justify-end">
      <div
        data-sheet-dim
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-ink/40"
      />
      <div ref={ref} className="relative max-h-[85dvh] overflow-y-auto">
        <BottomSheet
          title={title}
          action={
            <button
              type="button"
              onClick={onClose}
              className="hit-44 text-[14px] font-medium text-accent"
            >
              완료
            </button>
          }
        >
          {children}
        </BottomSheet>
      </div>
    </div>
  );
}
