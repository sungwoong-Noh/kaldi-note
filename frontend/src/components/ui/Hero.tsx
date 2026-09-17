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
 *
 * <p><b>테두리가 필요한 이유:</b> 라이트에서는 판이 배경과 16.86:1로 또렷하지만
 * 다크에서는 `paper`(0.17)와 판(0.22)이 **1.1:1**이라 사실상 안 보인다(2026-09-17 실측).
 * 배경 명도만으로는 두 모드를 다 만족시킬 수 없어 `hero-line` 테두리로 윤곽을 준다 —
 * 다크 배경 대비 1.62:1로 판이 드러나고, 라이트에서는 이미 또렷한 판의 안쪽 경계가 된다.
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
      className={`flex flex-col gap-3 rounded-surface border border-hero-line bg-hero p-6 ${className}`.trim()}
    >
      <span
        data-eyebrow
        className="text-label text-on-hero-dim"
      >
        {eyebrow}
      </span>

      <div className="flex items-baseline gap-2">
        <span data-lead className="text-metric-hero font-medium text-on-hero">
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
