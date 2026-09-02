"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useRequireSession } from "@/features/auth/useRequireSession";
import { createRecipe } from "@/features/recipe/api";
import { RecipeForm } from "@/features/recipe/components/RecipeForm";
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
    return <Shell>{null}</Shell>;
  }

  return (
    <Shell>
      <RecipeForm
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

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6">
      <h1 className="text-xl font-semibold">새 레시피</h1>
      {children}
    </main>
  );
}
