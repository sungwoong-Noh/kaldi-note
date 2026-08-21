import { formatCumulativeGrams, formatDuration } from "@/lib/format";
import type { RecipeStep } from "../schema";

const STEP_LABEL: Record<RecipeStep["stepType"], string> = {
  BLOOM: "블룸",
  POUR: "푸어",
  WAIT: "대기",
  SWIRL: "스월",
  STIR: "스터",
  DRAWDOWN: "배출",
};

/** 물을 추가하는 스텝. 누적 물량은 이 스텝에만 붙여 보여준다. */
function isPouring(step: RecipeStep): boolean {
  return step.stepType === "BLOOM" || step.stepType === "POUR";
}

/**
 * 푸어 스텝 시퀀스. 이 서비스의 존재 이유인 화면이다.
 *
 * <p>누적 물량은 **서버가 계산해서 준다**(`cumulativeWaterG`). 프론트에서 다시 더하지 않는다 — 반올림 규칙이 두 곳에 생기면 언젠가 어긋난다.
 * 서버는 붓지 않는 스텝에도 직전 누적값을 실어 보내므로, 표시는 붓는 스텝에만 한다.
 */
export function RecipeStepList({ steps }: { steps: RecipeStep[] }) {
  if (steps.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-neutral-500">
        등록된 스텝이 없습니다
      </p>
    );
  }

  const ordered = [...steps].sort((a, b) => a.stepOrder - b.stepOrder);

  return (
    <ol className="flex flex-col">
      {ordered.map((step) => {
        const showCumulative =
          isPouring(step) && step.cumulativeWaterG !== undefined;

        return (
          <li
            // 스텝 응답에 id가 없다. stepOrder가 레시피 안에서 UNIQUE한 식별자다.
            // 배열 인덱스를 쓰면 순서가 바뀔 때 확실한 버그가 된다.
            key={step.stepOrder}
            className="flex gap-3 border-t border-neutral-200 py-3 first:border-t-0 dark:border-neutral-800"
          >
            <span
              data-testid="step-start"
              className="w-12 shrink-0 pt-0.5 font-mono text-sm tabular-nums text-neutral-500"
            >
              {formatDuration(step.startAtSeconds)}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium">{STEP_LABEL[step.stepType]}</span>

                {step.waterG !== undefined && (
                  <span className="text-sm">
                    {formatCumulativeGrams(step.waterG)}
                  </span>
                )}

                {showCumulative && (
                  <span className="text-sm text-neutral-500">
                    누적{" "}
                    {formatCumulativeGrams(step.cumulativeWaterG as number)}
                  </span>
                )}

                <span className="text-sm text-neutral-400">
                  {step.durationSeconds}초
                </span>
              </div>

              {step.note && (
                <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
                  {step.note}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
