"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorMessageOf, ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { useRequireSession } from "@/features/auth/useRequireSession";
import { useBrewFilters, useBrewers } from "@/features/gear/queries";
import { useMe } from "@/features/user/queries";
import { ApiError } from "@/lib/api-client";
import {
  formatDuration,
  formatGrams,
  formatRatio,
  formatTemperature,
} from "@/lib/format";
import { deleteRecipe, fetchRecipe, forkRecipe } from "../api";
import type { Recipe } from "../schema";
import { DeleteRecipeDialog } from "./DeleteRecipeDialog";
import { RecipeStepList } from "./RecipeStepList";

export function RecipeDetail({ id }: { id: number }) {
  const router = useRouter();
  const { ready, onSessionLost } = useRequireSession();

  const recipeQuery = useQuery({
    queryKey: ["recipe", id],
    queryFn: () => fetchRecipe(id, onSessionLost),
    enabled: ready,
  });

  const brewers = useBrewers(onSessionLost);
  const filters = useBrewFilters(onSessionLost);
  const me = useMe(onSessionLost);

  const queryClient = useQueryClient();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const fork = useMutation({
    mutationFn: () => forkRecipe(id, onSessionLost),
    // 포크한 뒤 바로 고칠 수 있게 편집 화면으로 보낸다(WEBEDIT 스펙이 기존 AC-WEB-24를 대체했다).
    onSuccess: (created) => router.push(`/recipes/${created.id}/edit`),
  });

  const remove = useMutation({
    mutationFn: () => deleteRecipe(id, onSessionLost),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["recipes"] });
      router.push("/recipes");
    },
  });

  if (!ready || recipeQuery.isPending) {
    return (
      <Shell>
        <LoadingState />
      </Shell>
    );
  }

  if (recipeQuery.error) {
    // 없는 레시피는 되돌릴 수 없다. "다시 시도"를 주면 눌러도 같은 404가 온다.
    if (
      recipeQuery.error instanceof ApiError &&
      recipeQuery.error.code === "NOT_FOUND"
    ) {
      return (
        <Shell>
          <p className="py-12 text-center text-sm text-muted">
            레시피를 찾을 수 없습니다
          </p>
        </Shell>
      );
    }
    return (
      <Shell>
        <ErrorState
          error={recipeQuery.error}
          onRetry={() => void recipeQuery.refetch()}
        />
      </Shell>
    );
  }

  const recipe = recipeQuery.data;
  const brewer = brewers.data?.find((item) => item.id === recipe.brewerId);
  const filter = filters.data?.find((item) => item.id === recipe.filterId);
  // ownerUserId가 없으면 주인 없는 CURATED다 — 내 것이 아니므로 포크할 수 있다.
  const isMine = me.data !== undefined && recipe.ownerUserId === me.data.id;

  return (
    <Shell>
      <header>
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-xl font-semibold">{recipe.title}</h1>
          {recipe.sourceType === "CURATED" && (
            <span className="shrink-0 rounded bg-surface px-2 py-1 text-xs text-muted">
              CURATED
            </span>
          )}
        </div>

        {recipe.authorName && (
          <p className="mt-1 text-sm text-muted">
            {recipe.sourceUrl ? (
              <a
                href={recipe.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                {recipe.authorName}
              </a>
            ) : (
              recipe.authorName
            )}
          </p>
        )}

        {recipe.description && (
          <p className="mt-3 text-sm text-muted">
            {recipe.description}
          </p>
        )}
      </header>

      {/*
        dl의 직계 자식은 dt·dd 또는 그것을 감싼 div만 허용된다. span을 그대로 두면
        파서가 교정하면서 서버 HTML과 클라이언트 트리가 어긋날 수 있다.
      */}
      <dl className="mt-4 flex flex-col gap-1">
        {/* 대표 수치. 상세에서 정확히 하나가 18px로 뜬다. 라벨은 sr-only다 —
            18px 숫자 옆에 12px 라벨을 붙이면 대표 수치가 깎인다. */}
        <div className="flex items-center gap-1 text-lg font-semibold tabular-nums">
          <dt className="sr-only">원두량</dt>
          <dd>{formatGrams(recipe.doseG)}</dd>
          <span aria-hidden className="text-muted">
            →
          </span>
          <dt className="sr-only">물량</dt>
          <dd>{formatGrams(recipe.waterG)}</dd>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <div className="flex items-center gap-1">
            <dt className="text-xs text-muted">비율</dt>
            <dd>{formatRatio(recipe.ratio)}</dd>
          </div>

          {recipe.waterTempC !== undefined && (
            <div className="flex items-center gap-1">
              <dt className="text-xs text-muted">물 온도</dt>
              <dd>{formatTemperature(recipe.waterTempC)}</dd>
            </div>
          )}

          {recipe.totalTimeSeconds !== undefined && (
            <div className="flex items-center gap-1">
              <dt className="text-xs text-muted">총 시간</dt>
              <dd>{formatDuration(recipe.totalTimeSeconds)}</dd>
            </div>
          )}
        </div>
      </dl>

      {(brewer || filter) && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted">
          {brewer && <span>{`${brewer.brand} ${brewer.name}`}</span>}
          {filter && <span>{filter.name}</span>}
        </div>
      )}

      {recipe.grindSettingValue !== undefined && (
        <section className="mt-4">
          <h2 className="text-sm font-medium">분쇄도</h2>
          <p className="mt-1 text-sm text-muted">
            {recipe.grindSettingValue}
            {recipe.grindSettingUnit === "CLICK" && "클릭"}
            {recipe.grindSettingUnit === "NUMBER" && "눈금"}
            {recipe.grindSettingUnit === "MICRON" && "µm"}
            {recipe.grindMicronEstimated !== undefined && (
              <span className="ml-2 text-muted">
                약 {recipe.grindMicronEstimated}µm{" "}
                <span className="text-xs">(추정치)</span>
              </span>
            )}
          </p>
        </section>
      )}

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-medium">푸어 스텝</h2>
        <RecipeStepList steps={recipe.steps} />
      </section>

      {/*
        `POST /brew-logs`는 본인 소유 레시피만 받는다(BrewLogService.requireOwnedRecipe).
        남의 레시피에 진입점을 두면 눌렀을 때 403이 난다 — 포크라는 정답으로 안내한다.
      */}
      {isMine ? (
        <Link
          href={`/brews/new?recipeId=${id}`}
          className="flex min-h-11 min-w-11 items-center justify-center mt-6 block rounded-md bg-brand py-3 text-center text-sm font-medium text-on-accent"
        >
          이 레시피로 내렸다
        </Link>
      ) : (
        <p className="mt-6 text-center text-sm text-muted">
          포크한 뒤 기록할 수 있습니다
        </p>
      )}

      {isMine && (
        <div className="mt-3 flex gap-2">
          <Link
            href={`/recipes/${id}/edit`}
            className="flex min-h-11 min-w-11 items-center justify-center flex-1 rounded-md border border-line py-3 text-center text-sm font-medium"
          >
            편집
          </Link>
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-danger px-4 py-3 text-sm font-medium text-danger"
          >
            삭제
          </button>
        </div>
      )}

      {isMine && remove.error && (
        <p className="mt-2 text-center text-sm text-danger">
          {errorMessageOf(remove.error)}
        </p>
      )}

      {confirmingDelete && (
        <DeleteRecipeDialog
          title={recipe.title}
          deleting={remove.isPending}
          onConfirm={() => remove.mutate()}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}

      {!isMine && (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => fork.mutate()}
            disabled={fork.isPending}
            className="flex min-h-11 min-w-11 items-center justify-center w-full rounded-md bg-brand py-3 text-sm font-medium text-on-accent disabled:opacity-50"
          >
            내 레시피로 가져오기
          </button>

          {fork.error && (
            <p className="mt-2 text-center text-sm text-danger">
              {errorMessageOf(fork.error)}
            </p>
          )}
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto w-full max-w-2xl px-4 py-6">{children}</main>;
}

export type { Recipe };
