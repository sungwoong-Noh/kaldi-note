"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { useRequireSession } from "@/features/auth/useRequireSession";
import { RecipeStepList } from "@/features/recipe/components/RecipeStepList";
import { LedgerField, SectionLabel } from "@/components/kit";
import { TopBarActions } from "@/components/layout/TopBarActions";
import { useBrewers, useUserGrinders } from "@/features/gear/queries";
import type { UserGrinder } from "@/features/gear/schema";
import { useIsWide } from "@/lib/useIsWide";
import { useMe } from "@/features/user/queries";
import { formatDuration, formatGrams, formatTemperature } from "@/lib/format";
import { formatKstStamp } from "@/lib/kstDate";
import { deleteBrewLog, fetchBrewLog } from "../api";
import type { BrewLog } from "../schema";
import {
  useBeanLabel,
  useRecipeLabel,
  type RecipeTargets,
} from "../useEntityLabels";
import { GRIND_UNIT_LABEL } from "./brewFormFields";
import { RecipeComparison, type GrindComparison } from "./RecipeComparison";
import { DeleteBrewLogDialog } from "./DeleteBrewLogDialog";
import { BrewDetailHero } from "./BrewDetailHero";
import { Button, ButtonLink, Shell } from "@/components/ui";

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
  const brewers = useBrewers(onSessionLost);
  const wide = useIsWide();
  // 분쇄도 비교에 내 그라인더 모델이 필요하다. 남의 기록이면 부르지 않는다(남의 그라인더는 읽을 수 없다).
  const mine =
    me.data !== undefined &&
    logQuery.data !== undefined &&
    logQuery.data.userId === me.data.id;
  const myGrinders = useUserGrinders(onSessionLost, mine);

  const remove = useMutation({
    mutationFn: () => deleteBrewLog(id, onSessionLost),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["brew-logs"] });
      router.push("/brews");
    },
  });

  if (!ready || logQuery.isPending) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  if (logQuery.error) {
    return (
      <Screen>
        <ErrorState
          error={logQuery.error}
          onRetry={() => void logQuery.refetch()}
        />
      </Screen>
    );
  }

  const log = logQuery.data;
  // `프릿츠 예가체프 · 로스팅 08.28 · Hario V60 02` — 못 읽은 조각은 뺀다(대체 문구를 줄에 쓰지 않는다).
  const brewer = brewers.data?.find((item) => item.id === recipe.brewerId);
  const subline = [
    bean.isReady && bean.label,
    bean.roastedAt !== undefined &&
      `로스팅 ${bean.roastedAt.slice(5, 7)}.${bean.roastedAt.slice(8, 10)}`,
    brewer !== undefined && `${brewer.brand} ${brewer.name}`,
  ]
    .filter(Boolean)
    .join(" · ");
  const isMine = me.data !== undefined && log.userId === me.data.id;

  const title = (
    <div className="flex flex-col">
      <span className="font-mono text-[10.5px] tracking-[0.14em] text-ink-3 uppercase">
        {formatKstStamp(log.brewedAt)}
      </span>
      {/*
        화면 제목이다. **`h1`은 언제나 그리고 링크만 조건부로 한다** — 조건부로 사라지면
        제목 없는 화면이 생기고, 스크린리더 사용자가 「지금 무엇을 보고 있는가」를 제목
        탐색으로 알 수 없다.

        읽었을 때만 링크다. 못 읽었다는 것은 그 레시피를 볼 권한이 없다는 뜻이라 링크를
        누르면 403 화면으로 간다. 두 갈래가 같은 크기·굵기를 갖게 해서 폴백일 때 레이아웃이
        흔들리지 않게 한다.
      */}
      <h1 className="mt-[6px] text-page-title font-semibold min-[1100px]:text-[30px]">
        {recipeId !== undefined && recipe.isReady ? (
          <Link
            href={`/recipes/${recipeId}`}
            className="hit-44 underline-offset-2 hover:underline"
          >
            {recipe.label}
          </Link>
        ) : (
          recipe.label
        )}
      </h1>
      {subline !== "" && (
        <p className="mt-[4px] text-[13.5px] text-ink-3">{subline}</p>
      )}
    </div>
  );

  const grinder = isMine
    ? myGrinders.data?.find((g) => g.id === log.userGrinderId)
    : undefined;
  const grindUnit =
    recipe.targets?.grindSettingUnit === undefined
      ? ""
      : GRIND_UNIT_LABEL[recipe.targets.grindSettingUnit];
  const showBean = log.beanBatchId !== undefined && bean.label !== "";
  const gear = (showBean || log.actualGrindSettingValue !== undefined) && (
    <div className="flex flex-col">
      {showBean && (
        <LedgerField
          label="원두"
          value={bean.label}
          sub={
            [
              bean.roastedAt !== undefined &&
                `로스팅 ${bean.roastedAt.slice(5, 7)}.${bean.roastedAt.slice(8, 10)}`,
              log.daysOffRoast !== undefined && `${log.daysOffRoast}일차`,
            ]
              .filter(Boolean)
              .join(" · ") || undefined
          }
        />
      )}
      {log.actualGrindSettingValue !== undefined && (
        // 남의 기록이면 그라인더 이름을 모른다 — 내 그라인더 목록만 읽을 수 있다(AC-BDETAIL-13).
        <LedgerField
          label="분쇄도"
          value={[
            grinder && (grinder.nickname ?? grinder.grinderModelName),
            [String(log.actualGrindSettingValue), grindUnit]
              .filter(Boolean)
              .join(" "),
          ]
            .filter(Boolean)
            .join(" · ")}
        />
      )}
    </div>
  );

  const axes = TASTE_AXES.flatMap(({ key, label }) =>
    log[key] === undefined ? [] : [{ label, value: log[key] }],
  );
  const rating = (log.rating !== undefined || axes.length > 0) && (
    <section className="flex flex-col gap-[10px]">
      <SectionLabel>평가</SectionLabel>
      {log.rating !== undefined && (
        <span className="text-[18px] text-accent">★ {log.rating}</span>
      )}
      {axes.length > 0 &&
        (wide ? (
          <div className="flex flex-col">
            {axes.map((axis) => (
              <TasteReading key={axis.label} {...axis} />
            ))}
          </div>
        ) : (
          <p className="font-mono text-[12.5px] text-ink-2">
            {axes.map((axis) => `${axis.label} ${axis.value}`).join(" · ")}
          </p>
        ))}
    </section>
  );

  // 레시피를 못 읽으면 그리지 않는다 — 비교할 대상이 없다(AC-STRUCT-13).
  const comparison = recipe.targets !== undefined && (
    <RecipeComparison
      log={log}
      targets={recipe.targets}
      grind={grindComparison(log, recipe.targets, myGrinders.data, isMine)}
      wide={wide}
    />
  );

  // 레시피를 못 읽었으면(403·404) 비교표 대신 실측값을 원장 행으로 보인다(AC-BDETAIL-18·AC-STRUCT-13).
  // 조회 중(`label`이 빈 문자열)에는 그리지 않는다 — 곧 비교표로 바뀌면 깜빡인다.
  const measured = recipe.targets === undefined && recipe.label !== "" && (
    <div className="flex flex-col">
      {[
        { label: "원두량", value: formatGrams(log.actualDoseG) },
        { label: "물량", value: formatGrams(log.actualWaterG) },
        { label: "물 온도", value: formatTemperature(log.actualWaterTempC) },
        log.actualTotalTimeSeconds !== undefined && {
          label: "추출 시간",
          value: formatDuration(log.actualTotalTimeSeconds),
        },
      ]
        .filter((row): row is { label: string; value: string } => Boolean(row))
        .map((row) => (
          <LedgerField
            key={row.label}
            label={row.label}
            value={<span className="font-mono">{row.value}</span>}
          />
        ))}
    </div>
  );

  /*
    푸어 스텝. **읽기 전용이다** — 푸어링을 바꾸는 것은 새 레시피를 만드는 일이라
    여기에 편집 진입점을 두지 않는다(스펙의 「범위 밖」 첫 항목).

    조건이 `steps.length`가 아니라 `isReady`인 것이 요점이다. 못 읽는 세 경우
    (403·404·조회 중)가 한 갈래로 처리된다. 제목 자리에 이미 `비공개 레시피` 같은
    문구가 떠 있어 이유가 드러나므로, 빈 절을 세워 같은 말을 두 번 하지 않는다.
  */
  const steps = recipe.isReady && (
    <section className="flex flex-col gap-2">
      <h2 className="text-card-title font-semibold">푸어 스텝</h2>
      <RecipeStepList steps={recipe.steps} />
    </section>
  );

  const memo = log.overallNote !== undefined && (
    <p
      data-detail-note
      className="text-[14.5px] leading-[1.7] whitespace-pre-wrap text-ink-2 italic"
    >
      “{log.overallNote}”
    </p>
  );

  /*
    `PATCH`·`DELETE`는 소유자만 받는다. 남의 로그에 버튼을 두면 눌렀을 때 403이 난다.
    `me`가 아직 안 왔으면 남의 것으로 본다 — 파괴적 버튼은 늦게 나타나는 편이 안전하다.

    「다시 내리기」는 내 기록이 아니어도 보인다 — 남의 기록을 보고 같은 레시피로
    내려보는 것이 이 서비스의 쓰임이다(docs/specs/2026-09-17-small-features.md).
  */
  const actions = (
    <>
      {recipeId !== undefined && (
        <ButtonLink href={`/brews/new?recipeId=${recipeId}`} variant="primary">
          다시 내리기
        </ButtonLink>
      )}
      {isMine && (
        <>
          <ButtonLink href={`/brews/${id}/edit`}>수정</ButtonLink>
          <Button onClick={() => setConfirmingDelete(true)}>삭제</Button>
        </>
      )}
    </>
  );

  const dialog = confirmingDelete && (
    <DeleteBrewLogDialog
      deleting={remove.isPending}
      onConfirm={() => remove.mutate()}
      onCancel={() => setConfirmingDelete(false)}
    />
  );

  if (wide) {
    // 목업 W3 — 왼쪽 본문(제목·비교표·스텝) + 오른쪽 전체 높이 판(히어로·원두·메모), 동작은 상단 바.
    return (
      <Screen wide>
        <TopBarActions>{actions}</TopBarActions>
        <div className="flex items-stretch gap-[40px]">
          <div
            data-detail-main
            className="flex min-w-0 flex-1 flex-col gap-[28px]"
          >
            {title}
            {comparison}
            {measured}
            {steps}
          </div>
          <aside
            data-detail-aside
            className="flex w-[360px] shrink-0 flex-col gap-[22px] border-l border-divider bg-surface px-[32px] py-[36px] min-[1280px]:w-[420px] min-[1280px]:px-[40px] min-[1280px]:py-[44px]"
          >
            <BrewDetailHero log={log} />
            {gear}
            {rating}
            {memo}
          </aside>
        </div>
        {dialog}
      </Screen>
    );
  }

  return (
    <Screen>
      {title}
      <BrewDetailHero log={log} />
      {comparison}
      {measured}
      {steps}
      {gear}
      {rating}
      {memo}
      {/* 목업 B2 — 위 `수정`(상단 바 자리), 아래 전폭 `다시 내리기`(흐름 안 sticky) + `삭제`(AC-BDETAIL-12). */}
      {isMine && (
        <TopBarActions>
          <Link
            href={`/brews/${id}/edit`}
            className="hit-44 flex items-center text-[14.5px] font-medium text-accent"
          >
            수정
          </Link>
        </TopBarActions>
      )}
      {recipeId !== undefined && (
        <div className="sticky bottom-0 z-10 -mx-6 border-t border-divider bg-paper px-6 py-3">
          <ButtonLink
            href={`/brews/new?recipeId=${recipeId}`}
            variant="primary"
            className="w-full"
          >
            다시 내리기
          </ButtonLink>
        </div>
      )}
      {isMine && (
        <button
          type="button"
          onClick={() => setConfirmingDelete(true)}
          className="hit-44 self-center text-[13.5px] text-ink-3"
        >
          삭제
        </button>
      )}
      {dialog}
    </Screen>
  );
}

function Screen({
  wide = false,
  children,
}: {
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Shell stack wide={wide} className={wide ? "max-w-6xl" : ""}>
      {children}
    </Shell>
  );
}

/**
 * 비교표 분쇄도 행 — 내 기록이고 내 그라인더 모델 = 레시피 모델일 때만(AC-BDETAIL-05·13·14).
 * 단위는 레시피 단위를 따른다.
 */
function grindComparison(
  log: BrewLog,
  targets: RecipeTargets,
  myGrinders: UserGrinder[] | undefined,
  isMine: boolean,
): GrindComparison | null {
  if (!isMine || targets.grinderModelId === undefined) return null;
  const grinder = myGrinders?.find((g) => g.id === log.userGrinderId);
  if (
    grinder === undefined ||
    grinder.grinderModelId !== targets.grinderModelId
  )
    return null;
  return {
    target: targets.grindSettingValue,
    actual: log.actualGrindSettingValue,
    unit:
      targets.grindSettingUnit === undefined
        ? ""
        : GRIND_UNIT_LABEL[targets.grindSettingUnit],
  };
}

const TASTE_AXES = [
  { key: "acidity", label: "산미" },
  { key: "sweetness", label: "단맛" },
  { key: "body", label: "바디" },
  { key: "bitterness", label: "쓴맛" },
  { key: "aftertaste", label: "여운" },
] as const;

/**
 * 읽기 전용 맛 점 — 기록 폼 `TasteDots`와 같은 모양이지만 버튼이 아니다(AC-BDETAIL-09). 상세에서 점을
 * 누를 수 있으면 바뀔 것처럼 보인다.
 */
function TasteReading({ label, value }: { label: string; value: number }) {
  return (
    <div className="grid min-h-[36px] grid-cols-[40px_minmax(0,1fr)_16px] items-center gap-[12px]">
      <span className="text-[13.5px] text-ink-2">{label}</span>
      <span
        role="img"
        aria-label={`${label} ${value}`}
        className="flex gap-[6px]"
      >
        {[1, 2, 3, 4, 5].map((score) => (
          <span
            key={score}
            className={`size-[22px] rounded-full ${score <= value ? "bg-accent" : "bg-divider"}`}
          />
        ))}
      </span>
      <span className="text-right font-mono text-[12px] text-ink-3">
        {value}
      </span>
    </div>
  );
}
