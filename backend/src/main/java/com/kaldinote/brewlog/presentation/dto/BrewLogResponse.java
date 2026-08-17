package com.kaldinote.brewlog.presentation.dto;

import com.kaldinote.brewlog.domain.BrewLog;
import com.kaldinote.extraction.domain.ExtractionAnalysis;
import java.math.BigDecimal;
import java.time.Instant;

/**
 * 저장된 스냅샷과 조회 시점에 재계산한 추출 분석을 함께 담는다.
 *
 * <p>EY·SCA 구간은 DB에 없다. 원본 측정값과 어긋나지 않도록 매번 계산한다.
 */
public record BrewLogResponse(
    Long id,
    Long userId,
    Long recipeId,
    Long beanBatchId,
    Instant brewedAt,
    String visibility,
    BigDecimal actualDoseG,
    BigDecimal actualWaterG,
    BigDecimal actualWaterTempC,
    Integer actualTotalTimeSeconds,
    Integer actualDrawdownSeconds,
    Long userGrinderId,
    BigDecimal actualGrindSettingValue,
    BigDecimal actualGrindMicronEstimated,
    BigDecimal beverageWeightG,
    BigDecimal tdsPercent,
    Integer daysOffRoast,
    String degassingStatus,
    BigDecimal brewRatio,
    BigDecimal extractionYieldPercent,
    String strengthZone,
    String extractionZone,
    String diagnosis,
    BigDecimal rating,
    Short acidity,
    Short sweetness,
    Short body,
    Short bitterness,
    Short aftertaste,
    String overallNote,
    Instant createdAt,
    Instant updatedAt) {

  public static BrewLogResponse from(BrewLog log, ExtractionAnalysis analysis) {
    return new BrewLogResponse(
        log.getId(),
        log.getUserId(),
        log.getRecipeId(),
        log.getBeanBatchId(),
        log.getBrewedAt(),
        log.getVisibility().name(),
        log.getActualDoseG(),
        log.getActualWaterG(),
        log.getActualWaterTempC(),
        log.getActualTotalTimeSeconds(),
        log.getActualDrawdownSeconds(),
        log.getUserGrinderId(),
        log.getActualGrindSettingValue(),
        log.getActualGrindMicronEstimated(),
        log.getBeverageWeightG(),
        log.getTdsPercent(),
        log.getDaysOffRoast(),
        log.getDegassingStatus(),
        analysis.brewRatio(),
        analysis.extractionYieldPercent(),
        analysis.strengthZone() == null ? null : analysis.strengthZone().name(),
        analysis.extractionZone() == null ? null : analysis.extractionZone().name(),
        analysis.diagnosis(),
        log.getRating(),
        log.getAcidity(),
        log.getSweetness(),
        log.getBody(),
        log.getBitterness(),
        log.getAftertaste(),
        log.getOverallNote(),
        log.getCreatedAt(),
        log.getUpdatedAt());
  }
}
