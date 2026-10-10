// GENERATED — 손으로 고치지 마세요.
// 원본: docs/contracts/2026-10-10-my-cups-ledger.json
// 다시 만들기: node scripts/generate-contract-types.mjs
// 규칙: docs/contracts/README.md
export interface BrewLogSummary {
  id: number;
  userId: number;
  recipeId: number;
  beanBatchId?: number | null;
  brewedAt: string;
  actualDoseG: number;
  actualWaterTempC: number;
  actualTotalTimeSeconds?: number | null;
  extractionYieldPercent?: number | null;
  rating?: number | null;
}

export interface PageOfBrewLogSummary {
  content: BrewLogSummary[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
}
