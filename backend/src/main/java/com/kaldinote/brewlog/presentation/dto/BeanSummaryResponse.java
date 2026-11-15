package com.kaldinote.brewlog.presentation.dto;

import com.kaldinote.brewlog.domain.BeanSummary;
import java.math.BigDecimal;
import java.util.List;

/** 내 「이 원두의 기록」 요약. 규칙은 docs/specs/2026-11-15-bean-detail.md 「내 기록 요약」. */
public record BeanSummaryResponse(
    int brewCount,
    int ratedCount,
    BigDecimal averageRating,
    BigDecimal frequentRatio,
    BigDecimal frequentDoseG,
    BigDecimal frequentWaterG,
    List<BeanSummary.Cup> recent) {

  public static BeanSummaryResponse from(BeanSummary s) {
    return new BeanSummaryResponse(
        s.brewCount(),
        s.ratedCount(),
        s.averageRating(),
        s.frequentRatio(),
        s.frequentDoseG(),
        s.frequentWaterG(),
        s.recent());
  }
}
