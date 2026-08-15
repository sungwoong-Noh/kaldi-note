package com.kaldinote.extraction.domain;

import java.math.BigDecimal;

/**
 * 추출 분석 결과.
 *
 * <p>TDS를 재지 않은 경우 {@code extractionYieldPercent}·{@code strengthZone}· {@code extractionZone}이 모두
 * null이고 {@code brewRatio}만 채워진다. 리프랙토미터가 없는 게 기본 상황이므로 이 상태에서도 앱은 온전히 동작해야 한다.
 */
public record ExtractionAnalysis(
    BigDecimal brewRatio,
    BigDecimal extractionYieldPercent,
    StrengthZone strengthZone,
    ExtractionZone extractionZone,
    String diagnosis) {

  public boolean measured() {
    return extractionYieldPercent != null;
  }
}
