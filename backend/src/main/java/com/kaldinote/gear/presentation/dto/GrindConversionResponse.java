package com.kaldinote.gear.presentation.dto;

import com.kaldinote.grind.domain.GrindConversion;
import java.math.BigDecimal;

public record GrindConversionResponse(
    BigDecimal sourceSetting,
    BigDecimal micron,
    BigDecimal targetSetting,
    boolean targetOutOfRange,
    boolean estimated,
    String warning) {

  public static GrindConversionResponse from(GrindConversion c) {
    return new GrindConversionResponse(
        c.sourceSetting(),
        c.micron(),
        c.targetSetting(),
        c.targetOutOfRange(),
        c.estimated(),
        c.warning());
  }
}
