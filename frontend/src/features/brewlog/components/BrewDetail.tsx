"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorState } from "@/components/ErrorState";
import { useRequireSession } from "@/features/auth/useRequireSession";
import { RecipeStepList } from "@/features/recipe/components/RecipeStepList";
import { useMe } from "@/features/user/queries";
import {
  formatDuration,
  formatGrams,
  formatRatio,
  formatTemperature,
} from "@/lib/format";
import { deleteBrewLog, fetchBrewLog } from "../api";
import { useBeanLabel, useRecipeLabel } from "../useEntityLabels";
import { DeleteBrewLogDialog } from "./DeleteBrewLogDialog";
import { ExtractionSummary } from "./ExtractionSummary";

export function BrewDetail({ id }: { id: number }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { ready, onSessionLost } = useRequireSession();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const logQuery = useQuery({
    queryKey: ["brew-log", id],
    queryFn: () => fetchBrewLog(id, onSessionLost),
    enabled: ready,
  });
  const me = useMe(onSessionLost);

  const recipeId = logQuery.data?.recipeId;
  const recipe = useRecipeLabel(recipeId, ready, onSessionLost);
  const bean = useBeanLabel(logQuery.data?.beanBatchId, ready, onSessionLost);

  const remove = useMutation({
    mutationFn: () => deleteBrewLog(id, onSessionLost),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["brew-logs"] });
      router.push("/brews");
    },
  });

  if (!ready || logQuery.isPending) {
    return <Shell>{null}</Shell>;
  }

  if (logQuery.error) {
    return (
      <Shell>
        <ErrorState
          error={logQuery.error}
          onRetry={() => void logQuery.refetch()}
        />
      </Shell>
    );
  }

  const log = logQuery.data;
  const isMine = me.data !== undefined && log.userId === me.data.id;

  return (
    <Shell>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-neutral-500">
            {log.brewedAt.slice(0, 10)}
          </p>
          {/*
            제목을 읽었을 때만 링크다. 못 읽었다는 것은 그 레시피를 볼 권한이 없다는 뜻이라
            링크를 누르면 403 화면으로 간다. 두 갈래가 같은 글자 크기·굵기를 갖게 해서
            폴백일 때 레이아웃이 흔들리지 않게 한다.
          */}
          {recipeId !== undefined &&
            (recipe.isReady ? (
              <Link
                href={`/recipes/${recipeId}`}
                className="text-lg font-medium underline-offset-2 hover:underline"
              >
                {recipe.label}
              </Link>
            ) : (
              <span className="text-lg font-medium">{recipe.label}</span>
            ))}
          {bean.label !== "" && (
            <dl className="flex items-center gap-1 text-sm text-neutral-600 dark:text-neutral-400">
              <dt>원두</dt>
              <dd>{bean.label}</dd>
            </dl>
          )}
        </div>
        {log.rating !== undefined && (
          <span className="shrink-0 text-sm">
            <span aria-hidden>★</span> {log.rating}
          </span>
        )}
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">실측값</h2>
        <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {/* `원두량`이다. 위에 원두 이름 줄이 생겨 `원두`로 두면 같은 라벨이 둘이 된다.
              작성·편집 폼의 입력칸 이름도 `원두량`이라 이쪽이 일관된다. */}
          <Measure label="원두량" value={formatGrams(log.actualDoseG)} />
          <Measure label="물" value={formatGrams(log.actualWaterG)} />
          <Measure
            label="온도"
            value={formatTemperature(log.actualWaterTempC)}
          />
          {log.actualTotalTimeSeconds !== undefined && (
            <Measure
              label="시간"
              value={formatDuration(log.actualTotalTimeSeconds)}
            />
          )}
          {log.brewRatio !== undefined && (
            <Measure label="비율" value={formatRatio(log.brewRatio)} />
          )}
          {log.actualGrindSettingValue !== undefined && (
            <Measure
              label="분쇄도"
              value={String(log.actualGrindSettingValue)}
            />
          )}
        </dl>
      </section>

      {/*
        푸어 스텝. **읽기 전용이다** — 푸어링을 바꾸는 것은 새 레시피를 만드는 일이라
        여기에 편집 진입점을 두지 않는다(스펙의 「범위 밖」 첫 항목).

        조건이 `steps.length`가 아니라 `isReady`인 것이 요점이다. 못 읽는 세 경우
        (403·404·조회 중)가 한 갈래로 처리된다. 제목 자리에 이미 `비공개 레시피` 같은
        문구가 떠 있어 이유가 드러나므로, 빈 절을 세워 같은 말을 두 번 하지 않는다.
      */}
      {recipe.isReady && (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">푸어 스텝</h2>
          <RecipeStepList steps={recipe.steps} />
        </section>
      )}

      <ExtractionSummary log={log} />

      {log.overallNote !== undefined && (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">메모</h2>
          <p className="whitespace-pre-wrap text-sm">{log.overallNote}</p>
        </section>
      )}

      {/*
        `PATCH`·`DELETE`는 소유자만 받는다. 남의 로그에 버튼을 두면 눌렀을 때 403이 난다.
        `me`가 아직 안 왔으면 남의 것으로 본다 — 파괴적 버튼은 늦게 나타나는 편이 안전하다.
      */}
      {isMine && (
        <div className="flex items-center gap-2 self-start">
          <Link
            href={`/brews/${id}/edit`}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
          >
            편집
          </Link>
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 dark:border-red-800"
          >
            삭제
          </button>
        </div>
      )}

      {confirmingDelete && (
        <DeleteBrewLogDialog
          deleting={remove.isPending}
          onConfirm={() => remove.mutate()}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </Shell>
  );
}

function Measure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1">
      <dt className="text-neutral-500">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6">
      {children}
    </main>
  );
}
