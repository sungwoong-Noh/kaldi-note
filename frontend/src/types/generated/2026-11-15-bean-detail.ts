// GENERATED — 손으로 고치지 마세요.
// 원본: docs/contracts/2026-11-15-bean-detail.json
// 다시 만들기: node scripts/generate-contract-types.mjs
// 규칙: docs/contracts/README.md
export interface BeanProductSummary {
  id: number;
  name: string;
  roasterId: number;
  roasterName: string;
  beanMix: string;
  roastLevel?: string | null;
  roastLevelAgtron?: number | null;
  roastLevelCustom?: string | null;
  decaf: boolean;
  countries: string[];
}

export interface PageOfBeanProductSummary {
  content: BeanProductSummary[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface BeanOriginDetail {
  id: number;
  country?: string | null;
  region?: string | null;
  farm?: string | null;
  altitudeMinM?: number | null;
  altitudeMaxM?: number | null;
  varietyId?: number | null;
  varietyName?: string | null;
  processId?: number | null;
  processName?: string | null;
  ratioPercent?: number | null;
}

export interface BeanProductDetail {
  id: number;
  roasterId: number;
  roasterName: string;
  name: string;
  beanMix: string;
  roastLevel?: string | null;
  roastLevelAgtron?: number | null;
  roastLevelCustom?: string | null;
  decaf: boolean;
  productUrl?: string | null;
  description?: string | null;
  verified: boolean;
  hidden: boolean;
  origins: BeanOriginDetail[];
  createdAt: string;
}

export interface BeanBrewRecent {
  id: number;
  brewedAt: string;
  actualDoseG: number;
  actualWaterG: number;
  brewRatio: number;
  rating?: number | null;
}

export interface BeanBrewSummary {
  brewCount: number;
  ratedCount: number;
  averageRating?: number | null;
  frequentRatio?: number | null;
  frequentDoseG?: number | null;
  frequentWaterG?: number | null;
  recent: BeanBrewRecent[];
}
