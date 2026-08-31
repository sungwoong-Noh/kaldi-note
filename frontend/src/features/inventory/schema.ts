import { z } from "zod";

/**
 * 원두 재고. `daysOffRoast`·`degassingStatus`는 서버가 조회 시점에 계산해서 준다 —
 * 화면이 경과일을 직접 세지 않는다(`frontend/CLAUDE.md`「UI에서 지켜야 할 도메인 규칙」 6번).
 */
export const beanBatchSchema = z.object({
  id: z.number(),
  beanProductId: z.number(),
  weightG: z.number(),
  remainingG: z.number(),
  roastedAt: z.string(),
  purchasedAt: z.string().optional(),
  price: z.number().optional(),
  memo: z.string().optional(),
  frozen: z.boolean(),
  finished: z.boolean(),
  daysOffRoast: z.number().optional(),
  degassingStatus: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/** 페이지 봉투가 아니라 배열이다 — 2026-08-31에 실제 응답으로 확인했다. */
export const beanBatchListSchema = z.array(beanBatchSchema);

export type BeanBatch = z.infer<typeof beanBatchSchema>;
