/**
 * 브루잉 로그 폼의 상태와, 레시피·요청 사이의 변환.
 *
 * <p>쓰기 슬라이스와 같은 방식이다 — `useState` 하나로 들고, 빈 값은 요청에서 키째 뺀다(`features/recipe/formState.ts`).
 */

import type { Recipe } from "../recipe/schema";
import type { UserGrinder } from "../gear/schema";

/** 그라인더 자동 선택에 실제로 필요한 두 필드. 인라인 객체로도 부를 수 있게 좁혀 둔다. */
export type GrinderChoice = Pick<UserGrinder, "id" | "grinderModelId">;

/** 비어 있는 숫자 입력은 `null`이다. 0과 구분해야 한다 — 0은 사용자가 실제로 넣은 값이다. */
export type BrewLogFormState = {
  recipeId: number;
  /** `datetime-local` 입력값. `2026-08-31T09:00` 형태의 **로컬 시각** 문자열이다 */
  brewedAt: string;
  beanBatchId: number | null;
  userGrinderId: number | null;
  actualGrindSettingValue: number | null;
  actualDoseG: number | null;
  actualWaterG: number | null;
  actualWaterTempC: number | null;
  actualTotalTimeSeconds: number | null;
  actualDrawdownSeconds: number | null;
  beverageWeightG: number | null;
  tdsPercent: number | null;
  rating: number | null;
  overallNote: string;
  /** `맛 자세히`를 펼쳤는가. 접힌 채로 저장하면 5축을 요청에 담지 않는다 */
  sensoryExpanded: boolean;
  acidity: number | null;
  sweetness: number | null;
  body: number | null;
  bitterness: number | null;
  aftertaste: number | null;
};

/**
 * `datetime-local` 입력이 읽는 형식으로 바꾼다.
 *
 * <p>`toISOString()`을 쓰면 UTC로 바뀌어 사용자가 보는 시각과 어긋난다. 입력칸은 로컬 시각을 보여줘야 한다.
 */
export function toDateTimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/**
 * 레시피와 내 그라인더 목록으로 폼의 초기 상태를 만든다.
 *
 * <p><b>추출 시간은 비운다.</b> 레시피의 `totalTimeSeconds`는 "이렇게 내릴 것"이지 실측이 아니다. 미리 채우면
 * 사용자가 그대로 저장했을 때 계획 시간이 기록으로 둔갑한다.
 *
 * <p>그라인더는 레시피와 **같은 모델 중 `id`가 가장 작은 것**(먼저 등록한 것)을 고른다. 없으면 비워 둔다.
 */
export function initialFormState(
  recipe: Recipe,
  grinders: readonly GrinderChoice[],
  now: Date = new Date(),
): BrewLogFormState {
  const matched = grinders
    .filter((g) => g.grinderModelId === recipe.grinderModelId)
    .reduce<GrinderChoice | null>(
      (best, g) => (best === null || g.id < best.id ? g : best),
      null,
    );

  return {
    recipeId: recipe.id,
    brewedAt: toDateTimeLocal(now),
    beanBatchId: null,
    userGrinderId: matched?.id ?? null,
    // 그라인더를 못 고르면 설정값도 의미가 없다 — 어느 그라인더의 22클릭인지 알 수 없다.
    actualGrindSettingValue:
      matched === null ? null : (recipe.grindSettingValue ?? null),
    actualDoseG: recipe.doseG,
    actualWaterG: recipe.waterG,
    actualWaterTempC: recipe.waterTempC ?? null,
    actualTotalTimeSeconds: null,
    actualDrawdownSeconds: null,
    beverageWeightG: null,
    tdsPercent: null,
    rating: null,
    overallNote: "",
    sensoryExpanded: false,
    acidity: null,
    sweetness: null,
    body: null,
    bitterness: null,
    aftertaste: null,
  };
}

export type BrewLogRequestBody = {
  recipeId: number;
  beanBatchId?: number;
  brewedAt?: string;
  userGrinderId?: number;
  actualGrindSettingValue?: number;
  actualDoseG?: number;
  actualWaterG?: number;
  actualWaterTempC?: number;
  actualTotalTimeSeconds?: number;
  actualDrawdownSeconds?: number;
  beverageWeightG?: number;
  tdsPercent?: number;
  rating?: number;
  overallNote?: string;
  acidity?: number;
  sweetness?: number;
  body?: number;
  bitterness?: number;
  aftertaste?: number;
};

/** 값이 있을 때만 키를 만든다. 백엔드가 `non_null`로 응답하는 것과 대칭이다. */
function omitEmpty<T extends object>(entries: [string, unknown][]): T {
  return Object.fromEntries(
    entries.filter(([, value]) => value !== null && value !== ""),
  ) as T;
}

/**
 * 폼 상태를 요청 본문으로 만든다.
 *
 * <p><b>`visibility`는 담지 않는다.</b> 백엔드가 `PRIVATE`으로 고정한다.
 *
 * <p><b>5축은 펼쳤을 때만 담는다.</b> 접어둔 채 저장하면 사용자가 평가한 적이 없다는 뜻이다.
 */
export function toRequestBody(state: BrewLogFormState): BrewLogRequestBody {
  const sensory = state.sensoryExpanded
    ? [
        ["acidity", state.acidity] as [string, unknown],
        ["sweetness", state.sweetness] as [string, unknown],
        ["body", state.body] as [string, unknown],
        ["bitterness", state.bitterness] as [string, unknown],
        ["aftertaste", state.aftertaste] as [string, unknown],
      ]
    : [];

  return omitEmpty<BrewLogRequestBody>([
    ["recipeId", state.recipeId],
    ["beanBatchId", state.beanBatchId],
    ["brewedAt", toInstant(state.brewedAt)],
    ["userGrinderId", state.userGrinderId],
    ["actualGrindSettingValue", state.actualGrindSettingValue],
    ["actualDoseG", state.actualDoseG],
    ["actualWaterG", state.actualWaterG],
    ["actualWaterTempC", state.actualWaterTempC],
    ["actualTotalTimeSeconds", state.actualTotalTimeSeconds],
    ["actualDrawdownSeconds", state.actualDrawdownSeconds],
    ["beverageWeightG", state.beverageWeightG],
    ["tdsPercent", state.tdsPercent],
    ["rating", state.rating],
    ["overallNote", state.overallNote],
    ...sensory,
  ]);
}

/**
 * `datetime-local` 값을 백엔드가 받는 `Instant` 문자열로 바꾼다.
 *
 * <p>비어 있으면 `null`을 돌려 키째 빠지게 한다 — `new Date("")`는 `Invalid Date`이고 `toISOString()`이 던진다.
 */
function toInstant(local: string): string | null {
  if (local === "") return null;
  const parsed = new Date(local);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
