import type { FieldError } from "./api-client";

/** 폼에 입력칸이 있는 필드. 여기 없는 이름은 붙일 자리가 없으므로 상단 요약으로 보낸다. */
const KNOWN_FIELDS = new Set([
  "title",
  "description",
  "doseG",
  "waterG",
  "waterTempC",
  "totalTimeSeconds",
  "visibility",
  "brewerId",
  "filterId",
  "grinderModelId",
  "grindSettingUnit",
  "grindSettingValue",
]);

/** `steps[2].waterG`처럼 배열 인덱스를 가진 필드. */
const STEP_FIELD = /^steps\[(\d+)\]\./;

export type MappedFieldErrors = {
  /** 입력칸 이름 → 메시지 */
  byField: Record<string, string>;
  /** 스텝 인덱스(0부터) → 메시지. 화면의 스텝 번호는 여기에 1을 더한 값이다 */
  byStepIndex: Record<number, string>;
  /** 붙일 자리를 못 찾은 것. 조용히 버리면 사용자는 왜 저장이 안 되는지 알 수 없다 */
  unmapped: string[];
};

/**
 * 서버가 준 `fieldErrors`를 폼의 각 자리에 나눠 담는다.
 *
 * <p>한 필드에 오류가 둘 이상 오면 줄바꿈으로 잇는다 — 먼저 온 것을 덮어쓰면 사용자가 고쳐도 다음 오류가 새로 나타나 두 번 왕복하게 된다.
 */
export function mapFieldErrors(errors: FieldError[]): MappedFieldErrors {
  const result: MappedFieldErrors = {
    byField: {},
    byStepIndex: {},
    unmapped: [],
  };

  for (const { field, message } of errors) {
    const stepMatch = STEP_FIELD.exec(field);

    if (stepMatch) {
      const index = Number(stepMatch[1]);
      result.byStepIndex[index] = append(result.byStepIndex[index], message);
      continue;
    }

    if (KNOWN_FIELDS.has(field)) {
      result.byField[field] = append(result.byField[field], message);
      continue;
    }

    result.unmapped.push(`${field}: ${message}`);
  }

  return result;
}

function append(existing: string | undefined, message: string): string {
  return existing ? `${existing}\n${message}` : message;
}
