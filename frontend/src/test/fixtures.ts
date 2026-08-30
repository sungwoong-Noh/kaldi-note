import type { Recipe, RecipeSummary } from "@/features/recipe/schema";

/**
 * 백엔드는 `default-property-inclusion: non_null`이라 **null인 필드는 키 자체가 사라진다.**
 * `"grinderModelId": null`이 아니라 그 키가 없다. 픽스처도 그렇게 만들어야 실제와 같아진다.
 */
export const hoffmannSummary: RecipeSummary = {
  id: 2,
  sourceType: "CURATED",
  title: "James Hoffmann Ultimate V60",
  description: '유튜브 "The Ultimate V60 Technique"의 레시피.',
  brewMethod: "POUR_OVER",
  visibility: "PUBLIC",
  doseG: 30.0,
  waterG: 500.0,
  ratio: 16.7,
  waterTempC: 100.0,
  totalTimeSeconds: 210,
  brewerId: 2,
  filterId: 2,
  createdAt: "2026-08-21T05:35:20.440335Z",
  updatedAt: "2026-08-21T05:35:20.440335Z",
};

export const kasuyaSummary: RecipeSummary = {
  id: 3,
  sourceType: "CURATED",
  title: "Tetsu Kasuya 4:6 Method",
  description: "2016 World Brewers Cup 우승 방법론.",
  brewMethod: "POUR_OVER",
  visibility: "PUBLIC",
  doseG: 20.0,
  waterG: 300.0,
  ratio: 15.0,
  waterTempC: 92.0,
  totalTimeSeconds: 210,
  brewerId: 2,
  filterId: 2,
  createdAt: "2026-08-21T05:35:20.440335Z",
  updatedAt: "2026-08-21T05:35:20.440335Z",
};

/**
 * Hoffmann 시드의 스텝 7개. **실제 백엔드 응답을 그대로 옮긴 것이다.**
 *
 * 지어낸 픽스처로 테스트를 짰다가 상세 화면이 통째로 깨졌다 — 스텝 응답에는 `id`가 없고
 * `cumulativeWaterG`는 서버가 이미 계산해서 준다. 픽스처가 실제와 다르면 테스트는
 * 코드가 아니라 내 가정을 검증하게 된다.
 */
export const hoffmannSteps: Recipe["steps"] = [
  {
    stepOrder: 1,
    stepType: "BLOOM",
    startAtSeconds: 0,
    durationSeconds: 15,
    waterG: 60.0,
    cumulativeWaterG: 60.0,
    pourTechnique: "SPIRAL",
    agitation: "SWIRL",
    note: "중심에서 바깥으로 나선을 그려 가루를 다 적신 뒤, 스월로 덩어리를 푼다",
  },
  {
    stepOrder: 2,
    stepType: "WAIT",
    startAtSeconds: 15,
    durationSeconds: 30,
    cumulativeWaterG: 60.0,
    agitation: "NONE",
    note: "45초까지 뜸을 들인다",
  },
  {
    stepOrder: 3,
    stepType: "POUR",
    startAtSeconds: 45,
    durationSeconds: 30,
    waterG: 240.0,
    cumulativeWaterG: 300.0,
    pourTechnique: "SPIRAL",
    agitation: "NONE",
    note: "1분 15초에 누적 300g. 전체 물의 60%를 여기서 넣는다",
  },
  {
    stepOrder: 4,
    stepType: "POUR",
    startAtSeconds: 75,
    durationSeconds: 30,
    waterG: 200.0,
    cumulativeWaterG: 500.0,
    pourTechnique: "SPIRAL",
    agitation: "NONE",
    note: "1분 45초에 누적 500g. 천천히 이어 붓는다",
  },
  {
    stepOrder: 5,
    stepType: "STIR",
    startAtSeconds: 105,
    durationSeconds: 5,
    cumulativeWaterG: 500.0,
    agitation: "STIR",
    note: "시계 방향과 반시계 방향으로 한 번씩 저어 벽면 가루를 내린다",
  },
  {
    stepOrder: 6,
    stepType: "SWIRL",
    startAtSeconds: 110,
    durationSeconds: 5,
    cumulativeWaterG: 500.0,
    agitation: "SWIRL",
    note: "가볍게 돌려 커피 베드를 평탄하게 만든다",
  },
  {
    stepOrder: 7,
    stepType: "DRAWDOWN",
    startAtSeconds: 115,
    durationSeconds: 95,
    cumulativeWaterG: 500.0,
    agitation: "NONE",
    note: "3분 30초에 배출이 끝난다",
  },
];

export const hoffmann: Recipe = {
  ...hoffmannSummary,
  authorName: "James Hoffmann",
  sourceUrl: "https://honestcoffeeguide.com/brew-recipes/james-hoffmann-v60/",
  sourceNote: '유튜브 "The Ultimate V60 Technique"을 정리한 레시피 페이지',
  steps: hoffmannSteps,
};

/** 페이지 봉투. 백엔드 `PageResponse<T>`의 여섯 키를 그대로 갖는다. */
export function pageOf<T>(
  content: T[],
  overrides: Partial<{
    page: number;
    size: number;
    totalElements: number;
    hasNext: boolean;
  }> = {},
) {
  const size = overrides.size ?? 20;
  const totalElements = overrides.totalElements ?? content.length;
  return {
    content,
    page: overrides.page ?? 0,
    size,
    totalElements,
    totalPages: Math.ceil(totalElements / size),
    hasNext: overrides.hasNext ?? false,
  };
}

/** 목록 페이지네이션 테스트용. 제목만 다른 요약 n개를 만든다. */
export function summaries(count: number, startId = 100): RecipeSummary[] {
  return Array.from({ length: count }, (_, i) => ({
    ...hoffmannSummary,
    id: startId + i,
    title: `레시피 ${startId + i}`,
  }));
}

/**
 * 그라인더 마스터 데이터. **2026-08-30에 실행 중인 백엔드에서 그대로 뜬 것이다.**
 *
 * 두 가지가 지어낸 픽스처였다면 틀렸을 부분이다 —
 * `micronsPerClick`은 없으면 **키 자체가 사라지고**(J-Max), 환산 가능 여부는 `convertible` 불리언으로 온다.
 */
export const comandanteC40 = {
  id: 1,
  brand: "Comandante",
  name: "C40 MK4",
  adjustmentType: "CLICK",
  micronsPerClick: 30.0,
  minSetting: 0.0,
  maxSetting: 50.0,
  burrType: "CONICAL",
  convertible: true,
  isSystem: true,
};

/** 무단계 그라인더. `micronsPerClick` 키가 없고 `convertible`이 false다. */
export const wilfaUniform = {
  id: 10,
  brand: "Wilfa",
  name: "Uniform",
  adjustmentType: "STEPLESS",
  minSetting: 0.0,
  maxSetting: 0.0,
  burrType: "FLAT",
  convertible: false,
  isSystem: true,
};

/** C40 22클릭을 같은 그라인더로 환산한 응답. `micron`만 쓰고 나머지는 읽지 않는다. */
export const c40Conversion = {
  sourceSetting: 22,
  micron: 660,
  targetSetting: 22.0,
  targetOutOfRange: false,
  estimated: true,
  warning:
    "버 형상과 입도 분포가 달라 정확한 등가 변환은 불가능합니다. 시작점으로만 사용하세요.",
};

/** 무단계 그라인더로 환산을 시도했을 때의 422 본문. */
export const grindNotConvertibleError = {
  code: "GRIND_NOT_CONVERTIBLE",
  message: "대상 그라인더의 클릭당 마이크론 정보가 없어 환산할 수 없습니다.",
  fieldErrors: [],
};

/** 그라인더 상한을 넘겼을 때의 400 본문. */
export const grindOutOfRangeError = {
  code: "GRIND_SETTING_OUT_OF_RANGE",
  message: "설정값 60는 이 그라인더의 상한 50.00를 넘습니다.",
  fieldErrors: [],
};
