import { toKstDate } from "./kstDate";
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

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

/**
 * 원장 날짜 — `08.31` + `월`. 올해(KST)가 아니면 `2025.09.19`처럼 연도를 붙인다
 * (docs/specs/2026-10-10-my-cups-ledger.md AC-MYCUPS-13). 요일은 웹 표에서 흐리게 그리려고 따로 준다.
 */
export function formatLedgerDate(
  brewedAt: string,
  kstToday: string,
): { date: string; weekday: string } {
  const kst = toKstDate(brewedAt);
  const [year, month, day] = kst.split("-");
  const weekday = WEEKDAYS[new Date(`${kst}T00:00:00Z`).getUTCDay()];
  const sameYear = year === kstToday.slice(0, 4);
  return { date: sameYear ? `${month}.${day}` : `${year}.${month}.${day}`, weekday };
}

const MIN_SEC = /^([0-5]?\d):([0-5]\d)$/;

/** `3:30` → 210. 빈칸은 `null`(값 없음), 형식이 틀리면 `"invalid"`. 범위는 `0:00`~`59:59`. */
export function parseMinSec(text: string): number | null | "invalid" {
  if (text === "") return null;
  const match = MIN_SEC.exec(text);
  if (!match) return "invalid";
  return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * `numerator / denominator`를 소수 1자리 HALF_UP으로. 둘 다 정수여야 한다.
 *
 * <p>부동소수로 나눈 뒤 `toFixed(1)`를 쓰면 `267 / 20 = 13.35`가 `13.3499…`로 표현돼 `13.3`이 된다.
 * 정수끼리 반올림해서 그 오차를 피한다.
 */
export function roundHalfUp1(numerator: number, denominator: number): string {
  return (
    Math.floor((20 * numerator + denominator) / (2 * denominator)) / 10
  ).toFixed(1);
}

/** 소수 1자리까지만 받는 중량에 10을 곱해 정수로 만든다. */
export const tenths = (value: number) => Math.round(value * 10);
