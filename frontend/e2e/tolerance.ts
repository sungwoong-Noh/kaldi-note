/** 좌표 비교의 기본 허용 오차. 브라우저가 서브픽셀로 계산해 766.5 같은 값이 나온다. */
const DEFAULT_TOLERANCE = 1;

/** `actual`이 `expected`와 `tolerance` 이내로 같은가. */
export function withinTolerance(
  actual: number,
  expected: number,
  tolerance: number = DEFAULT_TOLERANCE,
): boolean {
  return Math.abs(actual - expected) <= tolerance;
}

/**
 * `actual`이 `limit`을 `tolerance` 넘게 초과하지 않는가.
 *
 * 가로 스크롤과 겹침 판정에 쓴다 — 모자란 쪽은 문제가 아니므로 한쪽만 본다.
 */
export function notBelow(
  actual: number,
  limit: number,
  tolerance: number = DEFAULT_TOLERANCE,
): boolean {
  return actual - limit <= tolerance;
}
