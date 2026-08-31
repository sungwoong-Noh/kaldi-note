"use client";

import { useQueries } from "@tanstack/react-query";
import { fetchRecipe } from "@/features/recipe/api";
import type { BrewLogSummary } from "./schema";

/** 이미 읽은 레시피를 다시 읽지 않을 시간. 레시피 제목은 로그를 훑는 동안 거의 바뀌지 않는다. */
const TITLE_STALE_MS = 5 * 60 * 1000;

/**
 * 로그 목록에 보일 레시피 제목을 모은다.
 *
 * <p><b>목록 응답에 제목이 없다</b>(`BrewLogSummaryResponse`) — `recipeId`로 따로 읽는 수밖에 없다.
 * 다만 같은 레시피를 여러 번 내린 것이 이 서비스의 전제라, 중복 id를 지우면 20개 항목이 대개 한두 요청으로 줄어든다.
 *
 * @returns `recipeId` → 제목. 아직 도착하지 않은 것은 키가 없다.
 */
export function useRecipeTitles(
  logs: BrewLogSummary[],
  enabled: boolean,
  onSessionLost?: () => void,
): Map<number, string> {
  const recipeIds = [...new Set(logs.map((log) => log.recipeId))];

  const queries = useQueries({
    queries: recipeIds.map((id) => ({
      queryKey: ["recipe", id],
      queryFn: () => fetchRecipe(id, onSessionLost),
      staleTime: TITLE_STALE_MS,
      enabled,
    })),
  });

  const titles = new Map<number, string>();
  recipeIds.forEach((id, index) => {
    const title = queries[index]?.data?.title;
    if (title !== undefined) titles.set(id, title);
  });

  return titles;
}
