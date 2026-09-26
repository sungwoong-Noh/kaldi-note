"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorState, errorMessageOf } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { useRequireSession } from "@/features/auth/useRequireSession";
import { useUserGrinders } from "@/features/gear/queries";
import { ApiError } from "@/lib/api-client";
import { mapFieldErrors } from "@/lib/fieldErrors";
import type { UserGrinder } from "@/features/gear/schema";
import { fetchBrewLog, patchBrewLog } from "../api";
import {
  clearedFields,
  invalidTimeFields,
  isDirty,
  MIN_SEC_MESSAGE,
  formStateFromLog,
  toPatchBody,
  type BrewLogEditState,
  type BrewLogFormState,
} from "../formState";
import type { BrewLog } from "../schema";
import { useBeanLabel, useRecipeLabel } from "../useEntityLabels";
import {
  BrewFormLayout,
  FORM_SHELL_CLASS,
  FormActions,
  LeaveConfirmDialog,
} from "./BrewFormLayout";
import { BrewHero } from "./BrewHero";
import { BrewLogFields } from "./BrewLogFields";
import { Button, Shell } from "@/components/ui";

/** 스펙이 정한 문구다. 값을 바꾸거나 기록을 지우는 것 말고는 길이 없다. */
const CLEAR_MESSAGE = "값을 지울 수 없습니다. 고치거나 기록을 삭제하세요";

export function BrewLogEditor({ id }: { id: number }) {
  const { ready, onSessionLost } = useRequireSession();

  const log = useQuery({
    queryKey: ["brew-log", id],
    queryFn: () => fetchBrewLog(id, onSessionLost),
    enabled: ready,
  });
  const grinders = useUserGrinders(onSessionLost);

  const failure = log.error ?? grinders.error;
  if (failure) {
    return (
      <Screen>
        <ErrorState
          error={failure}
          onRetry={() => {
            void log.refetch();
            void grinders.refetch();
          }}
        />
      </Screen>
    );
  }

  // 두 쿼리를 섞으면 `isPending`만으로는 타입이 좁혀지지 않는다. 데이터 자체를 조건으로 쓴다.
  if (!ready || !log.data || !grinders.data) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  return (
    <Screen>
      <Fields
        log={log.data}
        grinders={grinders.data}
        onSessionLost={onSessionLost}
      />
    </Screen>
  );
}

function Fields({
  log,
  grinders,
  onSessionLost,
}: {
  log: BrewLog;
  grinders: UserGrinder[];
  onSessionLost: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // 초기값은 마운트 시점에 한 번만 만든다. 캐시가 갱신돼도 입력 중인 값을 덮지 않는다.
  const [initial] = useState<BrewLogEditState>(() => formStateFromLog(log));
  const [state, setState] = useState<BrewLogEditState>(initial);
  const [confirmingLeave, setConfirmingLeave] = useState(false);

  // 이름은 로그가 가리키는 id로 따로 읽는다. 실패해도 저장을 막지 않는다 —
  // 레시피·원두는 PATCH 본문에 들어가지 않아 저장과 아무 관계가 없다.
  const recipe = useRecipeLabel(log.recipeId, true, onSessionLost);
  const bean = useBeanLabel(log.beanBatchId, true, onSessionLost);

  const save = useMutation({
    mutationFn: () =>
      patchBrewLog(log.id, toPatchBody(initial, state), onSessionLost),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["brew-logs"] });
      void queryClient.invalidateQueries({ queryKey: ["brew-log", log.id] });
      router.push(`/brews/${log.id}`);
    },
  });

  const cleared = clearedFields(initial, state);

  /**
   * 지우기 안내를 `BrewLogFields`가 이미 아는 모양으로 얹는다. 새 prop을 만들면 입력칸
   * 쪽 코드를 전부 고쳐야 한다.
   */
  const serverErrors =
    save.error instanceof ApiError
      ? mapFieldErrors(save.error.fieldErrors)
      : null;

  // 서버 오류가 나중에 온 정보라 지우기 안내를 덮는다. 지우기 안내가 떠 있으면
  // 저장 자체가 막히므로 둘이 같은 칸에서 겹칠 일은 없다.
  // 형식이 틀린 시간은 지우기와 같은 방식으로 저장을 막는다. 그대로 보내면 초로 바꿀 수 없어 조용히 빠진다.
  const invalidTimes = invalidTimeFields(state);
  const fieldErrors = {
    byField: {
      ...Object.fromEntries(cleared.map((key) => [key, CLEAR_MESSAGE])),
      ...Object.fromEntries(invalidTimes.map((key) => [key, MIN_SEC_MESSAGE])),
      ...(serverErrors?.byField ?? {}),
    },
    byStepIndex: {},
    unmapped: serverErrors?.unmapped ?? [],
  };

  function submit() {
    // 보낼 것이 없으면 부르지 않는다. 사용자 입장에서는 취소와 같은 결과다.
    if (Object.keys(toPatchBody(initial, state)).length === 0) {
      router.push(`/brews/${log.id}`);
      return;
    }
    save.mutate();
  }

  // `BrewLogFields`는 공유 필드만 아는 좁은 시그니처를 요구한다. `visibility`는
  // 이 화면에만 있으므로 아래 select가 따로 쓴다.
  const setField = <K extends keyof BrewLogFormState>(
    key: K,
    value: BrewLogFormState[K],
  ) => setState((prev) => ({ ...prev, [key]: value }));

  return (
    <BrewFormLayout
      hero={
        <BrewHero
          title={recipe.label}
          targets={recipe.targets}
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
        onChange={setField}
        beanSlot={
          // 레시피와 원두는 PATCH DTO에 없어 서버가 무시한다. 값만 보여준다.
          // id 숫자로 보여주면 무엇으로 내렸는지 화면만 봐서는 알 수 없어 이름을 따로 읽는다.
          <dl className="flex flex-wrap gap-x-4 text-body">
            <div className="flex items-center gap-1">
              <dt className="text-ink-3">레시피</dt>
              <dd>{recipe.label}</dd>
            </div>
            {state.beanBatchId !== null && (
              <div className="flex items-center gap-1">
                <dt className="text-ink-3">원두</dt>
                <dd>{bean.label}</dd>
              </div>
            )}
          </dl>
        }
      />

      {save.error !== null && (
        <div role="alert" className="flex flex-col gap-1 text-body text-danger">
          <p>{errorMessageOf(save.error)}</p>
          {fieldErrors.unmapped.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      )}

      <FormActions>
        <Button
          disabled={
            save.isPending || cleared.length > 0 || invalidTimes.length > 0
          }
          onClick={submit}
          variant="primary"
        >
          저장
        </Button>
        <Button
          onClick={() =>
            isDirty(initial, state)
              ? setConfirmingLeave(true)
              : router.push(`/brews/${log.id}`)
          }
        >
          취소
        </Button>
      </FormActions>

      {confirmingLeave && (
        <LeaveConfirmDialog
          onLeave={() => router.push(`/brews/${log.id}`)}
          onStay={() => setConfirmingLeave(false)}
        />
      )}
    </BrewFormLayout>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <Shell stack wide className={FORM_SHELL_CLASS}>
      <h1 className="text-page-title font-semibold">기록 편집</h1>
      {children}
    </Shell>
  );
}
