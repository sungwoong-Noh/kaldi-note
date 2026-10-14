// GENERATED — 손으로 고치지 마세요.
// 원본: docs/contracts/2026-10-14-bean-crawler.json
// 다시 만들기: node scripts/generate-contract-types.mjs
// 규칙: docs/contracts/README.md
export interface CrawlSource {
  key: string;
  name: string;
  listUrl: string;
  lastRun?: CrawlRunBrief;
}

export interface CrawlRunBrief {
  id: number;
  status: "RUNNING" | "SUCCEEDED" | "FAILED" | "INTERRUPTED";
  startedAt: string;
  finishedAt?: string;
}

export interface CrawlRun {
  id: number;
  source: string;
  status: "RUNNING" | "SUCCEEDED" | "FAILED" | "INTERRUPTED";
  startedAt: string;
  finishedAt?: string;
  created: number;
  updated: number;
  skipped: SkippedItem[];
  unmapped: UnmappedItem[];
  errorMessage?: string;
}

export interface SkippedItem {
  name: string;
  reason: "USER_OWNED" | "FETCH_FAILED" | "PARSE_FAILED";
}

export interface UnmappedItem {
  name: string;
  field: "roastLevel" | "variety" | "process";
  raw: string;
}

export interface PageOfCrawlRun {
  content: CrawlRun[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
}
