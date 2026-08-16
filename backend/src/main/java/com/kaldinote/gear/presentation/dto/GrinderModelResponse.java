package com.kaldinote.gear.presentation.dto;

import com.kaldinote.gear.domain.GrinderModel;
import java.math.BigDecimal;

public record GrinderModelResponse(
    Long id,
    String brand,
    String name,
    String adjustmentType,
    BigDecimal micronsPerClick,
    BigDecimal minSetting,
    BigDecimal maxSetting,
    String burrType,
    boolean convertible,
    boolean isSystem) {

  public static GrinderModelResponse from(GrinderModel m) {
    return new GrinderModelResponse(
        m.getId(),
        m.getBrand(),
        m.getName(),
        m.getAdjustmentType().name(),
        m.getMicronsPerClick(),
        m.getMinSetting(),
        m.getMaxSetting(),
        m.getBurrType() == null ? null : m.getBurrType().name(),
        m.toGrindSpec().convertible(),
        m.isSystem());
  }
}
