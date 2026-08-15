package com.kaldinote.extraction.domain;

import java.math.BigDecimal;
import java.util.Objects;

/**
 * 추출 실측값.
 *
 * @param beverageWeightG 최종 음료 중량(g). 재지 않았으면 null
 * @param tdsPercent 리프랙토미터 측정 TDS(%). 없으면 null — 없는 게 기본값이다
 */
public record BrewMeasurement(
    BigDecimal doseG, BigDecimal waterG, BigDecimal beverageWeightG, BigDecimal tdsPercent) {

  private static final BigDecimal TDS_UPPER_EXCLUSIVE = new BigDecimal("100");

  public BrewMeasurement {
    Objects.requireNonNull(doseG, "doseG는 null일 수 없습니다");
    Objects.requireNonNull(waterG, "waterG는 null일 수 없습니다");

    requirePositive(doseG, "원두량");
    requirePositive(waterG, "물량");

    if (beverageWeightG != null) {
      requirePositive(beverageWeightG, "음료 중량");
      // 원두가 물을 머금으므로 음료가 부은 물보다 많을 수 없다. 같은 값은 허용한다.
      if (beverageWeightG.compareTo(waterG) > 0) {
        throw new InvalidBrewMeasurementException(
            "음료 중량(%s g)이 물량(%s g)보다 많을 수 없습니다.".formatted(beverageWeightG, waterG));
      }
    }

    if (tdsPercent != null) {
      requirePositive(tdsPercent, "TDS");
      if (tdsPercent.compareTo(TDS_UPPER_EXCLUSIVE) >= 0) {
        throw new InvalidBrewMeasurementException(
            "TDS는 퍼센트값이므로 100 미만이어야 합니다: %s".formatted(tdsPercent));
      }
    }
  }

  private static void requirePositive(BigDecimal value, String label) {
    if (value.signum() <= 0) {
      throw new InvalidBrewMeasurementException("%s은(는) 0보다 커야 합니다: %s".formatted(label, value));
    }
  }

  /** 수율 계산에 필요한 값이 모두 있는가. */
  public boolean yieldMeasurable() {
    return beverageWeightG != null && tdsPercent != null;
  }
}
