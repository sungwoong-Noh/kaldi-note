package com.kaldinote.extraction.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * 브루 비율과 추출 수율을 계산해 SCA Brewing Control Chart 좌표로 분류한다.
 *
 * <p>EY(%) = (음료중량_g × TDS%) / 원두량_g
 *
 * <p>이상 구간: TDS 1.15~1.35%, EY 18~22% (경계 포함)
 *
 * <p>구간 분류와 물리 한계 판정은 모두 반올림된 EY 값을 기준으로 한다.
 */
public class ExtractionAnalyzer {

  public static final BigDecimal TDS_MIN = new BigDecimal("1.15");
  public static final BigDecimal TDS_MAX = new BigDecimal("1.35");
  public static final BigDecimal EY_MIN = new BigDecimal("18.0");
  public static final BigDecimal EY_MAX = new BigDecimal("22.0");

  /** 로스팅 원두는 약 28~30%만 수용성이다. 이를 넘으면 측정값 오입력이다. */
  public static final BigDecimal EY_PHYSICAL_LIMIT = new BigDecimal("30.0");

  private static final int RATIO_SCALE = 1;
  private static final int YIELD_SCALE = 1;
  private static final int DIVISION_SCALE = 6;

  private static final String NO_TDS = "TDS 측정값이 없어 추출 수율을 계산할 수 없습니다. 비율과 관능 평가로 판단하세요.";
  private static final String NO_BEVERAGE_WEIGHT =
      "음료 중량이 없어 추출 수율을 계산할 수 없습니다. 추출 후 잔의 무게를 재어 입력하세요.";
  private static final String IDEAL = "이상적인 구간입니다. 이 레시피를 기준으로 삼으세요.";
  private static final String UNDER_EXTRACTED = "추출이 부족합니다. 분쇄를 곱게 하거나 물 온도를 올리거나 추출 시간을 늘려보세요.";
  private static final String OVER_EXTRACTED = "과다추출입니다. 분쇄를 굵게 하거나 물 온도를 낮추거나 추출 시간을 줄여보세요.";
  private static final String TOO_WEAK = "농도가 옅습니다. 물을 줄여 비율을 진하게 조정해보세요.";
  private static final String TOO_STRONG = "농도가 진합니다. 물을 늘려 비율을 옅게 조정해보세요.";

  public ExtractionAnalysis analyze(BrewMeasurement m) {
    BigDecimal brewRatio =
        m.waterG()
            .divide(m.doseG(), DIVISION_SCALE, RoundingMode.HALF_UP)
            .setScale(RATIO_SCALE, RoundingMode.HALF_UP);

    if (!m.yieldMeasurable()) {
      // 없는 것을 정확히 말한다. TDS가 있는데 "TDS가 없다"고 하면 사용자가 고칠 곳을 못 찾는다.
      // 둘 다 없으면 TDS를 먼저 말한다 — 리프랙토미터가 없는 것이 기본 상황이다.
      String reason = m.tdsPercent() == null ? NO_TDS : NO_BEVERAGE_WEIGHT;
      return new ExtractionAnalysis(brewRatio, null, null, null, reason);
    }

    BigDecimal yield =
        m.beverageWeightG()
            .multiply(m.tdsPercent())
            .divide(m.doseG(), DIVISION_SCALE, RoundingMode.HALF_UP)
            .setScale(YIELD_SCALE, RoundingMode.HALF_UP);

    if (yield.compareTo(EY_PHYSICAL_LIMIT) > 0) {
      throw new InvalidBrewMeasurementException(
          "추출 수율 %s%%는 물리적으로 불가능합니다(최대 %s%%). 측정값을 다시 확인하세요.".formatted(yield, EY_PHYSICAL_LIMIT));
    }

    StrengthZone strength = classifyStrength(m.tdsPercent());
    ExtractionZone extraction = classifyExtraction(yield);

    return new ExtractionAnalysis(
        brewRatio, yield, strength, extraction, diagnose(strength, extraction));
  }

  private StrengthZone classifyStrength(BigDecimal tds) {
    if (tds.compareTo(TDS_MIN) < 0) return StrengthZone.WEAK;
    if (tds.compareTo(TDS_MAX) > 0) return StrengthZone.STRONG;
    return StrengthZone.IDEAL;
  }

  private ExtractionZone classifyExtraction(BigDecimal yield) {
    if (yield.compareTo(EY_MIN) < 0) return ExtractionZone.UNDER;
    if (yield.compareTo(EY_MAX) > 0) return ExtractionZone.OVER;
    return ExtractionZone.IDEAL;
  }

  /** 추출 진단이 우선, 농도 진단은 뒤에 덧붙인다. 둘 다 이상이면 한 문장만 낸다. */
  private String diagnose(StrengthZone strength, ExtractionZone extraction) {
    if (strength == StrengthZone.IDEAL && extraction == ExtractionZone.IDEAL) {
      return IDEAL;
    }

    StringBuilder sb = new StringBuilder();
    switch (extraction) {
      case UNDER -> sb.append(UNDER_EXTRACTED);
      case OVER -> sb.append(OVER_EXTRACTED);
      case IDEAL -> {}
    }
    switch (strength) {
      case WEAK -> appendSentence(sb, TOO_WEAK);
      case STRONG -> appendSentence(sb, TOO_STRONG);
      case IDEAL -> {}
    }
    return sb.toString();
  }

  private void appendSentence(StringBuilder sb, String sentence) {
    if (!sb.isEmpty()) {
      sb.append(" ");
    }
    sb.append(sentence);
  }
}
