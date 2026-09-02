import { useQuery } from "@tanstack/react-query";
import { backendUrl } from "@/lib/api-client";
import { authedRequest } from "@/lib/authed-fetch";
import {
  brewFilterListSchema,
  brewerListSchema,
  grindConversionSchema,
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
export function useUserGrinders(onSessionLost?: () => void) {
  return useQuery({
    queryKey: ["gear", "user-grinders"],
    queryFn: () =>
      authedRequest(backendUrl("/api/v1/gear/user-grinders"), {
        schema: userGrinderListSchema,
        onSessionLost,
      }),
  });
}

/**
 * 저장 전 마이크론 미리보기.
 *
 * <p><b>source와 target에 같은 그라인더를 넣는다.</b> "이 설정값이 몇 µm인가"만 묻는 엔드포인트가 없고, 목록 응답에 영점 보정이 없어 프론트가
 * 직접 곱하면 영점이 0이 아닌 그라인더에서 틀린 값이 나온다. 응답에서 `micron`만 쓴다.
 *
 * <p>세 값이 다 채워지고 단위가 `MICRON`이 아닐 때만 호출한다. `queryKey`에 값이 들어 있어 같은 조합은 캐시에서 나온다.
 */
export function useGrindPreview(
  params: {
    grinderModelId: number | null;
    unit: string | null;
    value: number | null;
  },
  onSessionLost?: () => void,
) {
  const { grinderModelId, unit, value } = params;
  const enabled =
    grinderModelId !== null &&
    unit !== null &&
    unit !== "MICRON" &&
    value !== null;

  return useQuery({
    queryKey: ["gear", "grind-preview", grinderModelId, unit, value],
    queryFn: () =>
      authedRequest(backendUrl("/api/v1/gear/grind-conversions"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceGrinderModelId: grinderModelId,
          sourceSetting: value,
          targetGrinderModelId: grinderModelId,
        }),
        schema: grindConversionSchema,
        onSessionLost,
      }),
    enabled,
    // 환산 실패(422·400)는 사용자가 값을 고쳐야 풀린다. 재시도해도 같은 답이 온다.
    retry: false,
  });
}
