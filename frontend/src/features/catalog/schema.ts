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
  varietyId: z.number().optional(),
  processId: z.number().optional(),
  ratioPercent: z.number().optional(),
});

export const beanProductSchema = z.object({
  id: z.number(),
  roasterId: z.number(),
  name: z.string(),
  beanMix: z.enum(["SINGLE_ORIGIN", "BLEND"]),
  roastLevel: z.enum([
    "LIGHT",
    "MEDIUM_LIGHT",
    "MEDIUM",
    "MEDIUM_DARK",
    "DARK",
  ]),
  decaf: z.boolean(),
  verified: z.boolean(),
  origins: z.array(beanOriginSchema).default([]),
  createdAt: z.string(),
});

export const roasterListSchema = z.array(roasterSchema);
export const beanProductListSchema = z.array(beanProductSchema);

export type Roaster = z.infer<typeof roasterSchema>;
export type BeanProduct = z.infer<typeof beanProductSchema>;
export type RoastLevel = BeanProduct["roastLevel"];
