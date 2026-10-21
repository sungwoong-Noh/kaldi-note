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
import { DOSE_RANGE, WATER_RANGE } from "./preview";
import type { Recipe } from "./schema";

export type Visibility = "PRIVATE" | "FRIENDS" | "PUBLIC";
export type GrindSettingUnit = "CLICK" | "NUMBER" | "MICRON";
export type TemperatureType = Recipe["temperatureType"];
export type RoastLevel = Recipe["recommendedRoastLevel"];

/** 비어 있는 숫자 입력은 `null`이다. 0과 구분해야 한다 — 0은 사용자가 실제로 넣은 값이다. */
export type RecipeFormState = {
  title: string;
  description: string;
  doseG: number | null;
  waterG: number | null;
  waterTempC: number | null;
  totalTimeSeconds: number | null;
  visibility: Visibility;
  temperatureType: TemperatureType;
  recommendedRoastLevel: RoastLevel;
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
    // 서버가 값이 없을 때 채우는 기본값과 같다.
    temperatureType: "HOT",
    recommendedRoastLevel: "MEDIUM",
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
    temperatureType: recipe.temperatureType,
    recommendedRoastLevel: recipe.recommendedRoastLevel,
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
  // 빠뜨리면 서버가 HOT·MEDIUM으로 덮는다 — 편집 저장이 ICE·약배전을 지우던 원인이다.
  temperatureType: TemperatureType;
  recommendedRoastLevel: RoastLevel;
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
    ["temperatureType", state.temperatureType],
    ["recommendedRoastLevel", state.recommendedRoastLevel],
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

export type RecipeFormErrors = Partial<
  Record<"title" | "doseG" | "waterG", string>
>;

/**
 * 저장 전 클라이언트 검증 — 제목·원두·물 셋만 본다(목업 S3). 나머지는 서버 필드 오류가 그 필드에 붙는다.
 * 범위는 서버 DTO와 같다.
 */
export function validateRecipeForm(state: RecipeFormState): RecipeFormErrors {
  const errors: RecipeFormErrors = {};
  if (state.title.trim() === "") errors.title = "제목을 입력해 주세요.";

  const dose = state.doseG;
  if (dose === null || dose < DOSE_RANGE.min || dose > DOSE_RANGE.max) {
    errors.doseG = "1.0–200.0 g 사이로 입력해 주세요.";
  }

  const water = state.waterG;
  if (water === null || water < WATER_RANGE.min) {
    errors.waterG = "10.0 g 이상 입력해 주세요.";
  } else if (water > WATER_RANGE.max) {
    errors.waterG = "3000 g 이하로 입력해 주세요.";
  }
  return errors;
}
