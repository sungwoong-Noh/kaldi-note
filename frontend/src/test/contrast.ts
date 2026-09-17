/** WCAG 2.1 상대 휘도. sRGB 채널을 선형화해 가중합한다. */
function channel(value: number): number {
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map(
    (index) => parseInt(hex.slice(index, index + 2), 16) / 255,
  );
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * 휘도 두 개의 대비. 색 표현과 무관하므로 hex·oklch 양쪽이 이것을 공유한다.
 *
 * <p>oklch 휘도는 `oklch.ts`의 `oklchLuminance`가 만든다.
 */
export function ratioOf(lumA: number, lumB: number): number {
  const [high, low] = [lumA, lumB].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

export function contrastRatio(a: string, b: string): number {
  return ratioOf(luminance(a), luminance(b));
}
