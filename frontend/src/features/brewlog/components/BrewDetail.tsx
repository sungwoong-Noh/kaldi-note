"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorState } from "@/components/ErrorState";
import { useRequireSession } from "@/features/auth/useRequireSession";
import { fetchRecipe } from "@/features/recipe/api";
import { useMe } from "@/features/user/queries";
import {
  formatDuration,
  formatGrams,
  formatRatio,
  formatTemperature,
} from "@/lib/format";
import { deleteBrewLog, fetchBrewLog } from "../api";
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
  const recipe = useQuery({
    queryKey: ["recipe", recipeId],
    queryFn: () => fetchRecipe(recipeId as number, onSessionLost),
    enabled: ready && recipeId !== undefined,
  });

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
          <p className="text-sm text-neutral-500">{log.brewedAt.slice(0, 10)}</p>
          {recipeId !== undefined && (
            <Link
              href={`/recipes/${recipeId}`}
              className="text-lg font-medium underline-offset-2 hover:underline"
            >
              {recipe.data?.title ?? `레시피 ${recipeId}`}
            </Link>
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
          <Measure label="원두" value={formatGrams(log.actualDoseG)} />
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
            <Measure label="분쇄도" value={String(log.actualGrindSettingValue)} />
          )}
        </dl>
      </section>

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
