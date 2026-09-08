/**
 * 대표 수치를 고른다. 카드와 상세가 **같은 함수를 쓴다.**
 *
 * <p><b>비율이 우선이다.</b> 레시피 쪽이 「원두량 → 물량」을 대표로 세우므로, 로그끼리 나란히
 * 놓았을 때 비율이 같은 축에서 비교된다.
 *
 * <p><b>비율이 없으면 물 온도로 내려간다.</b> `brewRatio`는 프론트 스키마에서 옵션이라 타입상 빌
 * 수 있다. 지금 백엔드로는 도달할 수 없지만(`actual_dose_g`·`actual_water_g`가 둘 다
 * `nullable = false`이고 `ExtractionAnalyzer`가 분기 없이 나눈다), 분기를 두는 한 그 안이 비면
 * 대표 자리가 조용히 사라진다. 물 온도는 필수라 마지막 보루가 된다.
 *
 * <p><b>승격 규칙을 두 곳에 베끼지 않는다.</b> 한쪽만 고치면 카드와 상세의 대표 수치가 갈린다.
 */
import { formatRatio, formatTemperature } from "@/lib/format";

/** `BrewLogSummary`와 `BrewLog`가 둘 다 만족하도록 구조로 좁힌다. */
export interface HeadlineSource {
  readonly brewRatio?: number;
  readonly actualWaterTempC: number;
}

export interface Headline {
  readonly label: string;
  readonly value: string;
}

export function headline(log: HeadlineSource): Headline {
  return log.brewRatio !== undefined
    ? { label: "비율", value: formatRatio(log.brewRatio) }
    : { label: "물 온도", value: formatTemperature(log.actualWaterTempC) };
}
