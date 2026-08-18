package com.kaldinote.brewlog.presentation.dto;

import com.kaldinote.brewlog.domain.BrewLogVisibility;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;

public record BrewLogCreateRequest(
    @NotNull Long recipeId,
    @NotNull Long beanBatchId,
    @NotNull @PastOrPresent Instant brewedAt,
    BrewLogVisibility visibility,
    @NotNull @DecimalMin(value = "0.0", inclusive = false) BigDecimal actualDoseG,
    @NotNull @DecimalMin(value = "0.0", inclusive = false) BigDecimal actualWaterG,
    @NotNull BigDecimal actualWaterTempC,
    Integer actualTotalTimeSeconds,
    Integer actualDrawdownSeconds,
    @NotNull Long userGrinderId,
    @NotNull BigDecimal actualGrindSettingValue,
    BigDecimal beverageWeightG,
    BigDecimal tdsPercent,
    @DecimalMin("0.5") @DecimalMax("5.0") BigDecimal rating,
    @Min(1) @Max(5) Short acidity,
    @Min(1) @Max(5) Short sweetness,
    @Min(1) @Max(5) Short body,
    @Min(1) @Max(5) Short bitterness,
    @Min(1) @Max(5) Short aftertaste,
    @Size(max = 1000) String overallNote) {}
