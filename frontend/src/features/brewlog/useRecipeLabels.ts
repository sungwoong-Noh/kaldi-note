"use client";

import { useQueries } from "@tanstack/react-query";
import { fetchRecipe } from "@/features/recipe/api";
import { combineSources, entityLabel } from "./entityLabel";
import type { BrewLogSummary } from "./schema";

/** 이미 읽은 레시피를 다시 읽지 않을 시간. 레시피 제목은 로그를 훑는 동안 거의 바뀌지 않는다. */
const TITLE_STALE_MS = 5 * 60 * 1000;

/**
 * 로그 목록에 보일 레시피 이름을 모은다.
 *
 * <p><b>목록 응답에 제목이 없다</b>(`BrewLogSummaryResponse`) — `recipeId`로 따로 읽는 수밖에 없다.
 * 다만 같은 레시피를 여러 번 내린 것이 이 서비스의 전제라, 중복 id를 지우면 20개 항목이 대개 한두 요청으로 줄어든다.
 *
 * <p><b>못 읽는 것이 정상이다.</b> 남의 로그는 보이되 그 레시피는 `PRIVATE`이라 403일 수 있다.
 * 그래서 제목이 아니라 <b>라벨</b>을 돌려준다 — 실패한 id도 키를 갖고, 값은 그 이유를 담은 문구다.
 *
 * @returns `recipeId` → 화면에 그대로 넣을 문자열. 조회 중인 것은 빈 문자열이다.
 */
export function useRecipeLabels(
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

  const labels = new Map<number, string>();
  recipeIds.forEach((id, index) => {
    const query = queries[index];
    if (query === undefined) return;
    labels.set(
      id,
      entityLabel("recipe", combineSources([query], query.data?.title)),
    );
  });

  return labels;
}
