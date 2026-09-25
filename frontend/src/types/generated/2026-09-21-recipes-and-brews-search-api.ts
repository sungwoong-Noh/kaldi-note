// GENERATED — 손으로 고치지 마세요.
// 원본: docs/contracts/2026-09-21-recipes-and-brews-search-api.json
// 다시 만들기: node scripts/generate-contract-types.mjs
// 규칙: docs/contracts/README.md
export interface RecipeSummary {
  id: number;
  ownerUserId?: number | null;
  sourceType: "USER" | "CURATED";
  title: string;
  description?: string | null;
  brewMethod?: "POUR_OVER";
  visibility: "PRIVATE" | "FRIENDS" | "PUBLIC";
  parentRecipeId?: number | null;
  forkRootId?: number | null;
  doseG: number;
  waterG: number;
  ratio?: number | null;
  waterTempC?: number | null;
  totalTimeSeconds?: number | null;
  brewerId?: number | null;
  filterId?: number | null;
  grinderModelId?: number | null;
  grindSettingValue?: number | null;
  grindSettingUnit?: string | null;
  grindMicronEstimated?: number | null;
  temperatureType: "HOT" | "ICE";
  recommendedRoastLevel: "LIGHT" | "MEDIUM" | "DARK";
  savedCount: number;
  authorDisplayName: string;
  sourceAuthorName?: string | null;
  brewCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface RecipeStep {
  stepOrder: number;
  stepType: string;
  startAtSeconds?: number | null;
  durationSeconds?: number | null;
  waterG?: number | null;
  cumulativeWaterG: number;
  pourTechnique?: string | null;
  agitation?: string | null;
  note?: string | null;
}

export interface Recipe {
  id: number;
  ownerUserId?: number | null;
  sourceType: "USER" | "CURATED";
  title: string;
  description?: string | null;
  brewMethod?: "POUR_OVER";
  visibility: "PRIVATE" | "FRIENDS" | "PUBLIC";
  parentRecipeId?: number | null;
  forkRootId?: number | null;
  doseG: number;
  waterG: number;
  ratio: number;
  waterTempC?: number | null;
  totalTimeSeconds?: number | null;
  brewerId?: number | null;
  filterId?: number | null;
  grinderModelId?: number | null;
  grindSettingValue?: number | null;
  grindSettingUnit?: string | null;
  grindMicronEstimated?: number | null;
  temperatureType: "HOT" | "ICE";
  recommendedRoastLevel: "LIGHT" | "MEDIUM" | "DARK";
  sourceAuthorName?: string | null;
  savedCount: number;
  brewCount: number;
  steps: RecipeStep[];
  createdAt?: string;
  updatedAt?: string;
}

export interface RecipeForkRequest {
  title?: string | null;
  description?: string | null;
  doseG?: number | null;
  waterG?: number | null;
  waterTempC?: number | null;
  totalTimeSeconds?: number | null;
  brewerId?: number | null;
  filterId?: number | null;
  grinderModelId?: number | null;
  grindSettingValue?: number | null;
}

export interface BrewLogStats {
  monthCount: number;
  averageRating?: number | null;
  favoriteDoseG?: number | null;
  favoriteRecipeId?: number | null;
  favoriteRecipeTitle?: string | null;
}

export interface PageOfRecipeSummary {
  content: RecipeSummary[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}
