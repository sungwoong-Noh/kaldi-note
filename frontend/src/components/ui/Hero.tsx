import type { ReactNode } from "react";

/**
 * 화면의 대표 수치를 담는 어두운 판 — docs/specs/2026-09-17-screen-reskin.md
 *
 * <p>「화면마다 대표 수치 하나」는 `visual-hierarchy` 때부터의 규칙인데, 지금까지는 그냥
 * 큰 글자였다. 목업은 그것을 **판 위에 올려** 주변과 분리한다 — 그래야 목록을 훑을 때
 * 눈이 먼저 닿는다.
 *
 * <p>배경은 라이트·다크 양쪽에서 같다(`--hero`). 모드에 따라 뒤집히면
 * 「판 위의 수치」라는 구조 자체가 사라진다.
 */
export function Hero({
  eyebrow,
  lead,
  leadUnit,
  children,
  className = "",
}: {
  eyebrow: string;
  /** 대표 수치. Mono 36px으로 렌더된다. */
  lead: ReactNode;
  /** 수치 옆 단위·이름(비율·수율 등). */
  leadUnit?: string;
  /** 구분선 아래 들어갈 서브메트릭. 보통 `MetricRow` 여럿이다. */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-hero
      className={`flex flex-col gap-3 rounded-surface bg-hero p-6 ${className}`.trim()}
    >
      <span
        data-eyebrow
        className="text-label text-on-hero-dim"
      >
        {eyebrow}
      </span>

      <div className="flex items-baseline gap-2">
        <span data-lead className="text-metric-hero text-on-hero">
          {lead}
        </span>
        {leadUnit !== undefined && (
          <span className="text-label text-on-hero-dim">{leadUnit}</span>
        )}
      </div>

      {children !== undefined && (
        <>
          <div className="h-px bg-hero-line"></div>
          {children}
        </>
      )}
    </div>
  );
}
