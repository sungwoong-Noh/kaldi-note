"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ErrorState } from "@/components/ErrorState";
import { useRequireSession } from "@/features/auth/useRequireSession";
import { useUserGrinders } from "@/features/gear/queries";
import type { UserGrinder } from "@/features/gear/schema";
import { fetchRecipe } from "@/features/recipe/api";
import type { Recipe } from "@/features/recipe/schema";
import { initialFormState, type BrewLogFormState } from "../formState";
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
    return <Shell>{null}</Shell>;
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
  // 초기값은 마운트 시점에 한 번만 계산한다. 이후 그라인더 목록이 갱신돼도
  // 사용자가 고쳐둔 값을 덮어쓰지 않는다.
  const [state, setState] = useState<BrewLogFormState>(() =>
    initialFormState(recipe, grinders),
  );
  const [addingGrinder, setAddingGrinder] = useState(false);

  const set = <K extends keyof BrewLogFormState>(
    key: K,
    value: BrewLogFormState[K],
  ) => setState((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="flex flex-col gap-5">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-neutral-500">내린 시각</span>
        <input
          type="datetime-local"
          aria-label="내린 시각"
          value={state.brewedAt}
          onChange={(e) => set("brewedAt", e.target.value)}
          className="rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700"
        />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-base font-semibold">그라인더</legend>
        {grinders.length === 0 && (
          <p className="text-sm text-neutral-500">등록된 그라인더가 없습니다</p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1 text-sm">
            <span className="text-neutral-500">그라인더</span>
            <select
              aria-label="그라인더"
              value={state.userGrinderId ?? ""}
              onChange={(e) =>
                set(
                  "userGrinderId",
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
              className="rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700"
            >
              <option value="">선택 안 함</option>
              {grinders.map((grinder) => (
                <option key={grinder.id} value={grinder.id}>
                  {grinderLabel(grinder)}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => setAddingGrinder(true)}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
          >
            + 그라인더 등록
          </button>
        </div>

        <NumberField
          label="분쇄도 값"
          value={state.actualGrindSettingValue}
          onChange={(v) => set("actualGrindSettingValue", v)}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-base font-semibold">실측값</legend>
        <NumberField
          label="원두량"
          value={state.actualDoseG}
          onChange={(v) => set("actualDoseG", v)}
        />
        <NumberField
          label="물량"
          value={state.actualWaterG}
          onChange={(v) => set("actualWaterG", v)}
        />
        <NumberField
          label="물 온도"
          value={state.actualWaterTempC}
          onChange={(v) => set("actualWaterTempC", v)}
        />
        <NumberField
          label="추출 시간"
          value={state.actualTotalTimeSeconds}
          onChange={(v) => set("actualTotalTimeSeconds", v)}
        />
      </fieldset>

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
    </div>
  );
}

/** 별명을 넣지 않았으면 모델 이름으로 부른다 — 선택란이 빈 항목처럼 보이면 고를 수 없다. */
function grinderLabel(grinder: UserGrinder): string {
  const model = `${grinder.brand} ${grinder.grinderModelName}`;
  return grinder.nickname ? `${grinder.nickname} (${model})` : model;
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="w-20 text-neutral-500">{label}</span>
      <input
        type="number"
        aria-label={label}
        value={value ?? ""}
        onChange={(e) =>
          onChange(e.target.value === "" ? null : Number(e.target.value))
        }
        className="w-32 rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700"
      />
    </label>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6">
      <h1 className="text-xl font-semibold">이 레시피로 내렸다</h1>
      {children}
    </main>
  );
}
