// GENERATED — 손으로 고치지 마세요.
// 원본: docs/contracts/2026-11-14-quick-brew.json
// 다시 만들기: node scripts/generate-contract-types.mjs
// 규칙: docs/contracts/README.md
export interface BrewLogCreateRequest {
  brewedAt?: string | null;
  visibility?: "PRIVATE" | "FRIENDS" | "PUBLIC";
  actualDoseG: number;
  actualWaterG: number;
  actualWaterTempC?: number | null;
  actualTotalTimeSeconds?: number | null;
  actualDrawdownSeconds?: number | null;
  recipeId?: number | null;
  beanBatchId?: number | null;
  beanProductId?: number | null;
  beanName?: string | null;
  roastedAt?: string | null;
  userGrinderId?: number | null;
  actualGrindSettingValue?: number | null;
  beverageWeightG?: number | null;
  tdsPercent?: number | null;
  rating?: number | null;
  acidity?: number | null;
  sweetness?: number | null;
  body?: number | null;
  bitterness?: number | null;
  aftertaste?: number | null;
  overallNote?: string | null;
}

export interface BrewLogPatchRequest {
  brewedAt?: string | null;
  visibility?: "PRIVATE" | "FRIENDS" | "PUBLIC";
  actualDoseG?: number | null;
  actualWaterG?: number | null;
  actualWaterTempC?: number | null;
  actualTotalTimeSeconds?: number | null;
  actualDrawdownSeconds?: number | null;
  beanProductId?: number | null;
  beanName?: string | null;
  roastedAt?: string | null;
  userGrinderId?: number | null;
  actualGrindSettingValue?: number | null;
  beverageWeightG?: number | null;
  tdsPercent?: number | null;
  rating?: number | null;
  acidity?: number | null;
  sweetness?: number | null;
  body?: number | null;
  bitterness?: number | null;
  aftertaste?: number | null;
  overallNote?: string | null;
}

export interface BrewLog {
  id: number;
  userId: number;
  recipeId?: number | null;
  beanBatchId?: number | null;
  beanProductId?: number | null;
  beanName?: string | null;
  roastedAt?: string | null;
  brewedAt: string;
  visibility: string;
  actualDoseG: number;
  actualWaterG: number;
  actualWaterTempC?: number | null;
  actualTotalTimeSeconds?: number | null;
  actualDrawdownSeconds?: number | null;
  userGrinderId?: number | null;
  actualGrindSettingValue?: number | null;
  actualGrindMicronEstimated?: number | null;
  beverageWeightG?: number | null;
  tdsPercent?: number | null;
  daysOffRoast?: number | null;
  degassingStatus?: string | null;
  brewRatio: number;
  extractionYieldPercent?: number | null;
  strengthZone?: string | null;
  extractionZone?: string | null;
  diagnosis?: string | null;
  rating?: number | null;
  acidity?: number | null;
  sweetness?: number | null;
  body?: number | null;
  bitterness?: number | null;
  aftertaste?: number | null;
  overallNote?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BrewLogDetail {
  id: number;
  userId: number;
  recipeId?: number | null;
  beanBatchId?: number | null;
  beanProductId?: number | null;
  beanName?: string | null;
  roastedAt?: string | null;
  brewedAt: string;
  visibility: string;
  actualDoseG: number;
  actualWaterG: number;
  actualWaterTempC?: number | null;
  actualTotalTimeSeconds?: number | null;
  actualDrawdownSeconds?: number | null;
  userGrinderId?: number | null;
  actualGrindSettingValue?: number | null;
  actualGrindMicronEstimated?: number | null;
  beverageWeightG?: number | null;
  tdsPercent?: number | null;
  daysOffRoast?: number | null;
  degassingStatus?: string | null;
  brewRatio: number;
  extractionYieldPercent?: number | null;
  strengthZone?: string | null;
  extractionZone?: string | null;
  diagnosis?: string | null;
  rating?: number | null;
  acidity?: number | null;
  sweetness?: number | null;
  body?: number | null;
  bitterness?: number | null;
  aftertaste?: number | null;
  overallNote?: string | null;
  createdAt: string;
  updatedAt: string;
  recipeSnapshot?: Record<string, unknown> | null;
}

export interface BrewLogSummary {
  id: number;
  userId: number;
  recipeId?: number | null;
  beanBatchId?: number | null;
  beanProductId?: number | null;
  beanName?: string | null;
  roastedAt?: string | null;
  brewedAt: string;
  visibility: string;
  actualDoseG: number;
  actualWaterG: number;
  actualWaterTempC?: number | null;
  actualTotalTimeSeconds?: number | null;
  actualDrawdownSeconds?: number | null;
  userGrinderId?: number | null;
  actualGrindSettingValue?: number | null;
  actualGrindMicronEstimated?: number | null;
  beverageWeightG?: number | null;
  tdsPercent?: number | null;
  daysOffRoast?: number | null;
  degassingStatus?: string | null;
  brewRatio: number;
  extractionYieldPercent?: number | null;
  strengthZone?: string | null;
  extractionZone?: string | null;
  diagnosis?: string | null;
  rating?: number | null;
  acidity?: number | null;
  sweetness?: number | null;
  body?: number | null;
  bitterness?: number | null;
  aftertaste?: number | null;
  overallNote?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PageOfBrewLogSummary {
  content: BrewLogSummary[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
}
