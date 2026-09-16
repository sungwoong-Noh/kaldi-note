/**
 * 백엔드 enum을 화면 문구로 바꾼다 — docs/specs/2026-09-15-structure.md
 *
 * <p><b>enum 자체는 바꾸지 않는다.</b> 백엔드는 한 줄도 건드리지 않고 표시 계층에서만 옮긴다.
 *
 * <p>세 종류의 `IDEAL`이 모두 「적정」이다. 앞에 붙는 라벨(「농도」·「추출」·「가스」)이 맥락을 준다.
 */
const LABELS = {
  strength: { WEAK: "옅음", IDEAL: "적정", STRONG: "진함" },
  extraction: { UNDER: "부족", IDEAL: "적정", OVER: "과다" },
  degassing: {
    TOO_FRESH: "너무 신선함",
    IDEAL: "적정",
    PAST_PEAK: "정점 지남",
  },
  source: { CURATED: "기본 제공" },
} as const satisfies Record<string, Record<string, string>>;

export type StatusKind = keyof typeof LABELS;

/**
 * 모르는 값은 그대로 돌려준다.
 *
 * <p>백엔드가 enum을 늘려도 화면이 빈칸이 되지 않는다. 영어가 그대로 보이는 편이 아무것도
 * 안 보이는 것보다 낫다 — 적어도 무엇이 왔는지는 알 수 있다.
 */
export function statusLabel(kind: StatusKind, value: string): string {
  const table: Record<string, string> = LABELS[kind];
  return table[value] ?? value;
}
