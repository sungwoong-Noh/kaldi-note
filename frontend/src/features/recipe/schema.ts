import { z } from 'zod';

/**
 * 백엔드는 `default-property-inclusion: non_null`이라 **null인 필드는 키 자체가 없다.**
 * 그래서 전부 `.nullable()`이 아니라 `.optional()`이다. 이걸 틀리면 시드 레시피처럼 분쇄도가 비어 있는 데이터에서 파싱이 깨진다.
 */
export const recipeStepSchema = z.object({
  id: z.number(),
  stepOrder: z.number(),
  stepType: z.enum(['BLOOM', 'POUR', 'WAIT', 'SWIRL', 'STIR', 'DRAWDOWN']),
  startAtSeconds: z.number(),
  durationSeconds: z.number(),
  waterG: z.number().optional(),
  cumulativeWaterG: z.number().optional(),
  pourTechnique: z.enum(['CENTER', 'SPIRAL', 'PULSE', 'EDGE']).optional(),
  agitation: z.enum(['NONE', 'SWIRL', 'STIR']).optional(),
  note: z.string().optional(),
});

const recipeCommonShape = {
  id: z.number(),
  ownerUserId: z.number().optional(),
  sourceType: z.enum(['USER', 'CURATED']),
  title: z.string(),
  description: z.string().optional(),
  brewMethod: z.string(),
  visibility: z.enum(['PRIVATE', 'FRIENDS', 'PUBLIC']),
  parentRecipeId: z.number().optional(),
  forkRootId: z.number().optional(),
  doseG: z.number(),
  waterG: z.number(),
  ratio: z.number(),
  waterTempC: z.number().optional(),
  totalTimeSeconds: z.number().optional(),
  brewerId: z.number().optional(),
  filterId: z.number().optional(),
  grinderModelId: z.number().optional(),
  grindSettingValue: z.number().optional(),
  grindSettingUnit: z.enum(['CLICK', 'NUMBER', 'MICRON']).optional(),
  grindMicronEstimated: z.number().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
};

/** 목록 항목. 단건 응답에서 `steps`와 출처 3필드를 덜어낸 것. */
export const recipeSummarySchema = z.object(recipeCommonShape);

/** 단건 조회. 출처 표기와 푸어 스텝이 붙는다. */
export const recipeSchema = z.object({
  ...recipeCommonShape,
  authorName: z.string().optional(),
  sourceUrl: z.string().optional(),
  sourceNote: z.string().optional(),
  steps: z.array(recipeStepSchema).default([]),
});

/** 백엔드 `PageResponse<T>`. 여섯 키 고정이다. */
export function pageResponseSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    content: z.array(item),
    page: z.number(),
    size: z.number(),
    totalElements: z.number(),
    totalPages: z.number(),
    hasNext: z.boolean(),
  });
}

export const recipePageSchema = pageResponseSchema(recipeSummarySchema);

export type RecipeStep = z.infer<typeof recipeStepSchema>;
export type RecipeSummary = z.infer<typeof recipeSummarySchema>;
export type Recipe = z.infer<typeof recipeSchema>;
export type RecipePage = z.infer<typeof recipePageSchema>;
