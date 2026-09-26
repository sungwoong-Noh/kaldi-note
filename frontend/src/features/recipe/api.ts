import { z } from "zod";
import { backendUrl } from "@/lib/api-client";
import { authedRequest } from "@/lib/authed-fetch";
import type { RecipeRequestBody } from "./formState";
import {
  recipePageSchema,
  recipeSchema,
  type Recipe,
  type RecipePage,
} from "./schema";

export const RECIPE_PAGE_SIZE = 20;

/** GET /recipes의 검색·필터 파라미터. 레시피 서랍 화면 스펙(RECIPESBREWS)의 URL 쿼리와 1:1이다. */
export interface RecipeSearchFilter {
  scope: "DRAWER" | "PUBLIC";
  q?: string;
  temp?: "HOT" | "ICE";
  roast?: Array<"LIGHT" | "MEDIUM" | "DARK">;
  doseMin?: number;
  doseMax?: number;
  dripper?: Array<"V60" | "KALITA" | "ORIGAMI" | "CLEVER">;
  owner?: "MINE" | "SAVED";
  sort?: "RECENT";
}

export function searchRecipes(
  page: number,
  onSessionLost: (() => void) | undefined,
  filter: RecipeSearchFilter,
): Promise<RecipePage> {
  const query = new URLSearchParams({
    page: String(page),
    size: String(RECIPE_PAGE_SIZE),
    scope: filter.scope,
  });
  if (filter.owner) query.set("owner", filter.owner);
  if (filter.q) query.set("q", filter.q);
  if (filter.temp) query.set("temp", filter.temp);
  for (const r of filter.roast ?? []) query.append("roast", r);
  if (filter.doseMin != null) query.set("doseMin", String(filter.doseMin));
  if (filter.doseMax != null) query.set("doseMax", String(filter.doseMax));
  for (const d of filter.dripper ?? []) query.append("dripper", d);
  if (filter.sort) query.set("sort", filter.sort);
  return authedRequest(backendUrl(`/api/v1/recipes?${query.toString()}`), {
    schema: recipePageSchema,
    onSessionLost,
  });
}

export function fetchRecipe(
  id: number,
  onSessionLost?: () => void,
): Promise<Recipe> {
  return authedRequest(backendUrl(`/api/v1/recipes/${id}`), {
    schema: recipeSchema,
    onSessionLost,
  });
}

export function forkRecipe(
  id: number,
  onSessionLost?: () => void,
): Promise<Recipe> {
  return authedRequest(backendUrl(`/api/v1/recipes/${id}/fork`), {
    method: "POST",
    schema: recipeSchema,
    onSessionLost,
  });
}

export function createRecipe(
  body: RecipeRequestBody,
  onSessionLost?: () => void,
): Promise<Recipe> {
  return authedRequest(backendUrl("/api/v1/recipes"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    schema: recipeSchema,
    onSessionLost,
  });
}

/** 전체 교체다. 스텝은 통째로 갈아끼운다(레시피 CRUD 스펙의 `RECIPE-10`). */
export function updateRecipe(
  id: number,
  body: RecipeRequestBody,
  onSessionLost?: () => void,
): Promise<Recipe> {
  return authedRequest(backendUrl(`/api/v1/recipes/${id}`), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    schema: recipeSchema,
    onSessionLost,
  });
}

/** 소프트 삭제. 성공하면 204라 본문이 없다. */
export function deleteRecipe(
  id: number,
  onSessionLost?: () => void,
): Promise<void> {
  return authedRequest(backendUrl(`/api/v1/recipes/${id}`), {
    method: "DELETE",
    schema: z.void(),
    onSessionLost,
  });
}
