"use client";

import { useQueries } from "@tanstack/react-query";
import { fetchBeanProduct, useRoasters } from "@/features/catalog/api";
import type { BeanProduct, Roaster } from "@/features/catalog/schema";
import { useUserGrinders } from "@/features/gear/queries";
import { fetchBeanBatch } from "@/features/inventory/api";
import type { BeanBatch } from "@/features/inventory/schema";
import { fetchRecipe } from "@/features/recipe/api";
import type { BrewLogSummary } from "./schema";
import type { GrindSettingUnit } from "./todayPresentation";

const STALE_MS = 5 * 60 * 1000;

export interface BeanMetadataSources {
  readonly productsById: ReadonlyMap<number, BeanProduct>;
  readonly batchesById: ReadonlyMap<number, BeanBatch>;
  readonly roastersById: ReadonlyMap<number, Roaster>;
}

export interface TodayMetadata extends BeanMetadataSources {
  readonly recipeTitlesById: ReadonlyMap<number, string>;
  readonly recipeGrindUnitsById: ReadonlyMap<number, GrindSettingUnit>;
  readonly grinders: ReturnType<typeof useUserGrinders>["data"];
}

/** 목록·홈 행의 원두명·배전도를 풀기 위한 배치·제품·로스터 조회를 묶는다(그라인더 제외). */
export function useBeanMetadataSources(
  logs: readonly BrewLogSummary[],
  enabled: boolean,
  onSessionLost?: () => void,
): BeanMetadataSources {
  const batchIds = [
    ...new Set(
      logs
        .filter(
          (log) =>
            log.beanProductId === undefined &&
            log.beanName === undefined &&
            log.beanBatchId !== undefined,
        )
        .map((log) => log.beanBatchId as number),
    ),
  ];

  const batchQueries = useQueries({
    queries: batchIds.map((id) => ({
      queryKey: ["inventory", "bean-batch", id],
      queryFn: () => fetchBeanBatch(id, onSessionLost),
      staleTime: STALE_MS,
      enabled,
    })),
  });

  const batchesById = new Map<number, BeanBatch>();
  batchIds.forEach((id, index) => {
    const data = batchQueries[index]?.data;
    if (data !== undefined) batchesById.set(id, data);
  });

  const productIds = [
    ...new Set([
      ...logs
        .map((log) => log.beanProductId)
        .filter((id): id is number => id !== undefined),
      ...[...batchesById.values()].map((batch) => batch.beanProductId),
    ]),
  ];

  const productQueries = useQueries({
    queries: productIds.map((id) => ({
      queryKey: ["catalog", "bean-product", id],
      queryFn: () => fetchBeanProduct(id, onSessionLost),
      staleTime: STALE_MS,
      enabled,
    })),
  });

  const productsById = new Map<number, BeanProduct>();
  productIds.forEach((id, index) => {
    const data = productQueries[index]?.data;
    if (data !== undefined) productsById.set(id, data);
  });

  const roastersQuery = useRoasters(
    onSessionLost,
    enabled && (productIds.length > 0 || batchIds.length > 0),
  );
  const roastersById = new Map<number, Roaster>();
  for (const roaster of roastersQuery.data ?? []) {
    roastersById.set(roaster.id, roaster);
  }

  return { productsById, batchesById, roastersById };
}

/** 오늘 홈의 최근 기록 1~5건이 참조하는 원두·레시피·그라인더 정보만 선택적으로 모은다. */
export function useTodayMetadata(
  logs: readonly BrewLogSummary[],
  enabled: boolean,
  onSessionLost?: () => void,
): TodayMetadata {
  const { productsById, batchesById, roastersById } = useBeanMetadataSources(
    logs,
    enabled,
    onSessionLost,
  );

  const recipeIds = [
    ...new Set(
      logs
        .map((log) => log.recipeId)
        .filter((id): id is number => id !== undefined),
    ),
  ];

  const recipeQueries = useQueries({
    queries: recipeIds.map((id) => ({
      queryKey: ["recipe", id],
      queryFn: () => fetchRecipe(id, onSessionLost),
      staleTime: STALE_MS,
      enabled,
    })),
  });

  const recipeTitlesById = new Map<number, string>();
  const recipeGrindUnitsById = new Map<number, GrindSettingUnit>();
  recipeIds.forEach((id, index) => {
    const recipe = recipeQueries[index]?.data;
    if (recipe !== undefined) {
      recipeTitlesById.set(id, recipe.title);
      if (recipe.grindSettingUnit !== undefined) {
        recipeGrindUnitsById.set(id, recipe.grindSettingUnit);
      }
    }
  });

  const needsGrinders = logs.some((log) => log.userGrinderId !== undefined);
  const grindersQuery = useUserGrinders(
    onSessionLost,
    enabled && needsGrinders,
  );

  return {
    productsById,
    batchesById,
    roastersById,
    recipeTitlesById,
    recipeGrindUnitsById,
    grinders: grindersQuery.data,
  };
}
