import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost";

/**
 * 모든 버튼의 단일 출처. `ButtonLink`와 색 검증 e2e(`e2e/button-color.spec.ts`)가
 * 이 두 상수를 가져다 쓴다(docs/specs/2026-09-21-button-color-fidelity.md).
 *
 * <p>이전에는 이 문자열이 8곳에 복붙돼 있었고 순서만 다른 변종이 셋 더 있었다.
 * 버튼 모양 하나를 고치려면 수십 곳을 동시에 고쳐야 했다.
 *
 * <p><b>44px 보장을 이 컴포넌트가 떠안는다</b> — 화면이 `min-h-11`을 기억할 필요가 없다
 * (docs/specs/2026-09-09-touch-targets.md).
 *
 * <p>disabled 배경·글자는 `:disabled` 의사클래스로 명시도가 높아 변형의 배경을 이긴다.
 * `opacity-50`은 쓰지 않는다 — `bg-sunken`과 겹치면 목업보다 흐려진다(AC-BTN-07).
 */
export const BUTTON_BASE =
  "inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-control px-3 py-2 text-body disabled:bg-sunken disabled:text-ink-disabled";

/**
 * `enabled:hover:`을 쓰는 이유는 그냥 `hover:`면 비활성 버튼에 포인터를 올렸을 때도
 * 색이 바뀌기 때문이다(AC-BTN-11).
 */
export const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-ink text-on-ink enabled:hover:bg-ink-hover",
  secondary:
    "border border-border bg-surface text-ink enabled:hover:bg-sunken",
  ghost: "text-accent enabled:hover:bg-accent-wash",
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** 화면 폭을 채운다. 하단 고정 CTA가 이 형태다. */
  block?: boolean;
  children: ReactNode;
}

export function Button({
  variant = "secondary",
  block = false,
  className = "",
  type = "button",
  children,
  ...rest
}: Props) {
  return (
    <button
      type={type}
      className={`${BUTTON_BASE} ${BUTTON_VARIANT[variant]} ${block ? "w-full" : ""} ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  );
}
