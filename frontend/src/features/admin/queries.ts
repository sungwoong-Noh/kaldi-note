import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { backendUrl } from "@/lib/api-client";
import { authedRequest } from "@/lib/authed-fetch";
import {
  crawlRunPageSchema,
  crawlRunSchema,
  crawlSourceSchema,
} from "./schema";

const BASE = "/api/v1/admin";
export const POLL_MS = 3000;

export function useCrawlSources(onSessionLost?: () => void) {
  return useQuery({
    queryKey: ["admin", "crawl-sources"],
    queryFn: () =>
      authedRequest(backendUrl(`${BASE}/crawl-sources`), {
        schema: z.array(crawlSourceSchema),
        onSessionLost,
      }),
    // 패널을 열지 않은 실행도 끝나면 버튼이 풀려야 한다.
    refetchInterval: (query) =>
      query.state.data?.some((s) => s.lastRun?.status === "RUNNING")
        ? POLL_MS
        : false,
  });
}

export function useCrawlRuns(
  source: string | undefined,
  page: number,
  onSessionLost?: () => void,
) {
  const params = new URLSearchParams({ page: String(page), size: "20" });
  if (source) params.set("source", source);
  return useQuery({
    queryKey: ["admin", "crawl-runs", source ?? "all", page],
    queryFn: () =>
      authedRequest(backendUrl(`${BASE}/crawl-runs?${params}`), {
        schema: crawlRunPageSchema,
        onSessionLost,
      }),
    placeholderData: (previous) => previous,
    refetchInterval: (query) =>
      query.state.data?.content.some((r) => r.status === "RUNNING")
        ? POLL_MS
        : false,
  });
}

/** RUNNING이면 3초마다 다시 읽는다. 탭이 숨겨지면 react-query가 알아서 멈춘다. */
export function useCrawlRun(
  id: number | undefined,
  onSessionLost?: () => void,
) {
  return useQuery({
    queryKey: ["admin", "crawl-run", id],
    queryFn: () =>
      authedRequest(backendUrl(`${BASE}/crawl-runs/${id}`), {
        schema: crawlRunSchema,
        onSessionLost,
      }),
    enabled: id !== undefined,
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.status === "RUNNING" ? POLL_MS : false,
  });
}

export function useStartCrawl(onSessionLost?: () => void) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (key: string) =>
      authedRequest(backendUrl(`${BASE}/crawl-sources/${key}/runs`), {
        method: "POST",
        schema: crawlRunSchema,
        onSessionLost,
      }),
    onSettled: () => client.invalidateQueries({ queryKey: ["admin"] }),
  });
}
