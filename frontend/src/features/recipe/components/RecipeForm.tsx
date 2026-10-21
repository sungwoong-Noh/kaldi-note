"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { errorMessageOf } from "@/components/ErrorState";
import {
  LedgerField,
  NumberCell,
  SectionLabel,
  Segmented,
  useNumberText,
} from "@/components/kit";
import { TopBarActions } from "@/components/layout/TopBarActions";
import { LeaveConfirmDialog } from "@/components/LeaveConfirmDialog";
import { Button, SELECT_EXTRA } from "@/components/ui";
import { useBrewFilters, useBrewers, useGrinders } from "@/features/gear/queries";
import { ApiError } from "@/lib/api-client";
import { mapFieldErrors } from "@/lib/fieldErrors";
import { focusFirstInvalidField } from "@/lib/focusFirstError";
import { formatDuration, parseMinSec } from "@/lib/format";
import { useIsWide } from "@/lib/useIsWide";
import {
  toRequestBody,
  validateRecipeForm,
  type GrindSettingUnit,
  type RecipeFormErrors,
  type RecipeFormState,
  type RecipeRequestBody,
  type RoastLevel,
  type TemperatureType,
  type Visibility,
} from "../formState";
import { gramsText, ratioLabel, timeline, waterObservation } from "../preview";
import { RecipeStepEditor } from "./RecipeStepEditor";

export type RecipeFormMode = "create" | "edit";

type Props = {
  mode: RecipeFormMode;
  initial: RecipeFormState;
  /** 저장된 추정 입도. 편집 화면에서만 있다(R5). */
  micronEstimated?: number;
  /** 담아온 레시피의 원본 배너(M3). 폼 맨 위에 그린다. */
  banner?: ReactNode;
  submitting: boolean;
  error: unknown;
  onSubmit: (body: RecipeRequestBody) => void;
  /** 나가기 목적지는 부모가 정한다. 고친 게 있으면 폼이 먼저 확인한다(S6). */
  onCancel: () => void;
  onSessionLost?: () => void;
};

const TIME_FORMAT_MESSAGE = "0:00 형식으로 입력해 주세요.";

const VISIBILITY_WEB = [
  { value: "PRIVATE", label: "나만 보기" },
  { value: "FRIENDS", label: "맞팔로우 친구" },
  { value: "PUBLIC", label: "전체" },
] as const satisfies readonly { value: Visibility; label: string }[];

const VISIBILITY_MOBILE = [
  { value: "PRIVATE", label: "나만" },
  { value: "FRIENDS", label: "맞팔로우" },
  { value: "PUBLIC", label: "전체" },
] as const satisfies readonly { value: Visibility; label: string }[];

const TEMPERATURE_OPTIONS = [
  { value: "HOT", label: "HOT" },
  { value: "ICE", label: "ICE" },
] as const satisfies readonly { value: TemperatureType; label: string }[];

const ROAST_OPTIONS = [
  { value: "LIGHT", label: "약배전" },
  { value: "MEDIUM", label: "중배전" },
  { value: "DARK", label: "강배전" },
] as const satisfies readonly { value: RoastLevel; label: string }[];

const UNIT_OPTIONS = [
  { value: "CLICK", label: "클릭" },
  { value: "NUMBER", label: "눈금" },
  { value: "MICRON", label: "µm" },
] as const satisfies readonly { value: GrindSettingUnit; label: string }[];

type FieldKey = keyof RecipeFormErrors | "totalTimeSeconds";

/**
 * 레시피 작성·편집 폼 — 목업 03(docs/specs/2026-10-21-recipe-edit-redesign.md). 두 화면이 같은 것을 쓴다 — `PUT`이 전체
 * 교체라 편집이 생성과 같은 모양이다.
 *
 * <p>≥1100px(앱 셸과 같은 경계)은 왼쪽 폼 + 오른쪽 미리보기, 그 아래는 히어로 칩 + 한 컬럼 + 하단 고정 저장이다. 한쪽만 그린다 —
 * CSS로 둘 다 그리면 같은 접근 이름의 입력이 두 벌 생긴다.
 *
 * <p>클라이언트는 제목·원두·물 범위와 시간 형식만 막는다(S3). 스텝 합계·겹침은 서버가 판정한다(AC-RECIPE-46·50).
 */
export function RecipeForm(props: Props) {
  const { initial, error, submitting, onSubmit } = props;
  const wide = useIsWide();
  const [state, setState] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [timeText, setTimeText] = useState(
    initial.totalTimeSeconds === null
      ? ""
      : formatDuration(initial.totalTimeSeconds),
  );
  const [clientErrors, setClientErrors] = useState<
    Partial<Record<FieldKey, string>>
  >({});
  const [leaving, setLeaving] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  const serverErrors = useMemo(
    () =>
      error instanceof ApiError
        ? mapFieldErrors(error.fieldErrors)
        : { byField: {}, byStepIndex: {}, unmapped: [] },
    [error],
  );
  // 5xx·네트워크 실패는 입력을 그대로 두고 다시 시도하게 한다(S5). 4xx는 서버 문구를 필드·상단에 붙인다.
  const saveFailed =
    error !== null &&
    error !== undefined &&
    !(error instanceof ApiError && error.status < 500);

  // 고친 것이 있을 때만 새로고침·탭 닫기를 경고한다(AC-WEBEDIT-36·37).
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    if (focusRequest > 0) focusFirstInvalidField(formRef.current);
  }, [focusRequest]);

  function patch(changes: Partial<RecipeFormState>) {
    setDirty(true);
    setState((previous) => ({ ...previous, ...changes }));
  }

  function changeTime(text: string) {
    setTimeText(text);
    const seconds = parseMinSec(text);
    patch({ totalTimeSeconds: typeof seconds === "number" ? seconds : null });
  }

  function submit() {
    const errors: Partial<Record<FieldKey, string>> = validateRecipeForm(state);
    if (parseMinSec(timeText) === "invalid") {
      errors.totalTimeSeconds = TIME_FORMAT_MESSAGE;
    }
    setClientErrors(errors);
    if (Object.keys(errors).length > 0) {
      setFocusRequest((n) => n + 1);
      return;
    }
    onSubmit(toRequestBody(state));
  }

  function cancel() {
    if (dirty) setLeaving(true);
    else props.onCancel();
  }

  const errorOf = (field: string): string | undefined =>
    clientErrors[field as FieldKey] ?? serverErrors.byField[field];

  const clientErrorCount = Object.keys(clientErrors).length;
  const submitLabel = props.mode === "create" ? "레시피 저장" : "변경 사항 저장";
  const title = props.mode === "create" ? "새 레시피" : "레시피 수정";

  const view: ViewProps = {
    ...props,
    wide,
    state,
    patch,
    timeText,
    changeTime,
    errorOf,
    stepErrors: serverErrors.byStepIndex,
    submitLabel: submitting ? "저장 중…" : submitLabel,
    title,
    cancel,
    submit,
    alerts: (
      <Alerts
        clientErrorCount={clientErrorCount}
        saveFailed={saveFailed}
        error={error}
        unmapped={serverErrors.unmapped}
        onRetry={submit}
      />
    ),
  };

  return (
    <>
      <form
        ref={formRef}
        data-recipe-form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {/* 저장 중에는 입력과 버튼을 전부 막는다(S4). fieldset이 안의 컨트롤을 한 번에 끈다. */}
        <fieldset disabled={submitting} className="m-0 min-w-0 border-0 p-0">
          {wide ? <WebLayout {...view} /> : <MobileLayout {...view} />}
        </fieldset>
      </form>
      {leaving && (
        <LeaveConfirmDialog
          onLeave={props.onCancel}
          onStay={() => setLeaving(false)}
        />
      )}
    </>
  );
}

type ViewProps = Props & {
  wide: boolean;
  state: RecipeFormState;
  patch: (changes: Partial<RecipeFormState>) => void;
  timeText: string;
  changeTime: (text: string) => void;
  errorOf: (field: string) => string | undefined;
  stepErrors: Record<number, string>;
  submitLabel: string;
  title: string;
  cancel: () => void;
  submit: () => void;
  alerts: ReactNode;
};

/** ≥1100px — 왼쪽 폼(≥1280은 2열) + 오른쪽 360/420 미리보기(AC-RECIPEEDIT-80). */
function WebLayout(view: ViewProps) {
  return (
    <>
      <TopBarActions>
        <button
          type="button"
          disabled={view.submitting}
          onClick={view.cancel}
          className="hit-44 px-[8px] py-[11px] text-[14px] text-ink-3"
        >
          취소
        </button>
        <Button
          variant="primary"
          disabled={view.submitting}
          onClick={view.submit}
        >
          {view.submitLabel}
        </Button>
      </TopBarActions>

      <div className="flex items-start gap-[40px]">
        <div className="flex min-w-0 flex-1 flex-col gap-[22px]">
          <div className="flex flex-col gap-[5px]">
            <span className="font-mono text-[10.5px] tracking-[0.16em] text-ink-3 uppercase">
              {view.mode === "create" ? "New recipe" : "Edit recipe"}
            </span>
            <h1 className="text-[28px] font-semibold tracking-[-0.025em] text-ink">
              {view.title}
            </h1>
          </div>
          {view.banner}
          {view.alerts}

          <div className="grid gap-[28px] min-[1280px]:grid-cols-[340px_minmax(0,1fr)]">
            <div className="flex min-w-0 flex-col gap-[20px]">
              <BasicSection {...view} />
              <Section label="수치">
                <div className="grid grid-cols-2 gap-[10px]">
                  <NumField
                    label="원두"
                    accessibleName="원두량"
                    unit="g"
                    field="doseG"
                    {...view}
                  />
                  <NumField
                    label="물"
                    accessibleName="물량"
                    unit="g"
                    field="waterG"
                    {...view}
                  />
                  <NumField
                    label="물 온도"
                    accessibleName="물 온도"
                    unit="°C"
                    field="waterTempC"
                    {...view}
                  />
                  <TimeCell {...view} />
                </div>
                <BrewTypeSegments {...view} />
              </Section>
              <GearSection {...view} />
            </div>
            <div className="flex min-w-0 flex-col gap-[12px]">
              <Steps {...view} />
            </div>
          </div>
        </div>

        <aside
          data-recipe-preview
          className="sticky top-6 flex w-[360px] shrink-0 flex-col gap-[20px] min-[1280px]:w-[420px]"
        >
          <RatioHero {...view} />
          <Timeline {...view} />
          <Observation {...view} />
        </aside>
      </div>
    </>
  );
}

/** <1100px — 헤더(취소·제목·저장) · 히어로 칩 · 한 컬럼 · 하단 고정 저장(M1). */
function MobileLayout(view: ViewProps) {
  return (
    <div className="flex flex-col gap-[20px] pb-[88px]">
      <header className="flex items-center justify-between">
        <button
          type="button"
          onClick={view.cancel}
          className="hit-44 text-[14.5px] text-ink-3"
        >
          취소
        </button>
        <h1 className="text-[15px] font-semibold text-ink">{view.title}</h1>
        <button
          type="submit"
          className="hit-44 text-[14.5px] font-medium text-accent"
        >
          저장
        </button>
      </header>
      {view.banner}
      {view.alerts}
      <RatioHero {...view} />
      <BasicSection {...view} />
      <Section label="수치">
        <div className="grid grid-cols-2 gap-[10px]">
          <NumField
            label="물 온도"
            accessibleName="물 온도"
            unit="°C"
            field="waterTempC"
            {...view}
          />
          <TimeCell {...view} />
        </div>
        <BrewTypeSegments {...view} />
      </Section>
      <GearSection {...view} />
      {/* 760–1099는 접힌 타임라인, 그 아래(모바일)는 히어로만(목업 반응형). */}
      <details
        data-timeline-toggle
        className="hidden rounded-[10px] border border-divider px-[16px] py-[12px] min-[760px]:block"
      >
        <summary className="cursor-pointer font-mono text-[10px] tracking-[0.16em] text-ink-3 uppercase">
          타임라인
        </summary>
        <div className="pt-[12px]">
          <Timeline {...view} />
        </div>
      </details>
      <Steps {...view} />
      <Observation {...view} />

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-divider bg-paper px-[24px] pt-[12px] pb-[calc(12px+env(safe-area-inset-bottom))]">
        <button
          type="submit"
          className="block w-full rounded-[8px] bg-ink p-[14px] text-center text-[15px] font-medium text-on-ink disabled:opacity-60"
        >
          {view.submitLabel}
        </button>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-[10px]">
      <SectionLabel>{label}</SectionLabel>
      {children}
    </section>
  );
}

function Alerts({
  clientErrorCount,
  saveFailed,
  error,
  unmapped,
  onRetry,
}: {
  clientErrorCount: number;
  saveFailed: boolean;
  error: unknown;
  unmapped: string[];
  onRetry: () => void;
}) {
  if (clientErrorCount > 0) {
    return (
      <p role="alert" className="text-body text-danger">
        {clientErrorCount}개 항목을 확인해 주세요.
      </p>
    );
  }
  if (saveFailed) {
    return (
      <div
        role="alert"
        className="flex items-center justify-between gap-[12px] rounded-[8px] border border-border bg-surface px-[14px] py-[10px] text-[13.5px] text-ink"
      >
        <span>저장하지 못했습니다. 입력한 내용은 그대로 있습니다.</span>
        <button
          type="button"
          data-general-error
          onClick={onRetry}
          className="hit-44 shrink-0 font-medium text-accent"
        >
          다시 시도
        </button>
      </div>
    );
  }
  if (error === null || error === undefined) return null;
  return (
    <div
      role="alert"
      data-general-error
      tabIndex={-1}
      className="flex flex-col gap-1 text-body text-danger"
    >
      <p>{errorMessageOf(error)}</p>
      {unmapped.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <span id={id} className="text-[12.5px] whitespace-pre-line text-danger">
      {message}
    </span>
  );
}

function invalidProps(id: string, message?: string) {
  return {
    "aria-invalid": message ? true : undefined,
    "aria-describedby": message ? id : undefined,
  } as const;
}

function BasicSection({ state, patch, errorOf, wide }: ViewProps) {
  const titleError = errorOf("title");
  const descriptionError = errorOf("description");
  const atLimit = state.description.length >= 2000;

  return (
    <Section label="기본">
      <div className="flex flex-col gap-[4px]">
        <label className="flex items-center gap-[10px] rounded-[7px] border border-border bg-paper px-[14px] py-[12px] has-[[aria-invalid=true]]:border-danger">
          <input
            aria-label="제목"
            placeholder="제목을 입력하세요"
            maxLength={100}
            value={state.title}
            onChange={(e) => patch({ title: e.target.value })}
            className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none"
            {...invalidProps("recipe-title-error", titleError)}
          />
          <span
            data-testid="title-counter"
            className="shrink-0 font-mono text-[11px] text-ink-3"
          >
            {state.title.length} / 100
          </span>
        </label>
        <FieldError id="recipe-title-error" message={titleError} />
      </div>

      <div className="flex flex-col gap-[4px]">
        <label className="relative flex">
          <textarea
            aria-label="설명"
            rows={2}
            maxLength={2000}
            value={state.description}
            onChange={(e) => patch({ description: e.target.value })}
            className="min-h-[62px] w-full rounded-[7px] border border-border bg-paper px-[14px] pt-[12px] pb-[24px] text-[14px] leading-[1.6] text-ink-2 outline-none aria-invalid:border-danger"
            {...invalidProps("recipe-description-error", descriptionError)}
          />
          <span
            data-testid="description-counter"
            className={`pointer-events-none absolute right-[12px] bottom-[8px] font-mono text-[11px] ${atLimit ? "text-accent" : "text-ink-3"}`}
          >
            {state.description.length} / 2000
          </span>
        </label>
        <FieldError id="recipe-description-error" message={descriptionError} />
      </div>

      <Segmented
        label="공개 범위"
        options={wide ? VISIBILITY_WEB : VISIBILITY_MOBILE}
        value={state.visibility}
        onChange={(visibility) => patch({ visibility })}
      />
    </Section>
  );
}

function NumField({
  label,
  accessibleName,
  unit,
  field,
  state,
  patch,
  errorOf,
}: ViewProps & {
  label: string;
  accessibleName: string;
  unit: string;
  field: "doseG" | "waterG" | "waterTempC";
}) {
  const text = useNumberText(state[field], (value) =>
    patch({ [field]: value }),
  );
  const message = errorOf(field);
  const id = `recipe-${field}-error`;
  return (
    <div className="flex min-w-0 flex-col gap-[4px]">
      <NumberCell
        label={label}
        accessibleName={accessibleName}
        unit={unit}
        {...text}
        {...invalidProps(id, message)}
      />
      <FieldError id={id} message={message} />
    </div>
  );
}

function TimeCell({ timeText, changeTime, errorOf }: ViewProps) {
  const message = errorOf("totalTimeSeconds");
  const id = "recipe-totalTimeSeconds-error";
  return (
    <div className="flex min-w-0 flex-col gap-[4px]">
      <NumberCell
        label="총 시간"
        accessibleName="총 시간"
        inputMode={undefined}
        placeholder="0:00"
        value={timeText}
        onChange={(e) => changeTime(e.target.value.trim())}
        {...invalidProps(id, message)}
      />
      <FieldError id={id} message={message} />
    </div>
  );
}

function BrewTypeSegments({ state, patch }: ViewProps) {
  return (
    <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-[10px]">
      <Segmented
        label="온도"
        options={TEMPERATURE_OPTIONS}
        value={state.temperatureType}
        onChange={(temperatureType) => patch({ temperatureType })}
      />
      <Segmented
        label="추천 배전도"
        options={ROAST_OPTIONS}
        value={state.recommendedRoastLevel}
        onChange={(recommendedRoastLevel) => patch({ recommendedRoastLevel })}
      />
    </div>
  );
}

function GearSection(view: ViewProps) {
  const { state, patch, errorOf, initial, micronEstimated, onSessionLost } =
    view;
  const brewers = useBrewers(onSessionLost);
  const filters = useBrewFilters(onSessionLost);
  const grinders = useGrinders(onSessionLost);
  const grindText = useNumberText(state.grindSettingValue, (value) =>
    patch({ grindSettingValue: value }),
  );
  const grindError = errorOf("grindSettingValue");

  // 저장된 추정 입도는 분쇄도를 고치지 않았을 때만 맞는 값이다(R5).
  const grindUnchanged =
    state.grinderModelId === initial.grinderModelId &&
    state.grindSettingUnit === initial.grindSettingUnit &&
    state.grindSettingValue === initial.grindSettingValue;
  const micronNote =
    micronEstimated !== undefined && grindUnchanged
      ? `약 ${micronEstimated} µm · 추정치`
      : "저장하면 추정 입도(µm)가 계산됩니다.";

  return (
    <Section label="장비">
      <div className="flex flex-col">
        <LedgerField
          label="드리퍼"
          value={
            <GearSelect
              label="드리퍼"
              value={state.brewerId}
              options={(brewers.data ?? []).map((b) => ({
                id: b.id,
                name: `${b.brand} · ${b.name}`,
              }))}
              onChange={(brewerId) => patch({ brewerId })}
            />
          }
        />
        <LedgerField
          label="필터"
          value={
            <GearSelect
              label="필터"
              value={state.filterId}
              options={(filters.data ?? []).map((f) => ({
                id: f.id,
                name: f.name,
              }))}
              onChange={(filterId) => patch({ filterId })}
            />
          }
        />
        <LedgerField
          label="그라인더"
          value={
            <GearSelect
              label="그라인더"
              value={state.grinderModelId}
              options={(grinders.data ?? []).map((g) => ({
                id: g.id,
                name: `${g.brand} ${g.name}`,
              }))}
              onChange={(grinderModelId) => patch({ grinderModelId })}
            />
          }
        />
        <LedgerField
          label="분쇄도"
          invalid={grindError !== undefined}
          value={
            <label className="hit-44 flex">
              <input
                type="text"
                inputMode="decimal"
                aria-label="분쇄도 값"
                placeholder="—"
                {...grindText}
                className="w-full min-w-0 bg-transparent font-mono text-[15px] text-ink tabular-nums outline-none"
                {...invalidProps("recipe-grind-error", grindError)}
              />
            </label>
          }
          action={
            <span className="block w-[156px]">
              <Segmented
                label="분쇄도 단위"
                options={UNIT_OPTIONS}
                value={state.grindSettingUnit}
                onChange={(grindSettingUnit) => patch({ grindSettingUnit })}
              />
            </span>
          }
        />
      </div>
      <FieldError id="recipe-grind-error" message={grindError} />
      <p className="text-[12px] leading-[1.55] text-ink-3">{micronNote}</p>
    </Section>
  );
}

function GearSelect({
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
  // `<select>`는 의사 요소를 그리지 않아 `hit-44`를 감싼 라벨에 단다.
  return (
    <label className="hit-44 flex min-w-0">
      <select
        aria-label={label}
        value={value ?? ""}
        onChange={(e) =>
          onChange(e.target.value === "" ? null : Number(e.target.value))
        }
        className={`${SELECT_EXTRA} w-full min-w-0 truncate pr-[24px]! bg-transparent text-[14px] text-ink`}
      >
        <option value="">선택 안 함</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function Steps({ state, patch, stepErrors }: ViewProps) {
  return (
    <RecipeStepEditor
      steps={state.steps}
      waterG={state.waterG}
      errors={stepErrors}
      onChange={(steps) => patch({ steps })}
    />
  );
}

/** 비율 히어로. 웹은 원두·물·총 시간 줄, 모바일은 원두·물 입력 칩(목업 W·M1). */
function RatioHero(view: ViewProps) {
  const { state, wide } = view;
  return (
    <div
      data-hero
      className={`flex flex-col rounded-[14px] bg-hero text-on-hero ${wide ? "gap-[16px] p-[24px]" : "gap-[12px] px-[20px] py-[18px]"}`}
    >
      <span className="font-mono text-[9.5px] tracking-[0.16em] text-on-hero-dim uppercase">
        Ratio · 자동
      </span>
      <span
        data-testid="recipe-ratio"
        className={`font-mono leading-none font-medium tracking-[-0.04em] ${wide ? "text-[44px]" : "text-[36px]"}`}
      >
        {ratioLabel(state.doseG, state.waterG)}
      </span>
      {wide ? (
        <div className="flex border-t border-hero-line pt-[14px]">
          <HeroValue
            label="원두"
            value={state.doseG === null ? "—" : `${gramsText(state.doseG)} g`}
          />
          <HeroValue
            label="물"
            value={state.waterG === null ? "—" : `${gramsText(state.waterG)} g`}
          />
          <HeroValue
            label="총 시간"
            value={
              state.totalTimeSeconds === null
                ? "—"
                : formatDuration(state.totalTimeSeconds)
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-[9px]">
          <HeroChip {...view} field="doseG" name="원두량" caption="원두 g" />
          <HeroChip {...view} field="waterG" name="물량" caption="물 g" />
        </div>
      )}
    </div>
  );
}

function HeroValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1">
      <div className="font-mono text-[9px] tracking-[0.1em] text-on-hero-dim uppercase">
        {label}
      </div>
      <div className="mt-[4px] font-mono text-[15px]">{value}</div>
    </div>
  );
}

function HeroChip({
  state,
  patch,
  errorOf,
  field,
  name,
  caption,
}: ViewProps & {
  field: "doseG" | "waterG";
  name: string;
  caption: string;
}) {
  const text = useNumberText(state[field], (value) =>
    patch({ [field]: value }),
  );
  const message = errorOf(field);
  const id = `recipe-${field}-error`;
  return (
    <div className="flex min-w-0 flex-col gap-[4px]">
      <label className="hit-44 flex items-baseline justify-between gap-[8px] rounded-[8px] bg-hero-line px-[13px] py-[11px] has-[[aria-invalid=true]]:outline has-[[aria-invalid=true]]:outline-danger">
        <input
          type="text"
          inputMode="decimal"
          aria-label={name}
          {...text}
          className="w-full min-w-0 bg-transparent font-mono text-[16px] text-on-hero tabular-nums outline-none"
          {...invalidProps(id, message)}
        />
        <span className="shrink-0 font-mono text-[10.5px] text-on-hero-dim">
          {caption}
        </span>
      </label>
      <FieldError id={id} message={message} />
    </div>
  );
}

function Timeline({ state }: ViewProps) {
  if (state.steps.length === 0) return null;
  const { bars, axis } = timeline(state.steps, state.totalTimeSeconds);

  return (
    <section className="flex flex-col gap-[12px]">
      <div className="flex items-baseline justify-between">
        <SectionLabel>타임라인</SectionLabel>
        <span className="font-mono text-[10.5px] text-ink-3">
          {axis[0]} — {axis[2]}
        </span>
      </div>
      <div className="flex flex-col gap-[10px] rounded-[10px] border border-divider bg-paper p-[16px]">
        <ul aria-label="타임라인" className="flex flex-col gap-[10px]">
          {bars.map((bar) => (
            <li key={bar.uid} className="flex items-center gap-[10px]">
              <span className="w-[34px] shrink-0 text-[11.5px] text-ink-2">
                {bar.label}
              </span>
              <span className="relative h-[14px] flex-1 rounded-[3px] bg-sunken">
                <span
                  className={`absolute inset-y-0 rounded-[3px] ${bar.cumulative === "—" ? "bg-border" : "bg-ink"}`}
                  style={{ left: `${bar.leftPct}%`, width: `${bar.widthPct}%` }}
                />
              </span>
              <span className="w-[44px] shrink-0 text-right font-mono text-[11px] text-ink-2">
                {bar.cumulative}
              </span>
            </li>
          ))}
        </ul>
        <div
          data-testid="timeline-axis"
          className="flex justify-between pr-[54px] pl-[44px] font-mono text-[9.5px] text-ink-3"
        >
          {axis.map((tick, i) => (
            <span key={i}>{tick}</span>
          ))}
        </div>
      </div>
      <p className="text-[12px] leading-[1.55] text-ink-3">
        오른쪽 숫자는 누적 물량(g)입니다.
      </p>
    </section>
  );
}

function Observation({ state }: ViewProps) {
  const observation = waterObservation(state.steps, state.waterG);
  if (observation === null) return null;
  return (
    <div className="rounded-r-[10px] border-l-2 border-accent bg-paper px-[16px] py-[14px]">
      <div className="mb-[5px] font-mono text-[9.5px] tracking-[0.12em] text-accent uppercase">
        Observation
      </div>
      <p className="text-[13px] leading-[1.6] text-ink-2">{observation.text}</p>
    </div>
  );
}
