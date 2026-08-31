import { useQuery } from "@tanstack/react-query";
import { backendUrl } from "@/lib/api-client";
import { authedRequest } from "@/lib/authed-fetch";
import {
  beanBatchListSchema,
  beanBatchSchema,
  type BeanBatch,
} from "./schema";

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
