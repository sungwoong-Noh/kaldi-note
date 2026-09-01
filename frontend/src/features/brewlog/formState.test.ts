import { describe, expect, it } from "vitest";
import { brewLogWithTds, grindedRecipe } from "@/test/fixtures";
import {
  formStateFromLog,
  initialFormState,
  toPatchBody,
  toRequestBody,
} from "./formState";
import { brewLogSchema } from "./schema";

/** 픽스처에서 키를 지운 응답을 만든다. `non_null` 정책이라 없는 값은 키 자체가 없다. */
function logWithout(...keys: string[]) {
  const raw: Record<string, unknown> = { ...brewLogWithTds };
  for (const key of keys) delete raw[key];
  return brewLogSchema.parse(raw);
}

describe("initialFormState", () => {
  it("레시피 값으로 초기화하고 추출 시간은 비운다", () => {
    const state = initialFormState(grindedRecipe, [
      { id: 5, grinderModelId: 1 },
    ]);

    expect(state).toMatchObject({
      recipeId: 16,
      actualDoseG: 20.0,
      actualWaterG: 300.0,
      actualWaterTempC: 92.0,
      // 레시피의 totalTimeSeconds(210)는 계획 시간이다. 실측인 양 저장하지 않는다.
      actualTotalTimeSeconds: null,
      userGrinderId: 5,
      actualGrindSettingValue: 22.0,
    });
  });

  it("같은 모델이 둘이면 id가 작은 쪽을 고른다", () => {
    const state = initialFormState(grindedRecipe, [
      { id: 8, grinderModelId: 1 },
      { id: 5, grinderModelId: 1 },
    ]);

    expect(state.userGrinderId).toBe(5);
  });

  it("같은 모델이 없으면 그라인더를 비워 둔다", () => {
    const state = initialFormState(grindedRecipe, [
      { id: 6, grinderModelId: 2 },
    ]);

    expect(state.userGrinderId).toBeNull();
  });

  it("레시피에 분쇄도가 없으면 설정값도 비어 있다", () => {
    // 시드 레시피가 이 모양이다 — `non_null` 정책이라 키 자체가 없다.
    const noGrind = { ...grindedRecipe };
    delete noGrind.grinderModelId;
    delete noGrind.grindSettingValue;

    const state = initialFormState(noGrind, [{ id: 5, grinderModelId: 1 }]);

    expect(state.userGrinderId).toBeNull();
    expect(state.actualGrindSettingValue).toBeNull();
  });

  it("5축 평가는 접힌 채로 시작한다", () => {
    const state = initialFormState(grindedRecipe, []);

    expect(state.sensoryExpanded).toBe(false);
  });
});

describe("toRequestBody", () => {
  const filled = {
    ...initialFormState(grindedRecipe, [{ id: 5, grinderModelId: 1 }]),
    brewedAt: "2026-08-31T09:00",
    beanBatchId: 9,
  };

  it("내린 시각을 ISO 문자열로 바꾼다", () => {
    expect(toRequestBody(filled).brewedAt).toBe("2026-08-31T09:00:00.000Z");
  });

  it("필수값만 채우면 그 키만 담는다", () => {
    expect(toRequestBody(filled)).toEqual({
      recipeId: 16,
      beanBatchId: 9,
      brewedAt: "2026-08-31T09:00:00.000Z",
      actualDoseG: 20.0,
      actualWaterG: 300.0,
      actualWaterTempC: 92.0,
      userGrinderId: 5,
      actualGrindSettingValue: 22.0,
    });
  });

  it("빈 값은 키째 빠지고 공개범위는 담지 않는다", () => {
    const body = toRequestBody({ ...filled, tdsPercent: null });

    expect(body).not.toHaveProperty("tdsPercent");
    expect(body).not.toHaveProperty("actualTotalTimeSeconds");
    // 백엔드가 PRIVATE으로 고정한다. 보내면 의미 없는 값을 우리가 정하는 셈이 된다.
    expect(body).not.toHaveProperty("visibility");
  });

  it("펼치지 않은 5축은 값이 있어도 빠진다", () => {
    const body = toRequestBody({
      ...filled,
      sensoryExpanded: false,
      acidity: 4,
      sweetness: 3,
    });

    expect(body).not.toHaveProperty("acidity");
    expect(body).not.toHaveProperty("sweetness");
  });

  it("펼친 5축은 고른 것만 담는다", () => {
    const body = toRequestBody({
      ...filled,
      sensoryExpanded: true,
      acidity: 4,
      sweetness: 3,
    });

    expect(body).toMatchObject({ acidity: 4, sweetness: 3 });
    expect(body).not.toHaveProperty("body");
  });

  it("메모는 비어 있으면 빠진다", () => {
    expect(toRequestBody({ ...filled, overallNote: "" })).not.toHaveProperty(
      "overallNote",
    );
    expect(toRequestBody({ ...filled, overallNote: "산미가 좋다" })).toMatchObject(
      { overallNote: "산미가 좋다" },
    );
  });
});

describe("toPatchBody", () => {
  const initial = formStateFromLog(brewLogSchema.parse(brewLogWithTds));

  it("아무것도 안 바꾸면 빈 객체다", () => {
    expect(toPatchBody(initial, initial)).toEqual({});
  });

  it("바꾼 것만 담는다", () => {
    expect(toPatchBody(initial, { ...initial, rating: 4.5 })).toEqual({
      rating: 4.5,
    });
  });

  it("공개범위도 담는다", () => {
    expect(toPatchBody(initial, { ...initial, visibility: "FRIENDS" })).toEqual({
      visibility: "FRIENDS",
    });
  });

  it("recipeId와 beanBatchId는 절대 담지 않는다", () => {
    const changed = {
      ...initial,
      recipeId: 99,
      beanBatchId: 99,
      rating: 4.5,
    };

    expect(toPatchBody(initial, changed)).toEqual({ rating: 4.5 });
  });

  it("brewedAt을 건드리지 않으면 담기지 않는다", () => {
    // 왕복(Instant → datetime-local → Instant)에서 초가 잘려도 거짓 변경이 생기면 안 된다
    expect(toPatchBody(initial, { ...initial })).not.toHaveProperty("brewedAt");
  });

  it("brewedAt을 바꾸면 Instant 문자열로 담는다", () => {
    const body = toPatchBody(initial, {
      ...initial,
      brewedAt: "2026-09-01T07:30",
    });

    expect(body.brewedAt).toBe(new Date("2026-09-01T07:30").toISOString());
  });

  it("비워진 값은 담지 않는다", () => {
    // 백엔드가 null을 "변경 없음"으로 읽어 보내봐야 소용이 없다
    expect(toPatchBody(initial, { ...initial, tdsPercent: null })).toEqual({});
  });
});

describe("formStateFromLog", () => {
  it("Instant를 datetime-local 문자열로 바꾼다", () => {
    const state = formStateFromLog(
      brewLogSchema.parse({ ...brewLogWithTds, brewedAt: "2026-08-31T09:00:00Z" }),
    );

    // 로컬 시각이라 실행 환경의 오프셋을 탄다 — 형식만 본다
    expect(state.brewedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it("5축이 하나라도 있으면 펼친 상태로 연다", () => {
    const state = formStateFromLog(
      brewLogSchema.parse({ ...brewLogWithTds, acidity: 4 }),
    );

    expect(state.sensoryExpanded).toBe(true);
  });

  it("5축이 하나도 없으면 접은 상태로 연다", () => {
    const state = formStateFromLog(
      logWithout("acidity", "sweetness", "body", "bitterness", "aftertaste"),
    );

    expect(state.sensoryExpanded).toBe(false);
  });

  it("없는 키는 null이 된다", () => {
    expect(formStateFromLog(logWithout("tdsPercent")).tdsPercent).toBeNull();
  });

  it("공개범위를 그대로 들고 온다", () => {
    expect(
      formStateFromLog(brewLogSchema.parse(brewLogWithTds)).visibility,
    ).toBe("PRIVATE");
  });
});
