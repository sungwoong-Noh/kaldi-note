import { z } from "zod";

/** 로스터. 목록은 페이지 봉투가 아니라 **배열**이다 — 2026-08-31에 실제 응답으로 확인했다. */
export const roasterSchema = z.object({
  id: z.number(),
  name: z.string(),
  country: z.string().optional(),
  website: z.string().optional(),
  isSystem: z.boolean(),
  createdByUserId: z.number().optional(),
  createdAt: z.string(),
});

/** 원산지. 보내지 않아도 서버가 `ratioPercent`를 채워 돌려준다. */
export const beanOriginSchema = z.object({
  id: z.number(),
  country: z.string(),
  region: z.string().optional(),
  farm: z.string().optional(),
  altitudeMinM: z.number().optional(),
  altitudeMaxM: z.number().optional(),
  varietyId: z.number().optional(),
  processId: z.number().optional(),
  ratioPercent: z.number().optional(),
  /** 표시 이름(`name_ko ?? name`). 품종·가공이 없으면 키가 빠진다. */
  varietyName: z.string().optional(),
  processName: z.string().optional(),
});

export const beanProductSchema = z.object({
  id: z.number(),
  roasterId: z.number(),
  /** 2026-11-15부터 상세가 준다. 그 전에 뜬 픽스처에는 없다. */
  roasterName: z.string().optional(),
  name: z.string(),
  beanMix: z.enum(["SINGLE_ORIGIN", "BLEND"]),
  /** 크롤러가 가져온 원두는 배전도를 모를 수 있다 — 실제 응답에서는 키가 빠진다(AC-CRAWL-42·45). */
  roastLevel: z
    .enum(["LIGHT", "MEDIUM_LIGHT", "MEDIUM", "MEDIUM_DARK", "DARK"])
    .nullish(),
  roastLevelAgtron: z.number().optional(),
  decaf: z.boolean(),
  productUrl: z.string().optional(),
  /** 로스터 설명 원문(컵노트). */
  description: z.string().optional(),
  verified: z.boolean(),
  hidden: z.boolean().default(false),
  origins: z.array(beanOriginSchema).default([]),
  createdAt: z.string(),
});

/**
 * 원두 검색 결과 행 — `GET /api/v1/bean-products`. 2026-11-15 로컬 응답에서 확인했다.
 * `countries`는 산지 순서, 중복 없음. 산지가 없으면 `[]`.
 */
export const beanProductSummarySchema = z.object({
  id: z.number(),
  name: z.string(),
  roasterId: z.number(),
  roasterName: z.string(),
  beanMix: z.enum(["SINGLE_ORIGIN", "BLEND"]),
  roastLevel: z
    .enum(["LIGHT", "MEDIUM_LIGHT", "MEDIUM", "MEDIUM_DARK", "DARK"])
    .optional(),
  roastLevelAgtron: z.number().optional(),
  roastLevelCustom: z.string().optional(),
  decaf: z.boolean(),
  countries: z.array(z.string()),
});

/** 백엔드 `PageResponse<T>`. 여섯 키 고정(recipe/schema.ts와 같은 모양 — feature끼리 import하지 않는다). */
export const beanProductPageSchema = z.object({
  content: z.array(beanProductSummarySchema),
  page: z.number(),
  size: z.number(),
  totalElements: z.number(),
  totalPages: z.number(),
  hasNext: z.boolean(),
});

/**
 * 내 「이 원두의 기록」 요약 — `GET /api/v1/brew-logs/bean-summary`. 2026-11-16 로컬 응답에서 확인했다.
 * 0잔이면 `averageRating` · `frequent*` 키가 없고, 별점 없는 잔은 `rating` 키가 없다.
 */
export const beanSummarySchema = z.object({
  brewCount: z.number(),
  ratedCount: z.number(),
  averageRating: z.number().optional(),
  frequentRatio: z.number().optional(),
  frequentDoseG: z.number().optional(),
  frequentWaterG: z.number().optional(),
  recent: z.array(
    z.object({
      id: z.number(),
      brewedAt: z.string(),
      actualDoseG: z.number(),
      actualWaterG: z.number(),
      brewRatio: z.number(),
      rating: z.number().optional(),
    }),
  ),
});

export const roasterListSchema = z.array(roasterSchema);

export type Roaster = z.infer<typeof roasterSchema>;
export type BeanProduct = z.infer<typeof beanProductSchema>;
export type BeanProductSummary = z.infer<typeof beanProductSummarySchema>;
export type BeanSummary = z.infer<typeof beanSummarySchema>;
export type RoastLevel = NonNullable<BeanProduct["roastLevel"]>;
