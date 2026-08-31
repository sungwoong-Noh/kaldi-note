import { z } from "zod";

export const brewerSchema = z.object({
  id: z.number(),
  brand: z.string(),
  name: z.string(),
  type: z.string().optional(),
  isSystem: z.boolean().optional(),
});

export const brewFilterSchema = z.object({
  id: z.number(),
  name: z.string(),
  material: z.string().optional(),
  shape: z.string().optional(),
  isSystem: z.boolean().optional(),
});

/**
 * 그라인더 모델. **`micronsPerClick`은 환산 불가 모델에서 키 자체가 없다**(`non_null` 정책).
 *
 * <p>영점 보정(`zeroPointOffsetClicks`)은 응답에 없다 — 그래서 프론트가 마이크론을 직접 곱해 구할 수 없고, 환산 API를 불러야 한다.
 */
export const grinderModelSchema = z.object({
  id: z.number(),
  brand: z.string(),
  name: z.string(),
  adjustmentType: z.string(),
  micronsPerClick: z.number().optional(),
  minSetting: z.number().optional(),
  maxSetting: z.number().optional(),
  burrType: z.string().optional(),
  convertible: z.boolean(),
  isSystem: z.boolean().optional(),
});

/**
 * 내가 등록한 그라인더. **모델의 브랜드·이름이 함께 실려 온다** — 선택란을 그리려고 마스터 목록을 따로 부를 필요가 없다.
 *
 * <p>`micronsPerClick`은 모델이 환산 불가면 키가 없고, `nickname`도 넣지 않으면 키가 없다(`non_null` 정책).
 */
export const userGrinderSchema = z.object({
  id: z.number(),
  grinderModelId: z.number(),
  brand: z.string(),
  grinderModelName: z.string(),
  micronsPerClick: z.number().optional(),
  nickname: z.string().optional(),
  calibrationOffsetClicks: z.number(),
  isDefault: z.boolean(),
});

/** 환산 응답. 미리보기는 `micron`만 쓴다 — source와 target이 같은 그라인더라 나머지는 의미가 없다. */
export const grindConversionSchema = z.object({
  sourceSetting: z.number(),
  micron: z.number(),
  targetSetting: z.number().optional(),
  targetOutOfRange: z.boolean().optional(),
  estimated: z.boolean().optional(),
  warning: z.string().optional(),
});

export const brewerListSchema = z.array(brewerSchema);
export const brewFilterListSchema = z.array(brewFilterSchema);
export const grinderModelListSchema = z.array(grinderModelSchema);
/** 페이지 봉투가 아니라 배열이다 — 2026-08-31에 실제 응답으로 확인했다. */
export const userGrinderListSchema = z.array(userGrinderSchema);

export type Brewer = z.infer<typeof brewerSchema>;
export type BrewFilter = z.infer<typeof brewFilterSchema>;
export type GrinderModel = z.infer<typeof grinderModelSchema>;
export type GrindConversion = z.infer<typeof grindConversionSchema>;
export type UserGrinder = z.infer<typeof userGrinderSchema>;
