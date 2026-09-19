package com.kaldinote.brewlog.presentation.dto;

import com.kaldinote.brewlog.domain.BrewLog;
import com.kaldinote.extraction.domain.ExtractionAnalysis;
import java.math.BigDecimal;
import java.time.Instant;

/**
 * 목록 항목용. BrewLogResponse와 필드가 같다.
 *
 * <p><b>overallNote를 담는다</b>(docs/specs/2026-09-19-home-calendar.md) — 웹 홈 달력의 우측 카드가 메모 한 줄을 그린다.
 * 예전에는 여기서 뺐으나, 카드마다 단건 조회를 부르면 기록 4건인 날에 요청이 4회 더 나가는 비용이 더 크다고 판단해 되돌렸다.
 *
 * <p>EY·SCA 구간은 DB에 없다. 단건 조회와 마찬가지로 목록의 각 행마다 저장된 실측값으로 다시 계산한다. TDS가 없는 기록은 이 값들이 null이고,
 * non_null 직렬화라 키가 통째로 빠진다.
 */
public record BrewLogSummaryResponse(
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

  public static BrewLogSummaryResponse from(BrewLog log, ExtractionAnalysis analysis) {
    return new BrewLogSummaryResponse(
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
