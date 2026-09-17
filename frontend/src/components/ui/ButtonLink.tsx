import Link from "next/link";
import type { ReactNode } from "react";
import type { ButtonVariant } from "./Button";

/**
 * 버튼처럼 생긴 링크.
 *
 * <p>「레시피 보러 가기」·「새 레시피」처럼 **이동**하는 액션이다. `<Button>`으로 만들면
 * 새 탭 열기와 링크 복사가 막히고, 스크린리더가 버튼으로 읽는다.
 * 모양은 `Button`과 같아야 하므로 변형 이름을 공유한다.
 */
const BASE =
  "inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-control px-3 py-2 text-body";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-accent text-on-ink",
  secondary: "border border-border",
  ghost: "text-accent",
};

export function ButtonLink({
  href,
  variant = "secondary",
  block = false,
  className = "",
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  block?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`${BASE} ${VARIANT[variant]} ${block ? "w-full" : ""} ${className}`.trim()}
    >
      {children}
    </Link>
  );
}
