import { describe, expect, it } from "vitest";
import { emptyFormState, fromRecipe, toRequestBody } from "./formState";
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
    expect(steps[0]).toMatchObject({ stepType: "BLOOM", startAtSeconds: 0, waterG: 60.0 });
  });

  it("응답에 없는 키는 null이 된다", () => {
    const { grinderModelId, grindSettingValue } = fromRecipe(kasuya);

    expect(grinderModelId).toBeNull();
    expect(grindSettingValue).toBeNull();
  });
});

describe("toRequestBody", () => {
  it("최소 입력이면 세 필드와 공개 범위, 빈 스텝만 담는다", () => {
    const state = { ...emptyFormState(), title: "아침 레시피", doseG: 15, waterG: 250 };

    expect(toRequestBody(state)).toEqual({
      title: "아침 레시피",
      doseG: 15,
      waterG: 250,
      visibility: "PRIVATE",
      steps: [],
    });
  });

  it("비어 있는 값은 키째 제외한다", () => {
    const state = { ...emptyFormState(), title: "제목", doseG: 15, waterG: 250 };

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
