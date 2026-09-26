import { formatGrams, formatTemperature } from "@/lib/format";

/**
 * 비교표의 차이를 한국어 문장으로 옮긴다 — docs/specs/2026-09-17-small-features.md
 *
 * <p>「같은 레시피를 여러 번 내렸을 때 결과 차이를 추적하는 것이 이 서비스의 존재 이유」인데
 * (CLAUDE.md), 비교표가 다른 값에 색만 칠하면 **얼마나 달랐는지를 사용자가 암산**해야 한다.
 *
 * <p><b>평가하지 않는다.</b> 「1.0g 더 썼습니다」이지 「너무 많습니다」가 아니다 —
 * 브랜드 문서의 목소리 규칙이고, 「앱은 커피가 맛있었는지 판단하지 않는다」는 원칙이다.
 *
 * <p>표기는 기존 포맷터를 그대로 쓴다. 여기서 새 표기를 만들면 표의 숫자와 문장의 숫자가
 * 달라 보인다.
 */
export type DiffKind = "weight" | "temperature" | "duration";

/**
 * 시간 **차이**는 `formatDuration`을 쓰지 않는다.
 *
 * <p>그 포맷터는 `3:30`처럼 **시점**을 적는 것이라 15초 차이가 `0:15`로 나온다 —
 * 「0:15 빨리 끝났습니다」는 읽히지 않는다. 차이는 초·분으로 말한다.
 */
function gapDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}초`;

  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes}분` : `${minutes}분 ${rest}초`;
}

/** 받침이 있으면 `을`, 없으면 `를`. 한글 음절은 (코드 - 0xAC00) % 28로 종성을 판정한다. */
function objectParticle(word: string): string {
  const last = word.at(-1);
  if (last === undefined) return "를";

  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return "를";

  return (code - 0xac00) % 28 === 0 ? "를" : "을";
}

/**
 * @param subject 무게에만 쓰는 주어("원두"·"물"). 온도·시간은 문장에 주어가 없다.
 * @returns 차이가 없거나 비교할 기준값이 없으면 `null` — 화면은 아무것도 그리지 않는다.
 */
export function diffPhrase(
  kind: DiffKind,
  subject: string,
  target: number | undefined,
  actual: number | undefined,
): string | null {
  if (target === undefined || actual === undefined) return null;
  if (target === actual) return null;

  const more = actual > target;
  const gap = Math.abs(actual - target);

  switch (kind) {
    case "weight":
      return `${subject}${objectParticle(subject)} ${formatGrams(gap)} ${more ? "더" : "덜"} 썼습니다.`;
    case "temperature":
      return `${formatTemperature(gap)} ${more ? "높게" : "낮게"} 내렸습니다.`;
    case "duration":
      return `${gapDuration(gap)} ${more ? "늦게" : "빨리"} 끝났습니다.`;
  }
}
