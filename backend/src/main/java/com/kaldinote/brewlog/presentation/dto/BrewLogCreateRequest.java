package com.kaldinote.brewlog.presentation.dto;

import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.Instant;

public record BrewLogCreateRequest(
    @NotNull Long recipeId,
    @NotNull Long beanBatchId,
    @NotNull Instant brewedAt,
    @NotNull BigDecimal actualDoseG,
    @NotNull BigDecimal actualWaterG,
    @NotNull BigDecimal actualWaterTempC,
    Integer actualTotalTimeSeconds,
    Integer actualDrawdownSeconds,
    @NotNull Long userGrinderId,
    @NotNull BigDecimal actualGrindSettingValue,
    BigDecimal beverageWeightG,
    BigDecimal tdsPercent,
    BigDecimal rating,
    Short acidity,
    Short sweetness,
    Short body,
    Short bitterness,
    Short aftertaste,
    String overallNote) {}
