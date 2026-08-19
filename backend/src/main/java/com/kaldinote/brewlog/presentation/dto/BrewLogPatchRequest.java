package com.kaldinote.brewlog.presentation.dto;

import com.kaldinote.brewlog.domain.BrewLogVisibility;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;

/**
 * 부분 수정 요청. null은 언제나 "변경 없음"이고 값 지우기는 지원하지 않는다.
 *
 * <p>recipeId·beanBatchId는 일부러 빠져 있다. 바꾸면 actualDoseG 이하의 실측 스냅샷이 어떤 레시피·어떤 원두의 기록인지 알 수 없게 된다. 잘못
 * 골랐으면 삭제하고 다시 쓴다. 요청에 담아도 Jackson이 무시한다.
 */
public record BrewLogPatchRequest(
    Instant brewedAt,
    BrewLogVisibility visibility,
    @DecimalMin("0.1") @DecimalMax("999.9") BigDecimal actualDoseG,
    @DecimalMin("0.1") @DecimalMax("9999.9") BigDecimal actualWaterG,
    @DecimalMin("0.0") @DecimalMax("100.0") BigDecimal actualWaterTempC,
    @Positive Integer actualTotalTimeSeconds,
    @PositiveOrZero Integer actualDrawdownSeconds,
    Long userGrinderId,
    @PositiveOrZero BigDecimal actualGrindSettingValue,
    @DecimalMin("0.1") @DecimalMax("9999.9") BigDecimal beverageWeightG,
    @DecimalMin("0.01") @DecimalMax("99.99") BigDecimal tdsPercent,
    @DecimalMin("0.5") @DecimalMax("5.0") BigDecimal rating,
    @Min(1) @Max(5) Short acidity,
    @Min(1) @Max(5) Short sweetness,
    @Min(1) @Max(5) Short body,
    @Min(1) @Max(5) Short bitterness,
    @Min(1) @Max(5) Short aftertaste,
    @Size(max = 1000) String overallNote) {}
