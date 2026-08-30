"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { ErrorState } from "@/components/ErrorState";
import { useRequireSession } from "@/features/auth/useRequireSession";
import { ApiError } from "@/lib/api-client";
import { fetchRecipe, updateRecipe } from "../api";
import { fromRecipe, type RecipeRequestBody } from "../formState";
import { RecipeForm } from "./RecipeForm";

export function RecipeEditor({ id: recipeId }: { id: number }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { ready, onSessionLost } = useRequireSession();

  const recipe = useQuery({
    queryKey: ["recipe", recipeId],
    queryFn: () => fetchRecipe(recipeId, onSessionLost),
    enabled: ready,
  });

  const update = useMutation({
    mutationFn: (body: RecipeRequestBody) =>
      updateRecipe(recipeId, body, onSessionLost),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["recipe", recipeId] });
      void queryClient.invalidateQueries({ queryKey: ["recipes"] });
      router.push(`/recipes/${recipeId}`);
    },
  });

  if (!ready || recipe.isPending) {
    return <Shell>{null}</Shell>;
  }

  if (recipe.error) {
    // 없는 레시피는 되돌릴 수 없다. "다시 시도"를 줘도 같은 404가 온다.
    if (recipe.error instanceof ApiError && recipe.error.code === "NOT_FOUND") {
      return (
        <Shell>
          <p className="py-12 text-center text-sm text-neutral-500">
            레시피를 찾을 수 없습니다
          </p>
        </Shell>
      );
    }
    return (
      <Shell>
        <ErrorState error={recipe.error} onRetry={() => void recipe.refetch()} />
      </Shell>
    );
  }

  return (
    <Shell>
      <RecipeForm
        initial={fromRecipe(recipe.data)}
        submitting={update.isPending}
        error={update.error}
        onSubmit={(body) => update.mutate(body)}
        onSessionLost={onSessionLost}
      />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6">
      <h1 className="text-xl font-semibold">레시피 편집</h1>
      {children}
    </main>
  );
}
