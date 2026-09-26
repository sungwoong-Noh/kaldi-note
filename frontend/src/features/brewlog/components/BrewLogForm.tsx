"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
import { focusFirstInvalidField } from "@/lib/focusFirstError";
import { createBrewLog } from "../api";
import {
  initialFormState,
  invalidTimeFields,
  isDirty,
  sectionWarningOf,
  toRequestBody,
  withTimeErrors,
  type BrewLogFormState,
} from "../formState";
import { BeanBatchDialog } from "./BeanBatchDialog";
import { BeanPickerDialog, beanName } from "./BeanPickerDialog";
import {
  BrewFormLayout,
  FORM_SHELL_CLASS,
  FormActions,
  LeaveConfirmDialog,
} from "./BrewFormLayout";
import { BrewHero } from "./BrewHero";
import { BrewLogFields } from "./BrewLogFields";
import { UserGrinderDialog } from "./UserGrinderDialog";
import { Button, ButtonLink, Shell } from "@/components/ui";

/**
 * 로그 작성 화면.
 *
 * <p>레시피와 내 그라인더가 <b>둘 다 도착한 뒤에</b> 폼을 마운트한다. 그라인더 자동 선택이 두 응답을 함께 봐야 정해지는데,
 * 폼을 먼저 띄우면 나중에 도착한 값으로 사용자가 고친 입력을 덮어쓰게 된다.
 */
export function BrewLogForm({ recipeId }: { recipeId: number | null }) {
  // 훅보다 먼저 가른다 — 세션 확인·그라인더 조회도 요청을 보낸다(AC-BREWFORM-16: 요청 0회).
  if (recipeId === null) {
    return (
      <Screen>
        <p className="text-body">레시피를 골라 내려 주세요.</p>
        <ButtonLink href="/recipes">레시피 보러 가기</ButtonLink>
      </Screen>
    );
  }
  return <LoadedBrewLogForm recipeId={recipeId} />;
}

function LoadedBrewLogForm({ recipeId }: { recipeId: number }) {
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
      <Screen>
        <ErrorState
          error={failure}
          onRetry={() => {
            void recipe.refetch();
            void grinders.refetch();
          }}
        />
      </Screen>
    );
  }

  // 두 쿼리를 섞으면 `isPending`만으로는 타입이 좁혀지지 않는다. 데이터 자체를 조건으로 쓴다.
  if (!ready || !recipe.data || !grinders.data) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  return (
    <Screen>
      <Fields
        recipe={recipe.data}
        grinders={grinders.data}
        onSessionLost={onSessionLost}
      />
    </Screen>
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
  const [initial] = useState<BrewLogFormState>(() =>
    initialFormState(recipe, grinders),
  );
  const [state, setState] = useState(initial);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [addingGrinder, setAddingGrinder] = useState(false);
  // 원두는 고르기 → (없으면) 새로 등록의 두 단계다. 등록 단계는 기존 `BeanBatchDialog`가 맡는다.
  const [beanDialog, setBeanDialog] = useState<"pick" | "create" | null>(null);
  const router = useRouter();

  const save = useMutation({
    mutationFn: () => createBrewLog(toRequestBody(state), onSessionLost),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ["brew-logs"] });
      // 홈 달력의 캐시 키는 별도 접두어("calendar")다 — brew-logs를 무효화해도
      // 같이 지워지지 않는다. 홈으로 돌아왔을 때 새 점이 바로 보이려면 따로 무효화한다
      // (docs/specs/2026-09-19-home-calendar.md, AC-HOMECAL-49).
      void queryClient.invalidateQueries({ queryKey: ["calendar"] });
      router.push(`/brews/${created.id}`);
    },
  });

  // 저장을 한 번 눌러 본 뒤부터 시간 형식 안내를 띄운다. 입력하는 도중(`3:`)에는 띄우지 않는다.
  const [timeChecked, setTimeChecked] = useState(false);
  const [blockedAttempts, setBlockedAttempts] = useState(0);

  // 측정·분쇄도 오류는 필드 하나가 아니라 묶음의 문제다 — 그 묶음 위에 서버 문구 그대로(AC-BREWFORM-21).
  const sectionWarning =
    save.error instanceof ApiError
      ? sectionWarningOf(save.error.code, save.error.message)
      : null;

  const fieldErrors = withTimeErrors(
    save.error instanceof ApiError
      ? mapFieldErrors(save.error.fieldErrors)
      : null,
    timeChecked ? invalidTimeFields(state) : [],
  );

  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (save.error || blockedAttempts > 0)
      focusFirstInvalidField(formRef.current);
  }, [save.error, blockedAttempts]);

  function submit() {
    setTimeChecked(true);
    if (invalidTimeFields(state).length > 0) {
      setBlockedAttempts((n) => n + 1);
      return;
    }
    save.mutate();
  }

  const set = <K extends keyof BrewLogFormState>(
    key: K,
    value: BrewLogFormState[K],
  ) => setState((prev) => ({ ...prev, [key]: value }));

  // `내린 시각`과 `그라인더` 사이에 들어간다. 편집 화면은 여기에 잠긴 원두 표시를 넣는다.
  const chosen = (batches.data ?? []).find((b) => b.id === state.beanBatchId);
  const beanSlot = (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="text-card-title font-semibold">원두</legend>
      <div className="flex min-h-11 items-center justify-between gap-3 text-body">
        <span className={chosen ? "" : "text-ink-3"}>
          {chosen
            ? batchLabel(chosen, products.data ?? [], roasters.data ?? [])
            : "고르지 않음"}
        </span>
        <Button aria-label="원두 변경" onClick={() => setBeanDialog("pick")}>
          변경
        </Button>
      </div>
    </fieldset>
  );

  return (
    <BrewFormLayout
      formRef={formRef}
      generalError={
        save.error && sectionWarning === null ? save.error.message : null
      }
      hero={
        <BrewHero
          title={recipe.title}
          targets={recipe}
          doseG={state.actualDoseG}
          waterG={state.actualWaterG}
          beverageWeightG={state.beverageWeightG}
          tdsPercent={state.tdsPercent}
        />
      }
    >
      <BrewLogFields
        state={state}
        grinders={grinders}
        fieldErrors={fieldErrors}
        onChange={set}
        onAddGrinder={() => setAddingGrinder(true)}
        beanSlot={beanSlot}
        sectionWarning={sectionWarning}
      />

      <FormActions>
        <Button disabled={save.isPending} onClick={submit} variant="primary">
          {save.isPending ? "저장 중…" : "기록하기"}
        </Button>
        <Button
          onClick={() =>
            isDirty(initial, state)
              ? setConfirmingLeave(true)
              : router.push(`/recipes/${recipe.id}`)
          }
        >
          취소
        </Button>
      </FormActions>

      {confirmingLeave && (
        <LeaveConfirmDialog
          onLeave={() => router.push(`/recipes/${recipe.id}`)}
          onStay={() => setConfirmingLeave(false)}
        />
      )}

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

      {beanDialog === "pick" && (
        <BeanPickerDialog
          batches={batches.data ?? []}
          products={products.data ?? []}
          roasters={roasters.data ?? []}
          onPick={(id) => {
            set("beanBatchId", id);
            setBeanDialog(null);
          }}
          onAddNew={() => setBeanDialog("create")}
          onCancel={() => setBeanDialog(null)}
        />
      )}

      {beanDialog === "create" && (
        <BeanBatchDialog
          onCreated={(created) => {
            // 재고 목록만 무효화하면 선택란에 나타나지만, 라벨은 제품·로스터가 있어야 완성된다.
            void queryClient.invalidateQueries({ queryKey: ["inventory"] });
            void queryClient.invalidateQueries({ queryKey: ["catalog"] });
            set("beanBatchId", created.id);
            setBeanDialog(null);
          }}
          onCancel={() => setBeanDialog(null)}
          onSessionLost={onSessionLost}
        />
      )}
    </BrewFormLayout>
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
  const age =
    batch.daysOffRoast === undefined ? null : `${batch.daysOffRoast}일차`;
  return [beanName(batch, products, roasters), age].filter(Boolean).join(" · ");
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <Shell stack wide className={FORM_SHELL_CLASS}>
      <h1 className="text-page-title font-semibold">이 레시피로 내렸다</h1>
      {children}
    </Shell>
  );
}
