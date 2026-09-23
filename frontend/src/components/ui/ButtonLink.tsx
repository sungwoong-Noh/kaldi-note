import Link from "next/link";
import type { ReactNode } from "react";
import { BUTTON_BASE, BUTTON_VARIANT, type ButtonVariant } from "./Button";

/**
 * 버튼처럼 생긴 링크.
 *
 * <p>「레시피 보러 가기」·「새 레시피」처럼 **이동**하는 액션이다. `<Button>`으로 만들면
 * 새 탭 열기와 링크 복사가 막히고, 스크린리더가 버튼으로 읽는다.
 * 모양은 `Button`과 같아야 하므로 색·크기 클래스를 `Button`에서 그대로 가져다 쓴다 —
 * 이전에는 이 테이블을 복붙해 갖고 있어 한쪽만 고치면 같은 화면에서 색이 갈라졌다
 * (docs/specs/2026-09-21-button-color-fidelity.md, AC-BTN-14·15).
 *
 * <p>`BUTTON_BASE`의 `disabled:` 유틸은 `<a>`에 `:disabled` 의사클래스가 없어
 * 아무 효과가 없다 — 죽은 클래스가 붙을 뿐 렌더 결과는 같다. 링크는 비활성화되지
 * 않으므로 별도로 뺄 이유가 없다.
 */

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
      className={`${BUTTON_BASE} ${BUTTON_VARIANT[variant]} ${block ? "w-full" : ""} ${className}`.trim()}
    >
      {children}
    </Link>
  );
}
