import { z } from "zod";
import { backendUrl } from "@/lib/api-client";
import { authedRequest } from "@/lib/authed-fetch";
import type { BrewLogRequestBody } from "./formState";
import {
  brewLogPageSchema,
  brewLogSchema,
  type BrewLog,
  type BrewLogPage,
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

export function fetchBrewLogPage(
  page: number,
  size: number = BREW_LOG_PAGE_SIZE,
  onSessionLost?: () => void,
): Promise<BrewLogPage> {
  const query = new URLSearchParams({
    page: String(page),
    size: String(size),
  });
  return authedRequest(backendUrl(`/api/v1/brew-logs?${query.toString()}`), {
    schema: brewLogPageSchema,
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
