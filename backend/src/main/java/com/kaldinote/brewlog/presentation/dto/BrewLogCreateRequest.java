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
import java.time.LocalDate;

/**
 * 기록 생성 요청. **필수는 원두량·물량 둘뿐이다**(ADR 0011, docs/specs/2026-11-14-quick-brew.md).
 *
 * <p>brewedAt이 없으면 서버가 저장 시각으로 채운다. 원두는 봉투(beanBatchId) · 카탈로그 상품(beanProductId) · 직접 입력
 * 이름(beanName) 중 하나로 남긴다 — beanProductId와 beanName을 함께 주면 400이다.
 */
public record BrewLogCreateRequest(
    Long recipeId,
    Long beanBatchId,
    Long beanProductId,
    @Size(max = 100) String beanName,
    LocalDate roastedAt,
    @PastOrPresent Instant brewedAt,
    BrewLogVisibility visibility,
    @NotNull @DecimalMin(value = "0.0", inclusive = false) BigDecimal actualDoseG,
    @NotNull @DecimalMin(value = "0.0", inclusive = false) BigDecimal actualWaterG,
    BigDecimal actualWaterTempC,
    Integer actualTotalTimeSeconds,
    Integer actualDrawdownSeconds,
    Long userGrinderId,
    BigDecimal actualGrindSettingValue,
    BigDecimal beverageWeightG,
    BigDecimal tdsPercent,
    @DecimalMin("0.5") @DecimalMax("5.0") BigDecimal rating,
    @Min(1) @Max(5) Short acidity,
    @Min(1) @Max(5) Short sweetness,
    @Min(1) @Max(5) Short body,
    @Min(1) @Max(5) Short bitterness,
    @Min(1) @Max(5) Short aftertaste,
    @Size(max = 1000) String overallNote) {}
