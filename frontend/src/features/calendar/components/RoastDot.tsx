import type { RoastLevel } from "@/features/catalog/schema";

/**
 * 로스팅 강도를 명도로 표현하는 점. 채도·색상은 고정하고 명도만 바꾼다
 * (docs/design/design_handoff_kaldi_note/README.md 「Roast dot」).
 */
const ROAST_COLOR: Record<RoastLevel, string> = {
  LIGHT: "oklch(0.72 0.05 60)",
  MEDIUM_LIGHT: "oklch(0.62 0.06 55)",
  MEDIUM: "oklch(0.55 0.07 55)",
  MEDIUM_DARK: "oklch(0.5 0.07 50)",
  DARK: "oklch(0.4 0.05 45)",
};

/** 원두를 연결하지 않은 기록은 아무것도 렌더하지 않는다(AC-HOMECAL-76). */
export function RoastDot({ roastLevel }: { roastLevel?: RoastLevel }) {
  if (roastLevel === undefined) return null;

  return (
    <span
      data-roast-dot
      aria-hidden
      style={{
        display: "inline-block",
        width: 9,
        height: 9,
        borderRadius: "50%",
        backgroundColor: ROAST_COLOR[roastLevel],
      }}
    />
  );
}
