import { describe, expect, it } from "vitest";
import {
  emptyFormState,
  fromRecipe,
  toRequestBody,
  validateRecipeForm,
} from "./formState";
import type { Recipe } from "./schema";

const kasuya: Recipe = {
  id: 3,
  ownerUserId: 7,
  sourceType: "USER",
  title: "Tetsu Kasuya 4:6 Method",
  description: "2016 World Brewers Cup 우승 방법론.",
  brewMethod: "POUR_OVER",
  visibility: "PUBLIC",
  doseG: 20.0,
  waterG: 300.0,
  ratio: 15.0,
  waterTempC: 92.0,
  totalTimeSeconds: 210,
  brewerId: 2,
  filterId: 2,
  temperatureType: "HOT",
  recommendedRoastLevel: "MEDIUM",
  savedCount: 0,
  brewCount: 0,
  createdAt: "2026-08-21T05:35:20.440335Z",
  updatedAt: "2026-08-21T05:35:20.440335Z",
  steps: [
    {
      stepOrder: 1,
      stepType: "BLOOM",
      startAtSeconds: 0,
      durationSeconds: 10,
      waterG: 60.0,
      cumulativeWaterG: 60.0,
      pourTechnique: "CENTER",
    },
    {
      stepOrder: 2,
      stepType: "POUR",
      startAtSeconds: 45,
      durationSeconds: 10,
      waterG: 240.0,
      cumulativeWaterG: 300.0,
      pourTechnique: "SPIRAL",
    },
  ],
};

describe("emptyFormState", () => {
  it("공개 범위는 PRIVATE으로 시작하고 스텝은 비어 있다", () => {
    const state = emptyFormState();

    expect(state.visibility).toBe("PRIVATE");
    expect(state.steps).toEqual([]);
    expect(state.title).toBe("");
  });
});

describe("fromRecipe", () => {
  it("서버 응답의 값을 그대로 옮긴다", () => {
    const state = fromRecipe(kasuya);

    expect(state).toMatchObject({
      title: "Tetsu Kasuya 4:6 Method",
      doseG: 20.0,
      waterG: 300.0,
      waterTempC: 92.0,
      totalTimeSeconds: 210,
      visibility: "PUBLIC",
      brewerId: 2,
    });
  });

  it("스텝마다 uid를 붙이고 서로 다르게 만든다", () => {
    const { steps } = fromRecipe(kasuya);

    expect(steps).toHaveLength(2);
    expect(steps[0].uid).not.toBe(steps[1].uid);
    expect(steps[0]).toMatchObject({
      stepType: "BLOOM",
      startAtSeconds: 0,
      waterG: 60.0,
    });
  });

  it("응답에 없는 키는 null이 된다", () => {
    const { grinderModelId, grindSettingValue } = fromRecipe(kasuya);

    expect(grinderModelId).toBeNull();
    expect(grindSettingValue).toBeNull();
  });
});

describe("toRequestBody", () => {
  it("최소 입력이면 세 필드와 공개 범위·온도·배전도, 빈 스텝만 담는다", () => {
    const state = {
      ...emptyFormState(),
      title: "아침 레시피",
      doseG: 15,
      waterG: 250,
    };

    expect(toRequestBody(state)).toEqual({
      title: "아침 레시피",
      doseG: 15,
      waterG: 250,
      visibility: "PRIVATE",
      temperatureType: "HOT",
      recommendedRoastLevel: "MEDIUM",
      steps: [],
    });
  });

  it("비어 있는 값은 키째 제외한다", () => {
    const state = {
      ...emptyFormState(),
      title: "제목",
      doseG: 15,
      waterG: 250,
    };

    const body = toRequestBody(state);

    expect(body).not.toHaveProperty("waterTempC");
    expect(body).not.toHaveProperty("description");
    expect(body).not.toHaveProperty("grinderModelId");
  });

  it("스텝에서 uid를 떼어내고 비어 있는 값도 제외한다", () => {
    const state = fromRecipe(kasuya);

    const body = toRequestBody(state);

    expect(body.steps[0]).toEqual({
      stepType: "BLOOM",
      startAtSeconds: 0,
      durationSeconds: 10,
      waterG: 60.0,
      pourTechnique: "CENTER",
    });
    expect(body.steps[0]).not.toHaveProperty("uid");
    expect(body.steps[0]).not.toHaveProperty("agitation");
  });

  it("stepOrder는 보내지 않는다 — 서버가 배열 순서로 부여한다", () => {
    const body = toRequestBody(fromRecipe(kasuya));

    expect(body.steps[1]).not.toHaveProperty("stepOrder");
  });
});

describe("온도·배전도", () => {
  it("AC-RECIPEEDIT-02 · 새 레시피는 HOT · 중배전으로 시작해 본문에 실린다", () => {
    const body = toRequestBody(emptyFormState());

    expect(body.temperatureType).toBe("HOT");
    expect(body.recommendedRoastLevel).toBe("MEDIUM");
  });

  it("AC-RECIPEEDIT-03 · 편집 저장이 서버 값(ICE · 약배전)을 그대로 보낸다", () => {
    const body = toRequestBody(
      fromRecipe({
        ...kasuya,
        temperatureType: "ICE",
        recommendedRoastLevel: "LIGHT",
      }),
    );

    expect(body.temperatureType).toBe("ICE");
    expect(body.recommendedRoastLevel).toBe("LIGHT");
  });
});

describe("validateRecipeForm", () => {
  it("제목 빈칸 · 원두 0.0 · 물 3200이면 세 필드 문구를 돌려준다", () => {
    expect(
      validateRecipeForm({
        ...emptyFormState(),
        title: "  ",
        doseG: 0,
        waterG: 3200,
      }),
    ).toEqual({
      title: "제목을 입력해 주세요.",
      doseG: "1.0–200.0 g 사이로 입력해 주세요.",
      waterG: "3000 g 이하로 입력해 주세요.",
    });
  });

  it("물이 비었거나 10.0 미만이면 하한 문구", () => {
    const base = { ...emptyFormState(), title: "a", doseG: 15 };
    expect(validateRecipeForm({ ...base, waterG: null }).waterG).toBe(
      "10.0 g 이상 입력해 주세요.",
    );
    expect(validateRecipeForm({ ...base, waterG: 9.9 }).waterG).toBe(
      "10.0 g 이상 입력해 주세요.",
    );
  });

  it("경계값 1.0 · 200.0 · 10.0 · 3000.0은 통과한다", () => {
    const base = { ...emptyFormState(), title: "a" };
    expect(validateRecipeForm({ ...base, doseG: 1, waterG: 10 })).toEqual({});
    expect(validateRecipeForm({ ...base, doseG: 200, waterG: 3000 })).toEqual(
      {},
    );
  });
});
