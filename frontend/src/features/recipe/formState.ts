/**
 * 레시피 폼의 상태와, 서버 응답·요청 사이의 변환.
 *
 * <p>폼은 `useState` 하나로 관리한다. 스텝 배열의 밀기·당기기가 이 화면의 본체인데(`stepSequence.ts`), 폼 라이브러리의 필드 배열 위에 그
 * 변환을 얹으면 상태가 두 군데 생긴다. 검증도 서버가 하므로 클라이언트 검증 기능은 거의 쓸 일이 없다.
 */

import {
  isPouringStep,
  type EditableStep,
  type StepType,
} from "./stepSequence";
import type { Recipe } from "./schema";

export type Visibility = "PRIVATE" | "FRIENDS" | "PUBLIC";
export type GrindSettingUnit = "CLICK" | "NUMBER" | "MICRON";

/** 비어 있는 숫자 입력은 `null`이다. 0과 구분해야 한다 — 0은 사용자가 실제로 넣은 값이다. */
export type RecipeFormState = {
  title: string;
  description: string;
  doseG: number | null;
  waterG: number | null;
  waterTempC: number | null;
  totalTimeSeconds: number | null;
  visibility: Visibility;
  brewerId: number | null;
  filterId: number | null;
  grinderModelId: number | null;
  grindSettingUnit: GrindSettingUnit | null;
  grindSettingValue: number | null;
  steps: EditableStep[];
};

export function emptyFormState(): RecipeFormState {
  return {
    title: "",
    description: "",
    doseG: null,
    waterG: null,
    waterTempC: null,
    totalTimeSeconds: null,
    // 기본은 나만 보기다. 공개로 시작하면 실수로 남에게 보이는 쪽이 기본값이 된다.
    visibility: "PRIVATE",
    brewerId: null,
    filterId: null,
    grinderModelId: null,
    grindSettingUnit: null,
    grindSettingValue: null,
    steps: [],
  };
}

let uidCounter = 0;

function nextUid(): string {
  uidCounter += 1;
  return `loaded-${uidCounter}`;
}

/**
 * 서버 응답을 폼 상태로 옮긴다.
 *
 * <p>백엔드는 `non_null` 정책이라 <b>null인 필드는 키 자체가 없다.</b> 그래서 `?? null`로 받는다.
 */
export function fromRecipe(recipe: Recipe): RecipeFormState {
  return {
    title: recipe.title,
    description: recipe.description ?? "",
    doseG: recipe.doseG,
    waterG: recipe.waterG,
    waterTempC: recipe.waterTempC ?? null,
    totalTimeSeconds: recipe.totalTimeSeconds ?? null,
    visibility: recipe.visibility,
    brewerId: recipe.brewerId ?? null,
    filterId: recipe.filterId ?? null,
    grinderModelId: recipe.grinderModelId ?? null,
    grindSettingUnit: recipe.grindSettingUnit ?? null,
    grindSettingValue: recipe.grindSettingValue ?? null,
    steps: recipe.steps.map((step) => ({
      uid: nextUid(),
      stepType: step.stepType,
      startAtSeconds: step.startAtSeconds,
      durationSeconds: step.durationSeconds,
      waterG: step.waterG ?? null,
      pourTechnique: step.pourTechnique ?? null,
      agitation: step.agitation ?? null,
      note: step.note ?? null,
    })),
  };
}

export type RecipeStepRequest = {
  stepType: StepType;
  startAtSeconds: number;
  durationSeconds: number;
  waterG?: number;
  pourTechnique?: string;
  agitation?: string;
  note?: string;
};

export type RecipeRequestBody = {
  title: string;
  visibility: Visibility;
  steps: RecipeStepRequest[];
  description?: string;
  doseG?: number;
  waterG?: number;
  waterTempC?: number;
  totalTimeSeconds?: number;
  brewerId?: number;
  filterId?: number;
  grinderModelId?: number;
  grindSettingUnit?: GrindSettingUnit;
  grindSettingValue?: number;
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
 * <p><b>비어 있는 값은 키째 뺀다.</b> `waterTempC: null`을 실어 보내면 "지우겠다"는 뜻인지 "안 넣었다"는 뜻인지 서버가 구분할 수 없다.
 *
 * <p><b>`stepOrder`는 보내지 않는다.</b> 서버가 배열 순서로 1부터 부여한다(레시피 CRUD 스펙의 `RECIPE-04`).
 */
export function toRequestBody(state: RecipeFormState): RecipeRequestBody {
  const scalars = omitEmpty<Omit<RecipeRequestBody, "steps">>([
    ["title", state.title],
    ["description", state.description],
    ["doseG", state.doseG],
    ["waterG", state.waterG],
    ["waterTempC", state.waterTempC],
    ["totalTimeSeconds", state.totalTimeSeconds],
    ["visibility", state.visibility],
    ["brewerId", state.brewerId],
    ["filterId", state.filterId],
    ["grinderModelId", state.grinderModelId],
    ["grindSettingUnit", state.grindSettingUnit],
    ["grindSettingValue", state.grindSettingValue],
  ]);

  return {
    ...scalars,
    steps: state.steps.map((step) =>
      omitEmpty<RecipeStepRequest>([
        ["stepType", step.stepType],
        ["startAtSeconds", step.startAtSeconds],
        ["durationSeconds", step.durationSeconds],
        // 붓지 않는 스텝에 물량을 실으면 서버가 RECIPE_STEP_WATER_INVALID로 거부한다.
        ["waterG", isPouringStep(step) ? step.waterG : null],
        ["pourTechnique", step.pourTechnique],
        ["agitation", step.agitation],
        ["note", step.note],
      ]),
    ),
  };
}
