"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { LoadingState } from "@/components/LoadingState";
import { useRequireSession } from "@/features/auth/useRequireSession";
import { ApiError } from "@/lib/api-client";
import { fetchRecipe, updateRecipe } from "../api";
import { fromRecipe, type RecipeRequestBody } from "../formState";
import { RecipeForm } from "./RecipeForm";
import { Button, Shell } from "@/components/ui";

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
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  if (recipe.error) {
    // 없는 레시피는 되돌릴 수 없다. "다시 시도"를 줘도 같은 404가 온다.
    if (recipe.error instanceof ApiError && recipe.error.code === "NOT_FOUND") {
      return (
        <Screen>
          <p className="py-12 text-center text-body text-ink-3">
            레시피를 찾을 수 없습니다
          </p>
        </Screen>
      );
    }
    return (
      <Screen>
        {/* S7 — 편집 진입 실패는 서버 문구가 아니라 목업 문구로 말한다. */}
        <div role="alert" className="flex flex-col items-start gap-3 py-12">
          <p className="text-body text-ink">레시피를 불러오지 못했습니다.</p>
          <Button onClick={() => void recipe.refetch()}>다시 시도</Button>
        </div>
      </Screen>
    );
  }

  // 제목은 폼이 그린다(웹·모바일 모양이 다르다).
  return (
    <Shell wide>
      <RecipeForm
        mode="edit"
        initial={fromRecipe(recipe.data)}
        micronEstimated={recipe.data.grindMicronEstimated}
        submitting={update.isPending}
        error={update.error}
        onSubmit={(body) => update.mutate(body)}
        onCancel={() => router.push(`/recipes/${recipeId}`)}
        onSessionLost={onSessionLost}
      />
    </Shell>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <Shell stack>
      <h1 className="text-page-title font-semibold">레시피 수정</h1>
      {children}
    </Shell>
  );
}
