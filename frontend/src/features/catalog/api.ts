import { useQueries, useQuery } from "@tanstack/react-query";
import { backendUrl } from "@/lib/api-client";
import { authedRequest } from "@/lib/authed-fetch";
import {
  beanProductPageSchema,
  beanProductSchema,
  beanSummarySchema,
  roasterListSchema,
  roasterSchema,
  type BeanProduct,
  type RoastLevel,
  type Roaster,
} from "./schema";

export function useRoasters(onSessionLost?: () => void, enabled = true) {
  return useQuery({
    queryKey: ["catalog", "roasters"],
    enabled,
    queryFn: () =>
      authedRequest(backendUrl("/api/v1/roasters"), {
        schema: roasterListSchema,
        onSessionLost,
      }),
  });
}

export type BeanSearchParams = {
  q?: string;
  roasterId?: number;
  size?: number;
};

/**
 * 원두 검색 — 숨긴 원두와 남이 만든 사용자 원두는 서버가 뺀다. 전체 목록 API는 없다
 * (docs/specs/2026-11-15-bean-detail.md 「검색」).
 */
export function useBeanSearch(
  params: BeanSearchParams,
  onSessionLost?: () => void,
  enabled = true,
) {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.roasterId !== undefined)
    query.set("roasterId", String(params.roasterId));
  query.set("size", String(params.size ?? 20));
  return useQuery({
    queryKey: ["catalog", "bean-search", params],
    enabled,
    queryFn: () =>
      authedRequest(backendUrl(`/api/v1/bean-products?${query}`), {
        schema: beanProductPageSchema,
        onSessionLost,
      }),
  });
}

/**
 * 제품 여러 건을 id로. 화면에 이름을 붙일 원두가 몇 개뿐일 때 쓴다 — 캐시 키는 다른 화면의
 * 단건 조회(`["catalog", "bean-product", id]`)와 같다. 도착한 것만 담는다.
 */
export function useBeanProductsByIds(
  ids: readonly number[],
  onSessionLost?: () => void,
): BeanProduct[] {
  const unique = [...new Set(ids)];
  const queries = useQueries({
    queries: unique.map((id) => ({
      queryKey: ["catalog", "bean-product", id],
      queryFn: () => fetchBeanProduct(id, onSessionLost),
    })),
  });
  return queries.flatMap((q) => (q.data ? [q.data] : []));
}

/** 이 원두로 내린 내 기록 요약. 카탈로그 원두는 `beanProductId`, 직접 적은 원두는 `beanName`. */
export function useBeanSummary(
  by: { beanProductId: number } | { beanName: string },
  onSessionLost?: () => void,
  enabled = true,
) {
  const query = new URLSearchParams(
    "beanProductId" in by
      ? { beanProductId: String(by.beanProductId) }
      : { beanName: by.beanName },
  );
  return useQuery({
    queryKey: ["catalog", "bean-summary", by],
    enabled,
    queryFn: () =>
      authedRequest(backendUrl(`/api/v1/brew-logs/bean-summary?${query}`), {
        schema: beanSummarySchema,
        onSessionLost,
      }),
  });
}

/** 단건 조회를 훅으로. 화면 하나가 원두 하나를 다룰 때. */
export function useBeanProduct(
  id: number,
  onSessionLost?: () => void,
  enabled = true,
) {
  return useQuery({
    queryKey: ["catalog", "bean-product", id],
    enabled,
    queryFn: () => fetchBeanProduct(id, onSessionLost),
  });
}

/** 제품 한 건. 원두 이름을 만들려면 배치의 `beanProductId`로 이것을 읽어야 한다. */
export function fetchBeanProduct(
  id: number,
  onSessionLost?: () => void,
): Promise<BeanProduct> {
  return authedRequest(backendUrl(`/api/v1/bean-products/${id}`), {
    schema: beanProductSchema,
    onSessionLost,
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
  body: {
    roasterId: number;
    name: string;
    roastLevel: RoastLevel;
    country: string;
  },
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
