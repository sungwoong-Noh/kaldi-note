"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { LoadingState } from "@/components/LoadingState";
import { useRequireSession } from "@/features/auth/useRequireSession";
import { createRecipe } from "@/features/recipe/api";
import { RecipeForm } from "@/features/recipe/components/RecipeForm";
import { Shell } from "@/components/ui";
import {
  emptyFormState,
  type RecipeRequestBody,
} from "@/features/recipe/formState";

export default function RecipeNewPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { ready, onSessionLost } = useRequireSession();

  const create = useMutation({
    mutationFn: (body: RecipeRequestBody) => createRecipe(body, onSessionLost),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ["recipes"] });
      router.push(`/recipes/${created.id}`);
    },
  });

  if (!ready) {
    return (
      <Shell stack>
        <LoadingState />
      </Shell>
    );
  }

  // 제목은 폼이 그린다(웹·모바일 모양이 다르다).
  return (
    <Shell wide>
      <RecipeForm
        mode="create"
        initial={emptyFormState()}
        submitting={create.isPending}
        error={create.error}
        onSubmit={(body) => create.mutate(body)}
        onCancel={() => router.push("/recipes")}
        onSessionLost={onSessionLost}
      />
    </Shell>
  );
}
