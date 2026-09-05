"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { useRequireSession } from "@/features/auth/useRequireSession";
import { useBeanProducts, useRoasters } from "@/features/catalog/api";
import { useUserGrinders } from "@/features/gear/queries";
import type { UserGrinder } from "@/features/gear/schema";
import { useBeanBatches } from "@/features/inventory/api";
import type { BeanBatch } from "@/features/inventory/schema";
import { fetchRecipe } from "@/features/recipe/api";
import type { Recipe } from "@/features/recipe/schema";
import { ApiError } from "@/lib/api-client";
import { mapFieldErrors } from "@/lib/fieldErrors";
import { createBrewLog } from "../api";
import {
  initialFormState,
  toRequestBody,
  type BrewLogFormState,
} from "../formState";
import { BeanBatchDialog } from "./BeanBatchDialog";
import { BrewLogFields } from "./BrewLogFields";
import { UserGrinderDialog } from "./UserGrinderDialog";

/**
 * 로그 작성 화면.
 *
 * <p>레시피와 내 그라인더가 <b>둘 다 도착한 뒤에</b> 폼을 마운트한다. 그라인더 자동 선택이 두 응답을 함께 봐야 정해지는데,
 * 폼을 먼저 띄우면 나중에 도착한 값으로 사용자가 고친 입력을 덮어쓰게 된다.
 */
export function BrewLogForm({ recipeId }: { recipeId: number }) {
  const { ready, onSessionLost } = useRequireSession();

  const recipe = useQuery({
    queryKey: ["recipe", recipeId],
    queryFn: () => fetchRecipe(recipeId, onSessionLost),
    enabled: ready,
  });
  const grinders = useUserGrinders(onSessionLost);

  const failure = recipe.error ?? grinders.error;
  if (failure) {
    return (
      <Shell>
        <ErrorState
          error={failure}
          onRetry={() => {
            void recipe.refetch();
            void grinders.refetch();
          }}
        />
      </Shell>
    );
  }

  // 두 쿼리를 섞으면 `isPending`만으로는 타입이 좁혀지지 않는다. 데이터 자체를 조건으로 쓴다.
  if (!ready || !recipe.data || !grinders.data) {
    return (
      <Shell>
        <LoadingState />
      </Shell>
    );
  }

  return (
    <Shell>
      <Fields
        recipe={recipe.data}
        grinders={grinders.data}
        onSessionLost={onSessionLost}
      />
    </Shell>
  );
}

function Fields({
  recipe,
  grinders,
  onSessionLost,
}: {
  recipe: Recipe;
  grinders: UserGrinder[];
  onSessionLost: () => void;
}) {
  const queryClient = useQueryClient();
  // 원두 선택란 하나를 그리려고 세 목록을 다 부른다 — 재고는 `beanProductId`만 주고
  // 제품은 `roasterId`만 주기 때문이다. 셋 다 사용자당 몇 건 수준이라 감당할 만하다.
  const batches = useBeanBatches(onSessionLost);
  const products = useBeanProducts(onSessionLost);
  const roasters = useRoasters(onSessionLost);
  // 초기값은 마운트 시점에 한 번만 계산한다. 이후 그라인더 목록이 갱신돼도
  // 사용자가 고쳐둔 값을 덮어쓰지 않는다.
  const [state, setState] = useState<BrewLogFormState>(() =>
    initialFormState(recipe, grinders),
  );
  const [addingGrinder, setAddingGrinder] = useState(false);
  const [addingBean, setAddingBean] = useState(false);
  const router = useRouter();

  const save = useMutation({
    mutationFn: () => createBrewLog(toRequestBody(state), onSessionLost),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ["brew-logs"] });
      router.push(`/brews/${created.id}`);
    },
  });

  const fieldErrors =
    save.error instanceof ApiError
      ? mapFieldErrors(save.error.fieldErrors)
      : null;

  const set = <K extends keyof BrewLogFormState>(
    key: K,
    value: BrewLogFormState[K],
  ) => setState((prev) => ({ ...prev, [key]: value }));

  // `내린 시각`과 `그라인더` 사이에 들어간다. 편집 화면은 여기에 잠긴 원두 표시를 넣는다.
  const beanSlot = (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-base font-semibold">원두</legend>
      {(batches.data ?? []).length === 0 && !batches.isPending && (
        <p className="text-sm text-neutral-500">등록된 원두가 없습니다</p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1 text-sm">
          <span className="text-neutral-500">원두</span>
          <select
            aria-label="원두"
            value={state.beanBatchId ?? ""}
            onChange={(e) =>
              set(
                "beanBatchId",
                e.target.value === "" ? null : Number(e.target.value),
              )
            }
            className="rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700"
          >
            <option value="">선택 안 함</option>
            {(batches.data ?? []).map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batchLabel(batch, products.data ?? [], roasters.data ?? [])}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => setAddingBean(true)}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
        >
          + 원두 등록
        </button>
      </div>
    </fieldset>
  );

  return (
    <div className="flex flex-col gap-5">
      <BrewLogFields
        state={state}
        grinders={grinders}
        fieldErrors={fieldErrors}
        onChange={set}
        onAddGrinder={() => setAddingGrinder(true)}
        beanSlot={beanSlot}
      />

      {save.error && (
        <p className="text-sm text-red-600">{save.error.message}</p>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={save.isPending}
          onClick={() => save.mutate()}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          기록하기
        </button>
        <button
          type="button"
          onClick={() => router.push(`/recipes/${recipe.id}`)}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700"
        >
          취소
        </button>
      </div>

      {addingGrinder && (
        <UserGrinderDialog
          onCreated={(created) => {
            // 목록을 다시 읽어 선택란에 나타나게 하고, 방금 만든 것을 골라 둔다.
            void queryClient.invalidateQueries({
              queryKey: ["gear", "user-grinders"],
            });
            set("userGrinderId", created.id);
            setAddingGrinder(false);
          }}
          onCancel={() => setAddingGrinder(false)}
          onSessionLost={onSessionLost}
        />
      )}

      {addingBean && (
        <BeanBatchDialog
          onCreated={(created) => {
            // 재고 목록만 무효화하면 선택란에 나타나지만, 라벨은 제품·로스터가 있어야 완성된다.
            void queryClient.invalidateQueries({ queryKey: ["inventory"] });
            void queryClient.invalidateQueries({ queryKey: ["catalog"] });
            set("beanBatchId", created.id);
            setAddingBean(false);
          }}
          onCancel={() => setAddingBean(false)}
          onSessionLost={onSessionLost}
        />
      )}
    </div>
  );
}

/**
 * `프릿츠 예가체프 · 3일차`.
 *
 * <p>재고 응답은 `beanProductId`만, 제품 응답은 `roasterId`만 준다. 이름을 보여주려면 세 목록을 조합해야 한다.
 * 아직 도착하지 않은 목록이 있으면 있는 것만으로 만든다 — 빈 선택지보다는 낫다.
 */
function batchLabel(
  batch: BeanBatch,
  products: { id: number; name: string; roasterId: number }[],
  roasters: { id: number; name: string }[],
): string {
  const product = products.find((p) => p.id === batch.beanProductId);
  const roaster = roasters.find((r) => r.id === product?.roasterId);
  const name = [roaster?.name, product?.name].filter(Boolean).join(" ");
  const age =
    batch.daysOffRoast === undefined ? null : `${batch.daysOffRoast}일차`;

  return [name === "" ? `재고 ${batch.id}` : name, age]
    .filter(Boolean)
    .join(" · ");
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6">
      <h1 className="text-xl font-semibold">이 레시피로 내렸다</h1>
      {children}
    </main>
  );
}
