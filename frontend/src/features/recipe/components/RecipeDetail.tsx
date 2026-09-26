"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { ROAST_OPTIONS } from "../filterOptions";
import type { Recipe } from "../schema";
import { DeleteRecipeDialog } from "./DeleteRecipeDialog";
import { RecipeStepList } from "./RecipeStepList";
import { statusLabel } from "@/lib/statusLabel";
import { Button, ButtonLink, Hero, MetricRow, Shell } from "@/components/ui";

function roastLabel(level: Recipe["recommendedRoastLevel"]): string {
  return ROAST_OPTIONS.find((opt) => opt.value === level)?.label ?? level;
}

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
    // 담긴 레시피로 곧장 이동한다 — 편집이 아니라 상세다(AC-RECIPESBREWS-74가
    // 기존 AC-WEBEDIT-06의 편집 이동을 대체했다).
    onSuccess: (created) => router.push(`/recipes/${created.id}`),
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
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  if (recipeQuery.error) {
    // 없는 레시피는 되돌릴 수 없다. "다시 시도"를 주면 눌러도 같은 404가 온다.
    if (
      recipeQuery.error instanceof ApiError &&
      recipeQuery.error.code === "NOT_FOUND"
    ) {
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
        <ErrorState
          error={recipeQuery.error}
          onRetry={() => void recipeQuery.refetch()}
        />
      </Screen>
    );
  }

  const recipe = recipeQuery.data;
  const brewer = brewers.data?.find((item) => item.id === recipe.brewerId);
  const filter = filters.data?.find((item) => item.id === recipe.filterId);
  // ownerUserId가 없으면 주인 없는 CURATED다 — 내 것이 아니므로 포크할 수 있다.
  const isMine = me.data !== undefined && recipe.ownerUserId === me.data.id;

  return (
    <Screen>
      <header>
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-page-title font-semibold">{recipe.title}</h1>
          {recipe.sourceType === "CURATED" && (
            <span className="shrink-0 rounded-tag bg-surface px-2 py-1 text-body-sm text-ink-3">
              {statusLabel("source", "CURATED")}
            </span>
          )}
        </div>

        {recipe.authorName && (
          <p className="mt-1 text-body text-ink-3">
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
          <p className="mt-3 text-body text-ink-3">{recipe.description}</p>
        )}
      </header>

      {/*
        히어로는 원두량·온도유형·추천 배전도다(AC-RECIPESBREWS-73) — 배치 크기에 좌우되는
        도즈가 "이 레시피가 어느 규모인가"를 가장 먼저 답한다.
      */}
      <Hero eyebrow="원두량" lead={formatGrams(recipe.doseG)} className="mt-4">
        <dl className="grid grid-cols-2 gap-x-4">
          <MetricRow
            label="온도"
            value={recipe.temperatureType === "ICE" ? "Ice" : "Hot"}
            tone="hero"
          />
          <MetricRow
            label="추천 배전도"
            value={roastLabel(recipe.recommendedRoastLevel)}
            tone="hero"
          />
        </dl>
      </Hero>

      {/*
        물량·물 온도·총 시간은 메타줄 라벨로 보여야 한다(AC-CONSIST-05) — sr-only가 아니다.
        구분자 "·"는 쓰지 않는다(AC-CONSIST-02). 비율은 이 스펙 AC는 아니지만 값 자체는
        여전히 필요하다(AC-WEB-14).
      */}
      <dl className="mt-2 grid grid-cols-2 gap-x-4">
        <MetricRow label="물량" value={formatGrams(recipe.waterG)} />
        <MetricRow label="비율" value={formatRatio(recipe.ratio)} />
        {recipe.waterTempC !== undefined && (
          <MetricRow
            label="물 온도"
            value={formatTemperature(recipe.waterTempC)}
          />
        )}
        {recipe.totalTimeSeconds !== undefined && (
          <MetricRow
            label="총 시간"
            value={formatDuration(recipe.totalTimeSeconds)}
          />
        )}
      </dl>

      {/*
        원장의 나머지 — 기구(AC-RECIPESBREWS-73). 총 시간은 위 메타줄이, 분쇄도는
        아래 분쇄도 섹션이 각자 보여준다 — 굳이 한 블록에 몰아넣지 않는다.
      */}
      {(brewer || filter) && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-body text-ink-3">
          {brewer && <span>{`${brewer.brand} ${brewer.name}`}</span>}
          {filter && <span>{filter.name}</span>}
        </div>
      )}

      {recipe.grindSettingValue !== undefined && (
        <section className="mt-4">
          <h2 className="text-card-title font-medium">분쇄도</h2>
          <p className="mt-1 text-body text-ink-3">
            {recipe.grindSettingValue}
            {recipe.grindSettingUnit === "CLICK" && "클릭"}
            {recipe.grindSettingUnit === "NUMBER" && "눈금"}
            {recipe.grindSettingUnit === "MICRON" && "µm"}
            {recipe.grindMicronEstimated !== undefined && (
              <span className="ml-2 text-ink-3">
                약 {recipe.grindMicronEstimated}µm{" "}
                <span className="text-body-sm">(추정치)</span>
              </span>
            )}
          </p>
        </section>
      )}

      <section className="mt-6">
        <h2 className="mb-2 text-card-title font-medium">푸어 스텝</h2>
        <RecipeStepList steps={recipe.steps} />
      </section>

      {/*
        `POST /brew-logs`는 볼 수 있는 레시피면 받는다(RecipeService.requireViewable) — 담지
        않고도 「바로 내리기」로 곧장 기록할 수 있다(AC-RECIPESBREWS-81).
      */}
      {isMine ? (
        <ButtonLink href={`/brews/new?recipeId=${id}`} variant="primary">
          이 레시피로 내렸다
        </ButtonLink>
      ) : (
        <ButtonLink href={`/brews/new?recipeId=${id}`} variant="primary">
          이 레시피로 바로 내리기
        </ButtonLink>
      )}

      {isMine && (
        <div className="mt-3 flex gap-2">
          <ButtonLink href={`/recipes/${id}/edit`}>편집</ButtonLink>
          <Button onClick={() => setConfirmingDelete(true)}>삭제</Button>
        </div>
      )}

      {isMine && remove.error && (
        <p className="mt-2 text-center text-body text-danger">
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
        <div className="mt-3">
          <Button
            onClick={() => fork.mutate()}
            disabled={fork.isPending}
            block
          >
            내 서랍에 담기
          </Button>

          {fork.error && (
            <p className="mt-2 text-center text-body text-danger">
              {errorMessageOf(fork.error)}
            </p>
          )}
        </div>
      )}
    </Screen>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return <Shell>{children}</Shell>;
}

export type { Recipe };
