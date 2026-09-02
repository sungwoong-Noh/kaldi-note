"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchBeanProduct, useRoasters } from "@/features/catalog/api";
import { fetchBeanBatch } from "@/features/inventory/api";
import { fetchRecipe } from "@/features/recipe/api";
import { beanName, combineSources, entityLabel } from "./entityLabel";

/** 화면이 쓰는 것 둘. `isReady`는 「이름을 실제로 읽었는가」로, 링크를 걸어도 되는지 판단에 쓴다. */
export interface EntityLabel {
  readonly label: string;
  readonly isReady: boolean;
}

/** 이미 읽은 것을 다시 읽지 않을 시간. 이름은 한 화면을 보는 동안 거의 바뀌지 않는다. */
const NAME_STALE_MS = 5 * 60 * 1000;

/**
 * 로그가 가리키는 레시피의 이름. 못 읽으면 그 이유를 담은 문구를 돌려준다.
 *
 * <p>못 읽는 것이 정상 동작이다 — 남의 로그는 보이되 그 레시피는 `PRIVATE`이라 403일 수 있다.
 */
export function useRecipeLabel(
  recipeId: number | undefined,
  enabled: boolean,
  onSessionLost?: () => void,
): EntityLabel {
  const recipe = useQuery({
    queryKey: ["recipe", recipeId],
    queryFn: () => fetchRecipe(recipeId as number, onSessionLost),
    staleTime: NAME_STALE_MS,
    enabled: enabled && recipeId !== undefined,
  });

  const source = combineSources([recipe], recipe.data?.title);
  return {
    label: entityLabel("recipe", source),
    isReady: source.state === "ready",
  };
}

/**
 * 로그가 가리키는 원두의 이름. `프릿츠 예가체프`.
 *
 * <p><b>조회가 3단계다.</b> 배치 → 제품 → 로스터 목록. 응답이 각각 다음 단계의 id만 주기 때문이다.
 * 남의 로그면 첫 단계가 403이라 언제나 `비공개 원두`가 된다 — 재고는 개인 소유다.
 */
export function useBeanLabel(
  beanBatchId: number | undefined,
  enabled: boolean,
  onSessionLost?: () => void,
): EntityLabel {
  const batch = useQuery({
    queryKey: ["inventory", "bean-batch", beanBatchId],
    queryFn: () => fetchBeanBatch(beanBatchId as number, onSessionLost),
    staleTime: NAME_STALE_MS,
    enabled: enabled && beanBatchId !== undefined,
  });

  const productId = batch.data?.beanProductId;
  const product = useQuery({
    queryKey: ["catalog", "bean-product", productId],
    queryFn: () => fetchBeanProduct(productId as number, onSessionLost),
    staleTime: NAME_STALE_MS,
    enabled: enabled && productId !== undefined,
  });

  const roasters = useRoasters(onSessionLost);
  const roaster = roasters.data?.find(
    (candidate) => candidate.id === product.data?.roasterId,
  );

  // 순서가 곧 「첫 실패」의 순서다. 배치가 403이면 그것이 잡혀야 `비공개 원두`가 된다.
  const source = combineSources(
    [batch, product, roasters],
    product.data === undefined ? undefined : beanName(product.data, roaster),
  );
  return {
    label: entityLabel("bean", source),
    isReady: source.state === "ready",
  };
}
