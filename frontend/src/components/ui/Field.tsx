import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";
import { useId } from "react";

/** 입력칸과 select가 공유하는 껍데기. 오류 문구 자리까지 여기서 정한다. */
const CONTROL =
  "w-full min-w-0 min-h-11 rounded-control border border-border px-2 py-1";

/**
 * 오류 상태의 테두리.
 *
 * <p><b>문구만으로는 부족하다.</b> 지금까지는 입력칸 아래에 빨간 글자만 떴고 칸 자체는
 * 그대로여서, 무엇이 틀렸는지 눈으로 찾아야 했다.
 */
const INVALID = "border-danger";

/**
 * 컨트롤 스타일의 단일 출처.
 *
 * <p><b>화면이 아직 `Input`·`Select` 컴포넌트를 쓰지 못할 때를 위한 문이다.</b>
 * 각 화면이 저마다 `TextField`·`NumberField` 같은 로컬 헬퍼를 갖고 있어 한 번에 옮길 수 없다 —
 * 그 헬퍼들이 이 함수를 부르면 **스타일만 먼저 한 곳으로 모인다.**
 *
 * <p>리스킨에서 헬퍼를 걷어내고 컴포넌트로 옮긴다. 그때 이 함수는 사라진다.
 *
 * @param extra 그 자리에만 필요한 클래스(예: `select`의 화살표 자리)
 */
export function controlClass(extra = "", invalid = false): string {
  return `${CONTROL} ${invalid ? INVALID : ""} ${extra}`.replace(/\s+/g, " ").trim();
}

/** `select`는 OS 기본 화살표를 벗기고 우리가 그린다. */
export const SELECT_EXTRA = "appearance-none select-chevron pr-12";

interface Shell {
  label: string;
  error?: string;
  /** 단위는 입력칸 오른쪽 안에 붙는다(g · °C · 초). */
  unit?: string;
}

function Wrapper({
  label,
  error,
  errorId,
  children,
}: Shell & { errorId: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-body">
      <span className="shrink-0 text-ink-3">{label}</span>
      {children}
      {error !== undefined && (
        <span id={errorId} className="text-body-sm text-danger">
          {error}
        </span>
      )}
    </label>
  );
}

export function Input({
  label,
  error,
  unit,
  className = "",
  ...rest
}: Shell & InputHTMLAttributes<HTMLInputElement>) {
  const errorId = `${useId()}-error`;

  return (
    <Wrapper label={label} error={error} errorId={errorId}>
      <span className="relative flex min-w-0 items-center">
        <input
          aria-label={label}
          // `aria-invalid="false"`가 아니라 **부재**여야 한다 — 보조기술이
          // 「검증된 적 없음」과 「통과」를 구분한다.
          aria-invalid={error !== undefined ? true : undefined}
          aria-describedby={error !== undefined ? errorId : undefined}
          className={controlClass(
            `${unit !== undefined ? "pr-12" : ""} ${className}`,
            error !== undefined,
          )}
          {...rest}
        />
        {unit !== undefined && (
          <span
            aria-hidden
            className="pointer-events-none absolute right-2 text-metric text-ink-3"
          >
            {unit}
          </span>
        )}
      </span>
    </Wrapper>
  );
}

export interface Option {
  value: string;
  label: string;
}

export function Select({
  label,
  error,
  options,
  className = "",
  ...rest
}: Shell & { options: Option[] } & SelectHTMLAttributes<HTMLSelectElement>) {
  const errorId = `${useId()}-error`;

  return (
    <Wrapper label={label} error={error} errorId={errorId}>
      {/*
        `appearance-none`으로 OS 기본 모양을 벗기면 화살표도 사라져 드롭다운인지 알 수 없다.
        `.select-chevron`이 그것을 그린다(docs/specs/2026-09-15-structure.md).
      */}
      <select
        aria-label={label}
        aria-invalid={error !== undefined ? true : undefined}
        aria-describedby={error !== undefined ? errorId : undefined}
        className={controlClass(
          `${SELECT_EXTRA} ${className}`,
          error !== undefined,
        )}
        {...rest}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Wrapper>
  );
}
