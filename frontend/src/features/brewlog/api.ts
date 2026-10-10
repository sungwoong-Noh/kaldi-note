import { z } from "zod";
import { backendUrl } from "@/lib/api-client";
import { authedRequest } from "@/lib/authed-fetch";
import type { BrewLogPatchBody, BrewLogRequestBody } from "./formState";
import {
  brewLogPageSchema,
  brewLogSchema,
  brewLogStatsSchema,
  type BrewLog,
  type BrewLogPage,
  type BrewLogStats,
} from "./schema";

export const BREW_LOG_PAGE_SIZE = 20;

export function createBrewLog(
  body: BrewLogRequestBody,
  onSessionLost?: () => void,
): Promise<BrewLog> {
  return authedRequest(backendUrl("/api/v1/brew-logs"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    schema: brewLogSchema,
    onSessionLost,
  });
}

export function fetchBrewLog(
  id: number,
  onSessionLost?: () => void,
): Promise<BrewLog> {
  return authedRequest(backendUrl(`/api/v1/brew-logs/${id}`), {
    schema: brewLogSchema,
    onSessionLost,
  });
}

/** 목록 필터. 전부 선택이고 서버에서 AND로 묶인다(docs/specs/2026-10-10-my-cups-ledger.md). */
export interface BrewLogListFilter {
  userId?: number;
  /** `YYYY-MM`, KST */
  month?: string;
  /** 1~5, 그 별점 이상 */
  minRating?: number;
}

export function fetchBrewLogPage(
  page: number,
  size: number = BREW_LOG_PAGE_SIZE,
  onSessionLost?: () => void,
  filter: BrewLogListFilter = {},
): Promise<BrewLogPage> {
  const query = new URLSearchParams({
    page: String(page),
    size: String(size),
  });
  for (const [key, value] of Object.entries(filter)) {
    if (value !== undefined) query.set(key, String(value));
  }
  return authedRequest(backendUrl(`/api/v1/brew-logs?${query.toString()}`), {
    schema: brewLogPageSchema,
    onSessionLost,
  });
}

export function fetchBrewLogStats(
  onSessionLost?: () => void,
): Promise<BrewLogStats> {
  return authedRequest(backendUrl("/api/v1/brew-logs/stats"), {
    schema: brewLogStatsSchema,
    onSessionLost,
  });
}

/** 부분 수정. 보내지 않은 필드는 바뀌지 않는다. */
export function patchBrewLog(
  id: number,
  body: BrewLogPatchBody,
  onSessionLost?: () => void,
): Promise<BrewLog> {
  return authedRequest(backendUrl(`/api/v1/brew-logs/${id}`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    schema: brewLogSchema,
    onSessionLost,
  });
}

/** 성공하면 204라 본문이 없다. */
export function deleteBrewLog(
  id: number,
  onSessionLost?: () => void,
): Promise<void> {
  return authedRequest(backendUrl(`/api/v1/brew-logs/${id}`), {
    method: "DELETE",
    schema: z.void(),
    onSessionLost,
  });
}
