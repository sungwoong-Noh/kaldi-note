import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost";

/**
 * 모든 버튼의 단일 출처.
 *
 * <p>이전에는 이 문자열이 8곳에 복붙돼 있었고 순서만 다른 변종이 셋 더 있었다.
 * 버튼 모양 하나를 고치려면 수십 곳을 동시에 고쳐야 했다.
 *
 * <p><b>44px 보장을 이 컴포넌트가 떠안는다</b> — 화면이 `min-h-11`을 기억할 필요가 없다
 * (docs/specs/2026-09-09-touch-targets.md).
 */
const BASE =
  "inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-control px-3 py-2 text-body disabled:opacity-50";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-accent text-on-ink",
  secondary: "border border-border",
  ghost: "text-accent",
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
      className={`${BASE} ${VARIANT[variant]} ${block ? "w-full" : ""} ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  );
}
