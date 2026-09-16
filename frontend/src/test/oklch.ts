/**
 * oklch 색을 WCAG 상대 휘도로 옮긴다.
 *
 * <p>토큰이 hex에서 oklch로 바뀌면서 필요해졌다(`docs/specs/2026-09-17-design-system-v2.md`).
 * `contrast.ts`의 hex 경로는 그대로 남는다 — 카카오 브랜드 색처럼 hex로 박힌 값이 아직 있다.
 *
 * <p>변환은 oklch → oklab → 선형 sRGB → 상대 휘도 순이다. 계수는 Björn Ottosson의
 * oklab 정의값이고, **손으로 고치지 않는다.**
 */

export interface Oklch {
  L: number;
  C: number;
  h: number;
}

/** `oklch(0.50 0.18 28)` → `{ L: 0.5, C: 0.18, h: 28 }`. 공백은 몇 개든 된다. */
export function parseOklch(value: string): Oklch {
  const match = value.match(
    /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/,
  );
  if (match === null) {
    throw new Error(`oklch 형식이 아니다: ${value}`);
  }
  return { L: Number(match[1]), C: Number(match[2]), h: Number(match[3]) };
}

/**
 * 선형 sRGB 채널값 3개. 색역을 벗어나면 [0, 1]로 자른다.
 *
 * <p>자르는 이유는 브라우저가 그렇게 렌더하기 때문이다. 자르지 않으면 화면에 보이지 않는
 * 색으로 대비를 계산하게 된다.
 */
function linearRgb({ L, C, h }: Oklch): [number, number, number] {
  const rad = (h * Math.PI) / 180;
  const a = C * Math.cos(rad);
  const b = C * Math.sin(rad);

  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;

  const clamp = (value: number): number => Math.min(1, Math.max(0, value));
  return [
    clamp(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    clamp(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    clamp(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

/** WCAG 2.1 상대 휘도. 선형 채널을 그대로 가중합한다 — 감마를 다시 씌우지 않는다. */
export function oklchLuminance(color: Oklch): number {
  const [r, g, b] = linearRgb(color);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
