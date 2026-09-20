"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchBeanProduct } from "@/features/catalog/api";
import type { RoastLevel } from "@/features/catalog/schema";
import { fetchBeanBatch } from "@/features/inventory/api";

/** brewlog/useEntityLabels.useBeanLabel과 같은 쿼리 키를 쓴다 — 캐시를 공유해 요청이 늘지 않는다. */
const STALE_MS = 5 * 60 * 1000;

/**
 * 로그가 가리키는 원두의 로스팅 강도. `beanBatchId`가 없으면(원두를 연결하지 않은 기록) 훅
 * 자체가 비활성이라 요청이 나가지 않고 `undefined`를 돌려준다(AC-HOMECAL-76).
 */
export function useRoastLevel(
  beanBatchId: number | undefined,
  enabled: boolean,
  onSessionLost?: () => void,
): RoastLevel | undefined {
  const batch = useQuery({
    queryKey: ["inventory", "bean-batch", beanBatchId],
    queryFn: () => fetchBeanBatch(beanBatchId as number, onSessionLost),
    staleTime: STALE_MS,
    enabled: enabled && beanBatchId !== undefined,
  });

  const productId = batch.data?.beanProductId;
  const product = useQuery({
    queryKey: ["catalog", "bean-product", productId],
    queryFn: () => fetchBeanProduct(productId as number, onSessionLost),
    staleTime: STALE_MS,
    enabled: enabled && productId !== undefined,
  });

  return product.data?.roastLevel;
}
