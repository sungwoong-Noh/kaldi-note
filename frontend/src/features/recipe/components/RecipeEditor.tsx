"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { LoadingState } from "@/components/LoadingState";
import { useRequireSession } from "@/features/auth/useRequireSession";
import { useMe } from "@/features/user/queries";
import { ApiError } from "@/lib/api-client";
import { fetchRecipe, forkRecipe, updateRecipe } from "../api";
import { fromRecipe, type RecipeRequestBody } from "../formState";
import type { Recipe } from "../schema";
import { RecipeForm } from "./RecipeForm";
import { Button, ButtonLink, Shell } from "@/components/ui";

export function RecipeEditor({ id: recipeId }: { id: number }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { ready, onSessionLost } = useRequireSession();

  const recipe = useQuery({
    queryKey: ["recipe", recipeId],
    queryFn: () => fetchRecipe(recipeId, onSessionLost),
    enabled: ready,
  });

  const me = useMe(onSessionLost);

  // 원본 제목·원두량은 포크본 응답에 없어 원본을 따로 읽는다. 실패하면 작성자만 보인다(AC-RECIPEEDIT-09).
  const parentId = recipe.data?.parentRecipeId;
  const parent = useQuery({
    queryKey: ["recipe", parentId],
    queryFn: () => fetchRecipe(parentId as number, onSessionLost),
    enabled: ready && parentId !== undefined,
    retry: false,
  });

  const fork = useMutation({
    mutationFn: () => forkRecipe(recipeId, onSessionLost),
    onSuccess: (created) => router.push(`/recipes/${created.id}/edit`),
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

  if (!ready || recipe.isPending || me.isPending) {
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

  // 서버도 저장 때 403으로 막지만, 남의 레시피로 폼을 열어 두면 고친 내용을 잃는다(#174). ownerUserId가 없으면 CURATED다.
  // `me`를 못 읽었으면 판정하지 않고 폼을 연다 — 저장은 서버가 막는다.
  if (me.data !== undefined && recipe.data.ownerUserId !== me.data.id) {
    return (
      <Screen>
        <div role="alert" className="flex flex-col items-start gap-3 py-12">
          <p className="text-body text-ink">내 레시피만 편집할 수 있습니다.</p>
          {fork.error && (
            <p className="text-body text-danger">{fork.error.message}</p>
          )}
          <div className="flex gap-2">
            <Button
              variant="primary"
              disabled={fork.isPending}
              onClick={() => fork.mutate()}
            >
              담아서 편집
            </Button>
            <ButtonLink href={`/recipes/${recipeId}`}>
              레시피로 돌아가기
            </ButtonLink>
          </div>
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
        originDoseG={parent.data?.doseG}
        banner={<OriginBanner recipe={recipe.data} parent={parent.data} />}
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

/** 담아온 레시피의 원본 배너(목업 M3). 작성자를 모르면 그리지 않는다. */
function OriginBanner({ recipe, parent }: { recipe: Recipe; parent?: Recipe }) {
  if (recipe.parentRecipeId === undefined || !recipe.sourceAuthorName) {
    return null;
  }
  const author = `${recipe.sourceAuthorName} 님의 레시피`;
  return (
    <div className="flex items-center gap-[10px] rounded-[8px] border border-divider bg-surface px-[14px] py-[10px]">
      <span className="rounded-[3px] bg-accent-wash px-[7px] py-[3px] font-mono text-[10px] tracking-[0.08em] text-accent">
        원본
      </span>
      <span className="min-w-0 truncate text-[13px] text-ink-2">
        {parent ? `${author} · ${parent.title}` : author}
      </span>
    </div>
  );
}
