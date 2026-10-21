import { useQuery } from "@tanstack/react-query";
import { backendUrl } from "@/lib/api-client";
import { authedRequest } from "@/lib/authed-fetch";
import {
  brewFilterListSchema,
  brewerListSchema,
  grinderModelListSchema,
  userGrinderListSchema,
} from "./schema";

/**
 * 브루어·필터는 마스터 데이터라 사실상 변하지 않는다. staleTime을 무한으로 두어 레시피를 몇 개 열든 세션당 한 번만 부른다.
 *
 * <p>레시피 응답은 `brewerId`·`filterId`만 주므로 이름을 보여주려면 이 목록이 필요하다.
 */
const MASTER_DATA_OPTIONS = { staleTime: Infinity, gcTime: Infinity } as const;

export function useBrewers(onSessionLost?: () => void) {
  return useQuery({
    queryKey: ["gear", "brewers"],
    queryFn: () =>
      authedRequest(backendUrl("/api/v1/gear/brewers"), {
        schema: brewerListSchema,
        onSessionLost,
      }),
    ...MASTER_DATA_OPTIONS,
  });
}

export function useBrewFilters(onSessionLost?: () => void) {
  return useQuery({
    queryKey: ["gear", "filters"],
    queryFn: () =>
      authedRequest(backendUrl("/api/v1/gear/filters"), {
        schema: brewFilterListSchema,
        onSessionLost,
      }),
    ...MASTER_DATA_OPTIONS,
  });
}

export function useGrinders(onSessionLost?: () => void) {
  return useQuery({
    queryKey: ["gear", "grinders"],
    queryFn: () =>
      authedRequest(backendUrl("/api/v1/gear/grinders"), {
        schema: grinderModelListSchema,
        onSessionLost,
      }),
    ...MASTER_DATA_OPTIONS,
  });
}

/**
 * 내가 등록한 그라인더 목록.
 *
 * <p>마스터 데이터와 달리 <b>`staleTime`을 두지 않는다</b> — 모달로 새로 등록하면 곧바로 다시 읽어야 선택란에 나타난다.
 */
export function useUserGrinders(onSessionLost?: () => void, enabled = true) {
  return useQuery({
    queryKey: ["gear", "user-grinders"],
    enabled,
    queryFn: () =>
      authedRequest(backendUrl("/api/v1/gear/user-grinders"), {
        schema: userGrinderListSchema,
        onSessionLost,
      }),
  });
}

