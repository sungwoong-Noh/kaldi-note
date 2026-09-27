/**
 * 표시 형식을 한곳에 모은다.
 *
 * <p>계산은 하지 않는다 — `ratio` 같은 파생값은 서버가 반올림해서 주고, 프론트는 그것을 그대로 표시한다. 두 곳에서 반올림하면 언젠가 어긋난다.
 */

/** 초를 `m:ss`로. 10분을 넘겨도 분 자릿수를 늘리지 않는다. */
export function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** 소수점 이하가 0이면 지운다. `100.0` → `100`, `93.5` → `93.5` */
function trimTrailingZero(value: number): string {
  return value.toFixed(1).replace(/\.0$/, "");
}

/*
 * 표기가 둘이다 — docs/specs/2026-09-27-web-shell-grammar.md(AC-GRAMMAR-06·07).
 * 값 하나가 한 칸을 차지하는 자리(히어로·원장 행·비교표 셀)는 `16 g`, 여러 값을 한 줄로
 * 잇는 요약 줄(`16g → 250g · 92°C · 3:30`)과 배지는 붙여 쓴다. 목업이 그렇게 갈라 쓴다.
 */

export function formatGrams(grams: number): string {
  return `${trimTrailingZero(grams)} g`;
}

export function formatGramsCompact(grams: number): string {
  return `${trimTrailingZero(grams)}g`;
}

/** 브루 비율. 서버가 준 N을 `1:N`으로 감싸기만 한다. */
export function formatRatio(ratio: number): string {
  return `1:${ratio.toFixed(1)}`;
}

export function formatTemperature(celsius: number): string {
  return `${trimTrailingZero(celsius)} °C`;
}

export function formatTemperatureCompact(celsius: number): string {
  return `${trimTrailingZero(celsius)}°C`;
}
