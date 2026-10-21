import { z } from "zod";

/** 대조용 계약 타입: `src/types/generated/2026-10-14-bean-crawler.ts`. */
const runStatusSchema = z.enum([
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "INTERRUPTED",
]);

export type RunStatus = z.infer<typeof runStatusSchema>;

/** `lastRun`은 실행 이력이 없으면 키째 빠진다(non_null). */
export const crawlSourceSchema = z.object({
  key: z.string(),
  name: z.string(),
  listUrl: z.string(),
  lastRun: z
    .object({
      id: z.number(),
      status: runStatusSchema,
      startedAt: z.string(),
      finishedAt: z.string().optional(),
    })
    .optional(),
});

export type CrawlSource = z.infer<typeof crawlSourceSchema>;

export const skippedItemSchema = z.object({
  name: z.string(),
  reason: z.string(),
});

export const unmappedItemSchema = z.object({
  name: z.string(),
  field: z.string(),
  raw: z.string(),
});

/** RUNNING 중에는 집계가 0·빈 배열이다 — 서버는 끝날 때 한 번에 쓴다. */
export const crawlRunSchema = z.object({
  id: z.number(),
  source: z.string(),
  status: runStatusSchema,
  startedAt: z.string(),
  finishedAt: z.string().optional(),
  created: z.number(),
  updated: z.number(),
  skipped: z.array(skippedItemSchema),
  unmapped: z.array(unmappedItemSchema),
  errorMessage: z.string().optional(),
});

export type CrawlRun = z.infer<typeof crawlRunSchema>;

export const crawlRunPageSchema = z.object({
  content: z.array(crawlRunSchema),
  page: z.number(),
  size: z.number(),
  totalElements: z.number(),
  totalPages: z.number(),
  hasNext: z.boolean(),
});

export type CrawlRunPage = z.infer<typeof crawlRunPageSchema>;
