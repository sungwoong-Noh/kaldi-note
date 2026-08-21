import { formatCumulativeGrams, formatDuration } from '@/lib/format';
import type { RecipeStep } from '../schema';

const STEP_LABEL: Record<RecipeStep['stepType'], string> = {
  BLOOM: '블룸',
  POUR: '푸어',
  WAIT: '대기',
  SWIRL: '스월',
  STIR: '스터',
  DRAWDOWN: '배출',
};

/** 물을 추가하는 스텝. 누적 물량은 이것들만 더한다. */
function isPouring(step: RecipeStep): boolean {
  return step.stepType === 'BLOOM' || step.stepType === 'POUR';
}

type StepRow = { step: RecipeStep; cumulative: number; showCumulative: boolean };

/** `stepOrder` 순으로 정렬하면서 붓는 스텝의 누적 물량을 미리 계산한다. */
function withCumulativeWater(steps: RecipeStep[]): StepRow[] {
  const ordered = [...steps].sort((a, b) => a.stepOrder - b.stepOrder);

  return ordered.reduce<StepRow[]>((rows, step) => {
    const previous = rows.at(-1)?.cumulative ?? 0;
    const cumulative = isPouring(step) ? previous + (step.waterG ?? 0) : previous;

    rows.push({
      step,
      cumulative,
      showCumulative: isPouring(step) && step.waterG !== undefined,
    });
    return rows;
  }, []);
}

/**
 * 푸어 스텝 시퀀스. 이 서비스의 존재 이유인 화면이다.
 *
 * <p>누적 물량은 서버가 주지 않아 여기서 계산한다. 추출 중에 저울 눈금과 대조하는 값이라 스텝별 물량보다 이쪽이 실제로 쓰인다.
 */
export function RecipeStepList({ steps }: { steps: RecipeStep[] }) {
  if (steps.length === 0) {
    return <p className="py-6 text-center text-sm text-neutral-500">등록된 스텝이 없습니다</p>;
  }

  // 누적값은 렌더 전에 다 만들어둔다. map 안에서 바깥 변수를 더해 나가면 렌더 중 변형이 되어
  // React가 같은 렌더를 두 번 실행할 때(StrictMode) 값이 어긋난다.
  const rows = withCumulativeWater(steps);

  return (
    <ol className="flex flex-col">
      {rows.map(({ step, cumulative, showCumulative }) => {
        return (
          <li
            key={step.id}
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
                  <span className="text-sm">{formatCumulativeGrams(step.waterG)}</span>
                )}

                {showCumulative && (
                  <span className="text-sm text-neutral-500">
                    누적 {formatCumulativeGrams(cumulative)}
                  </span>
                )}

                <span className="text-sm text-neutral-400">{step.durationSeconds}초</span>
              </div>

              {step.note && (
                <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">{step.note}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
