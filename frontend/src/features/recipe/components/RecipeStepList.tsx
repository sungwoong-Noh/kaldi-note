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
      <p className="py-6 text-center text-body text-ink-3">
        등록된 스텝이 없습니다
      </p>
    );
  }

  const ordered = [...steps].sort((a, b) => a.stepOrder - b.stepOrder);

  /*
   * 시간 축 타임라인 — docs/specs/2026-09-15-structure.md
   *
   * 푸어 스텝은 진짜 시간 시퀀스다(0:00 → 0:15 → 0:45). 구분선만 있으면 그것이 시퀀스로
   * 읽히지 않는다. 시간 열 오른쪽에 세로선을 그어 시간이 흐른다는 것을 보여준다.
   *
   * 편집 화면(RecipeStepEditor)은 이 컴포넌트를 쓰지 않는다 — 순서를 바꾸는 일이라 축이
   * 방해가 된다(AC-STRUCT-09).
   */
  return (
    <ol data-timeline-axis className="flex flex-col">
      {ordered.map((step) => {
        const showCumulative =
          isPouring(step) && step.cumulativeWaterG !== undefined;

        return (
          <li
            // 스텝 응답에 id가 없다. stepOrder가 레시피 안에서 UNIQUE한 식별자다.
            // 배열 인덱스를 쓰면 순서가 바뀔 때 확실한 버그가 된다.
            key={step.stepOrder}
            className="flex gap-3 py-3"
          >
            <span
              data-testid="step-start"
              className="w-12 shrink-0 pt-1 font-mono text-body tabular-nums text-ink-3"
            >
              {formatDuration(step.startAtSeconds)}
            </span>

            {/* 축. 행마다 그어 이어 붙인다 — absolute로 그리면 임의값 위치가 필요하고,
                그건 AC-SPACE-03(임의값 간격 0곳)에 걸린다. */}
            <span
              aria-hidden
              className="w-px shrink-0 self-stretch bg-border"
            />

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium">{STEP_LABEL[step.stepType]}</span>

                {step.waterG !== undefined && (
                  <span className="text-body">
                    {formatCumulativeGrams(step.waterG)}
                  </span>
                )}

                {showCumulative && (
                  <span className="text-body text-ink-3">
                    누적{" "}
                    {formatCumulativeGrams(step.cumulativeWaterG as number)}
                  </span>
                )}

                <span className="text-body text-ink-3">
                  {step.durationSeconds}초
                </span>
              </div>

              {step.note && (
                <p className="mt-1 text-body text-ink-3">{step.note}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
