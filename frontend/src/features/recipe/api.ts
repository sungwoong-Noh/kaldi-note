import { backendUrl } from "@/lib/api-client";
import { authedRequest } from "@/lib/authed-fetch";
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
