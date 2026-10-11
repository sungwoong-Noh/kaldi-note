"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchBeanProduct, useRoasters } from "@/features/catalog/api";
import { useBrewers } from "@/features/gear/queries";
import { fetchBeanBatch } from "@/features/inventory/api";
import { fetchRecipe } from "@/features/recipe/api";
import type { RecipeStep } from "@/features/recipe/schema";
import { beanName, combineSources, entityLabel } from "./entityLabel";
import type { BrewLogSummary } from "./schema";

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
 *
 * <p><b>이름과 함께 푸어 스텝도 내보낸다.</b> 같은 응답 안에 이미 들어 있어 새 요청이 늘지 않는다.
 * 못 읽었으면 빈 배열이지만, 그때는 `isReady`가 false라 화면이 스텝 절 자체를 그리지 않는다.
 */
/** 레시피가 설계한 수치. 기록의 실측값과 나란히 놓으려고 꺼낸다. */
export interface RecipeTargets {
  readonly doseG: number;
  readonly waterG: number;
  readonly waterTempC?: number;
  readonly totalTimeSeconds?: number;
  /** 분쇄도 기준 표시는 같은 모델일 때만 낸다(AC-BREWFIT-09) */
  readonly grinderModelId?: number;
  readonly grindSettingValue?: number;
  readonly grindSettingUnit?: "CLICK" | "NUMBER" | "MICRON";
}

export function useRecipeLabel(
  recipeId: number | undefined,
  enabled: boolean,
  onSessionLost?: () => void,
): EntityLabel & {
  readonly steps: RecipeStep[];
  readonly targets?: RecipeTargets;
} {
  const recipe = useQuery({
    queryKey: ["recipe", recipeId],
    queryFn: () => fetchRecipe(recipeId as number, onSessionLost),
    staleTime: NAME_STALE_MS,
    enabled: enabled && recipeId !== undefined,
  });

  const source = combineSources([recipe], recipe.data?.title);
  const data = recipe.data;
  return {
    label: entityLabel("recipe", source),
    isReady: source.state === "ready",
    steps: data?.steps ?? [],
    // 스텝과 같은 응답에 들어 있다 — 새 요청이 늘지 않는다.
    targets:
      data === undefined
        ? undefined
        : {
            doseG: data.doseG,
            waterG: data.waterG,
            waterTempC: data.waterTempC,
            totalTimeSeconds: data.totalTimeSeconds,
            grinderModelId: data.grinderModelId,
            grindSettingValue: data.grindSettingValue,
            grindSettingUnit: data.grindSettingUnit,
          },
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

/**
 * 기록 보조줄의 조각 — 읽은 원두 이름과 레시피의 드리퍼(`Hario V60 02`). 못 읽은 조각은 빠진다 —
 * `비공개 원두` 같은 대체 문구를 보조줄에 쓰지 않는다. 레시피는 `useRecipeLabel`과 같은 키라 요청이
 * 늘지 않는다. 「내 잔」 표와 홈 웹 카드가 같이 쓴다
 * (docs/specs/2026-10-10-my-cups-ledger.md AC-MYCUPS-15, docs/specs/2026-10-11-home-fidelity.md AC-HOMEFIT-11).
 */
export function useBrewSubParts(log: BrewLogSummary): string[] {
  const bean = useBeanLabel(log.beanBatchId, log.beanBatchId !== undefined);
  const recipe = useQuery({
    queryKey: ["recipe", log.recipeId],
    queryFn: () => fetchRecipe(log.recipeId),
    staleTime: NAME_STALE_MS,
  });
  const brewers = useBrewers();
  const brewer = brewers.data?.find(
    (item) => item.id === recipe.data?.brewerId,
  );
  return [
    log.beanBatchId !== undefined && bean.isReady ? bean.label : undefined,
    brewer ? `${brewer.brand} ${brewer.name}` : undefined,
  ].filter((part): part is string => part !== undefined);
}
