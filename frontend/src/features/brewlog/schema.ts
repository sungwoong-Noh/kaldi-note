import { z } from "zod";
import { pageResponseSchema } from "../recipe/schema";

/**
 * 브루잉 로그. **추출 분석 4필드는 TDS가 없으면 키 자체가 없다** — 다만 `diagnosis`는
 * "TDS가 없어 계산할 수 없다"는 안내로 항상 온다. 분석 영역을 그릴지의 기준은 `tdsPercent`다.
 */
const brewLogShape = {
  id: z.number(),
  userId: z.number(),
  recipeId: z.number(),
  beanBatchId: z.number().optional(),
  brewedAt: z.string(),
  // 2026-09-02 실제 응답으로 확인했다 — 백엔드 `BrewLogVisibility`에 값이 셋뿐이다.
  visibility: z.enum(["PRIVATE", "FRIENDS", "PUBLIC"]),
  actualDoseG: z.number(),
  actualWaterG: z.number(),
  actualWaterTempC: z.number(),
  actualTotalTimeSeconds: z.number().optional(),
  actualDrawdownSeconds: z.number().optional(),
  userGrinderId: z.number().optional(),
  actualGrindSettingValue: z.number().optional(),
  actualGrindMicronEstimated: z.number().optional(),
  beverageWeightG: z.number().optional(),
  tdsPercent: z.number().optional(),
  daysOffRoast: z.number().optional(),
  degassingStatus: z.string().optional(),
  brewRatio: z.number().optional(),
  extractionYieldPercent: z.number().optional(),
  strengthZone: z.string().optional(),
  extractionZone: z.string().optional(),
  diagnosis: z.string().optional(),
  rating: z.number().optional(),
  acidity: z.number().optional(),
  sweetness: z.number().optional(),
  body: z.number().optional(),
  bitterness: z.number().optional(),
  aftertaste: z.number().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
};

export const brewLogSchema = z.object({
  ...brewLogShape,
  overallNote: z.string().optional(),
});

/** 목록 항목. 단건에서 `overallNote` 하나만 뺀 것이다(`BrewLogSummaryResponse`). */
export const brewLogSummarySchema = z.object(brewLogShape);

export const brewLogPageSchema = pageResponseSchema(brewLogSummarySchema);

export type BrewLog = z.infer<typeof brewLogSchema>;
export type BrewLogSummary = z.infer<typeof brewLogSummarySchema>;
export type BrewLogPage = z.infer<typeof brewLogPageSchema>;
