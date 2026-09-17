import type { ReactNode } from "react";

/**
 * 섹션·카드 위의 작은 대문자 라벨.
 *
 * <p>Mono에 자간을 벌려 쓴다 — 서술이 아니라 **분류**라는 신호다. 목업이 히어로와
 * 관리자 화면에서 같은 형태를 쓴다.
 */
export function Eyebrow({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span data-eyebrow className={`text-label text-ink-3 ${className}`.trim()}>
      {children}
    </span>
  );
}
