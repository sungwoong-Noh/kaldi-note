"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorState, errorMessageOf } from "@/components/ErrorState";
import { useRequireSession } from "@/features/auth/useRequireSession";
import { useUserGrinders } from "@/features/gear/queries";
import { ApiError } from "@/lib/api-client";
import { mapFieldErrors } from "@/lib/fieldErrors";
import type { UserGrinder } from "@/features/gear/schema";
import { fetchBrewLog, patchBrewLog } from "../api";
import {
  clearedFields,
  formStateFromLog,
  toPatchBody,
  type BrewLogEditState,
  type BrewLogFormState,
} from "../formState";
import type { BrewLog } from "../schema";
import { BrewLogFields } from "./BrewLogFields";

/** 스펙이 정한 문구다. 값을 바꾸거나 기록을 지우는 것 말고는 길이 없다. */
const CLEAR_MESSAGE = "값을 지울 수 없습니다. 고치거나 기록을 삭제하세요";

/** 레시피 폼과 같은 문구를 쓴다 — 같은 값이 두 화면에서 다른 이름으로 보이면 안 된다. */
const VISIBILITY_LABELS: Record<BrewLogEditState["visibility"], string> = {
  PRIVATE: "나만 보기",
  FRIENDS: "맞팔로우만",
  PUBLIC: "전체 공개",
};

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
      <Shell>
        <ErrorState
          error={failure}
          onRetry={() => {
            void log.refetch();
            void grinders.refetch();
          }}
        />
      </Shell>
    );
  }

  // 두 쿼리를 섞으면 `isPending`만으로는 타입이 좁혀지지 않는다. 데이터 자체를 조건으로 쓴다.
  if (!ready || !log.data || !grinders.data) {
    return <Shell>{null}</Shell>;
  }

  return (
    <Shell>
      <Fields
        log={log.data}
        grinders={grinders.data}
        onSessionLost={onSessionLost}
      />
    </Shell>
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
  const fieldErrors = {
    byField: {
      ...Object.fromEntries(cleared.map((key) => [key, CLEAR_MESSAGE])),
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
    <div className="flex flex-col gap-5">
      <BrewLogFields
        state={state}
        grinders={grinders}
        fieldErrors={fieldErrors}
        onChange={setField}
        beanSlot={
          // 레시피와 원두는 PATCH DTO에 없어 서버가 무시한다. 값만 보여준다.
          <dl className="flex flex-wrap gap-x-4 text-sm">
            <div className="flex items-center gap-1">
              <dt className="text-neutral-500">레시피</dt>
              <dd>{state.recipeId}</dd>
            </div>
            {state.beanBatchId !== null && (
              <div className="flex items-center gap-1">
                <dt className="text-neutral-500">원두</dt>
                <dd>{state.beanBatchId}</dd>
              </div>
            )}
          </dl>
        }
      />

      <label className="flex items-center gap-2 text-sm">
        <span className="w-20 text-neutral-500">공개 범위</span>
        <select
          aria-label="공개 범위"
          value={state.visibility}
          onChange={(e) =>
            setState((prev) => ({
              ...prev,
              visibility: toVisibility(e.target.value),
            }))
          }
          className="rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700"
        >
          {Object.entries(VISIBILITY_LABELS).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
      </label>

      {save.error !== null && (
        <div role="alert" className="flex flex-col gap-1 text-sm text-red-600">
          <p>{errorMessageOf(save.error)}</p>
          {fieldErrors.unmapped.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={save.isPending || cleared.length > 0}
          onClick={submit}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          저장
        </button>
        <button
          type="button"
          onClick={() => router.push(`/brews/${log.id}`)}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700"
        >
          취소
        </button>
      </div>
    </div>
  );
}

/** `select`의 값은 `string`이다. 단언 대신 좁혀서 받는다. */
function toVisibility(value: string): BrewLogEditState["visibility"] {
  return value === "FRIENDS" || value === "PUBLIC" ? value : "PRIVATE";
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6">
      <h1 className="text-xl font-semibold">기록 편집</h1>
      {children}
    </main>
  );
}
