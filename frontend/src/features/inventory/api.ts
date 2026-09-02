import { useQuery } from "@tanstack/react-query";
import { backendUrl } from "@/lib/api-client";
import { authedRequest } from "@/lib/authed-fetch";
import { beanBatchListSchema, beanBatchSchema, type BeanBatch } from "./schema";

export function useBeanBatches(onSessionLost?: () => void) {
  return useQuery({
    queryKey: ["inventory", "bean-batches"],
    queryFn: () =>
      authedRequest(backendUrl("/api/v1/bean-batches"), {
        schema: beanBatchListSchema,
        onSessionLost,
      }),
  });
}

/**
 * 재고 한 건. **목록으로 대신할 수 없다** — `GET /bean-batches`는 내 재고만 주므로 남의 배치는
 * "목록에 없음"으로만 나타나 「권한이 없다」(403)와 「삭제됐다」(404)를 가를 수 없다.
 */
export function fetchBeanBatch(
  id: number,
  onSessionLost?: () => void,
): Promise<BeanBatch> {
  return authedRequest(backendUrl(`/api/v1/bean-batches/${id}`), {
    schema: beanBatchSchema,
    onSessionLost,
  });
}

export function createBeanBatch(
  body: { beanProductId: number; weightG: number; roastedAt: string },
  onSessionLost?: () => void,
): Promise<BeanBatch> {
  return authedRequest(backendUrl("/api/v1/bean-batches"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    schema: beanBatchSchema,
    onSessionLost,
  });
}
