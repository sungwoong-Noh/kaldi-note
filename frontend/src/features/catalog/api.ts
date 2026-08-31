import { useQuery } from "@tanstack/react-query";
import { backendUrl } from "@/lib/api-client";
import { authedRequest } from "@/lib/authed-fetch";
import {
  beanProductListSchema,
  beanProductSchema,
  roasterListSchema,
  roasterSchema,
  type BeanProduct,
  type RoastLevel,
  type Roaster,
} from "./schema";

export function useRoasters(onSessionLost?: () => void) {
  return useQuery({
    queryKey: ["catalog", "roasters"],
    queryFn: () =>
      authedRequest(backendUrl("/api/v1/roasters"), {
        schema: roasterListSchema,
        onSessionLost,
      }),
  });
}

export function useBeanProducts(onSessionLost?: () => void) {
  return useQuery({
    queryKey: ["catalog", "bean-products"],
    queryFn: () =>
      authedRequest(backendUrl("/api/v1/bean-products"), {
        schema: beanProductListSchema,
        onSessionLost,
      }),
  });
}

export function createRoaster(
  body: { name: string },
  onSessionLost?: () => void,
): Promise<Roaster> {
  return authedRequest(backendUrl("/api/v1/roasters"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    schema: roasterSchema,
    onSessionLost,
  });
}

/**
 * 원두 제품 등록.
 *
 * <p><b>`origins`는 생략할 수 없다.</b> 서버가 `SINGLE_ORIGIN`이면 정확히 1개를 요구하고, 없으면
 * `400 BEAN_MIX_ORIGIN_MISMATCH`로 거부한다. 그래서 `beanMix`를 인자로 받지 않고 고정한다 —
 * 블렌드는 원산지를 2개 이상 받아야 해서 이번 슬라이스의 비목표다.
 */
export function createBeanProduct(
  body: { roasterId: number; name: string; roastLevel: RoastLevel; country: string },
  onSessionLost?: () => void,
): Promise<BeanProduct> {
  return authedRequest(backendUrl("/api/v1/bean-products"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      roasterId: body.roasterId,
      name: body.name,
      beanMix: "SINGLE_ORIGIN",
      roastLevel: body.roastLevel,
      origins: [{ country: body.country }],
    }),
    schema: beanProductSchema,
    onSessionLost,
  });
}
