/**
 * 푸어 스텝 시퀀스의 편집 규칙.
 *
 * <p>여기 있는 함수는 전부 순수 함수다 — 배열을 받아 새 배열을 돌려준다. 시간 계산을 렌더링에서 떼어내야 밀기·당기기 규칙을 눈으로 확인하지 않고 검증할 수
 * 있다.
 *
 * <p><b>시퀀스의 옳고 그름은 판정하지 않는다.</b> 물량 합계·겹침·타입 모순을 거부하는 쪽은 서버 하나뿐이고(`RECIPE` 스펙), 여기서는 겹침이 생기지
 * 않도록 시작 시각을 조정하기만 한다. 규칙이 두 곳에 살면 언젠가 어긋난다.
 */

/** 백엔드 상한과 같은 값이다(레시피 CRUD 스펙의 `RECIPE-35`). */
export const MAX_STEPS = 30;

const DEFAULT_DURATION_SECONDS = 10;

export type StepType =
  "BLOOM" | "POUR" | "WAIT" | "SWIRL" | "STIR" | "DRAWDOWN";

/**
 * 편집 중인 스텝. 서버 응답과 다른 점은 `uid` 하나다.
 *
 * <p>스텝은 순서가 바뀌므로 리스트 `key`에 배열 인덱스를 쓸 수 없다. 서버는 `stepOrder`를 주지만 그것도 편집 중에 계속 변한다. 그래서 클라이언트
 * 전용 식별자를 붙이고, 요청을 만들 때 떼어낸다.
 */
export type EditableStep = {
  uid: string;
  stepType: StepType;
  startAtSeconds: number;
  durationSeconds: number;
  waterG: number | null;
  pourTechnique: "CENTER" | "SPIRAL" | "PULSE" | "EDGE" | null;
  agitation: "NONE" | "SWIRL" | "STIR" | null;
  note: string | null;
};

/** 물을 추가하는 스텝. 물량 합계는 이것들만 센다. */
const POURING_TYPES: readonly StepType[] = ["BLOOM", "POUR"];

export function isPouringStep(step: EditableStep): boolean {
  return POURING_TYPES.includes(step.stepType);
}

const endOf = (step: EditableStep) =>
  step.startAtSeconds + step.durationSeconds;

let uidCounter = 0;

/** jsdom·workerd·Node 어디서든 도는 식별자. 값 자체에는 의미가 없고 리스트 key로만 쓴다. */
function nextUid(): string {
  uidCounter += 1;
  return `step-${uidCounter}`;
}

function newStep(stepType: StepType, startAtSeconds: number): EditableStep {
  return {
    uid: nextUid(),
    stepType,
    startAtSeconds,
    durationSeconds: DEFAULT_DURATION_SECONDS,
    waterG: null,
    pourTechnique: null,
    agitation: null,
    note: null,
  };
}

/** `from`번째부터 끝까지 시작 시각에 `amount`를 더한다. 0이면 원본 참조를 그대로 둔다. */
function shiftFrom(
  steps: EditableStep[],
  from: number,
  amount: number,
): EditableStep[] {
  if (amount === 0) return steps;
  return steps.map((step, i) =>
    i < from ? step : { ...step, startAtSeconds: step.startAtSeconds + amount },
  );
}

/** 겹치는 만큼만 민다. 앞 스텝이 끝난 뒤에 다음이 시작하면 0이 되어 아무도 움직이지 않는다. */
function overlapWith(previous: EditableStep, rest: EditableStep[]): number {
  if (rest.length === 0) return 0;
  return Math.max(0, endOf(previous) - rest[0].startAtSeconds);
}

/**
 * 맨 뒤에 스텝을 붙인다. 첫 스텝은 `BLOOM`으로 0초, 그 뒤는 `POUR`로 앞 스텝이 끝나는 시각에 시작한다.
 */
export function appendStep(steps: EditableStep[]): EditableStep[] {
  const previous = steps.at(-1);
  return [
    ...steps,
    previous ? newStep("POUR", endOf(previous)) : newStep("BLOOM", 0),
  ];
}

/**
 * `index`번째 **뒤에** 스텝을 끼운다. 새 스텝은 앞 스텝이 끝나는 시각에 시작하고, 뒤 스텝들은 겹치는 만큼만 밀린다.
 */
export function insertStepAfter(
  steps: EditableStep[],
  index: number,
): EditableStep[] {
  const previous = steps[index];
  const created = newStep("POUR", endOf(previous));
  const rest = steps.slice(index + 1);

  return [
    ...steps.slice(0, index + 1),
    created,
    ...shiftFrom(rest, 0, overlapWith(created, rest)),
  ];
}

/**
 * `index`번째를 지우고 뒤를 당긴다. 당기는 양은 <b>다음 스텝 시작 − 지운 스텝 시작</b>이다.
 *
 * <p>마지막 스텝에는 다음이 없으므로 당기기량도 없다 — 남은 스텝들은 그대로 있는다.
 */
export function removeStep(
  steps: EditableStep[],
  index: number,
): EditableStep[] {
  const next = steps[index + 1];
  const pull = next ? next.startAtSeconds - steps[index].startAtSeconds : 0;

  return [
    ...steps.slice(0, index),
    ...shiftFrom(steps.slice(index + 1), 0, -pull),
  ];
}

/**
 * `index`번째를 위(`-1`)나 아래(`1`)로 옮긴다.
 *
 * <p><b>시작 시각은 자리에 남고</b> 나머지(타입·소요·물량·기법)만 스텝을 따라 이동한다. 그 결과 겹치면 삽입과 같은 규칙으로 뒤를 민다.
 */
export function moveStep(
  steps: EditableStep[],
  index: number,
  delta: -1 | 1,
): EditableStep[] {
  const target = index + delta;
  if (target < 0 || target >= steps.length) return steps;

  const slots = steps.map((step) => step.startAtSeconds);
  const swapped = [...steps];
  swapped[index] = steps[target];
  swapped[target] = steps[index];

  const placed = swapped.map((step, i) => ({
    ...step,
    startAtSeconds: slots[i],
  }));

  const from = Math.min(index, target);
  const rest = placed.slice(from + 1);

  return [
    ...placed.slice(0, from + 1),
    ...shiftFrom(rest, 0, overlapWith(placed[from], rest)),
  ];
}

/** 붓는 스텝의 물량 합계. 화면에 `240.0g / 300.0g`으로 보여주기 위한 값이고 저장을 막는 데 쓰지 않는다. */
export function pouredWaterTotal(steps: EditableStep[]): number {
  return steps
    .filter(isPouringStep)
    .reduce((sum, step) => sum + (step.waterG ?? 0), 0);
}
