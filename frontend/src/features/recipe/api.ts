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

export function fetchRecipePage(
  page: number,
  onSessionLost?: () => void,
): Promise<RecipePage> {
  const query = new URLSearchParams({
    page: String(page),
    size: String(RECIPE_PAGE_SIZE),
  });
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
