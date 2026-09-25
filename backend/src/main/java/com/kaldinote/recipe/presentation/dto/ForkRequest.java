package com.kaldinote.recipe.presentation.dto;

import com.kaldinote.recipe.domain.GrindSettingUnit;
import com.kaldinote.recipe.domain.RecipeRoastLevel;
import com.kaldinote.recipe.domain.RecipeTemperatureType;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

/**
 * 담기(포크) 바디 — 생략한 필드는 원본 값을 그대로 물려받는다(AC-RECIPESBREWS-32). 값 범위 제약은 {@link CreateRecipeRequest}와 같되
 * 전부 optional이라 {@code @NotNull}은 없다.
 *
 * <p>{@code visibility}·{@code sourceType}은 담지 않는다 — 포크본은 항상 PRIVATE·USER로 고정되는 기존 불변식({@link
 * com.kaldinote.recipe.domain.Recipe#forkFrom})이라 바디로 바꿀 대상이 아니다. steps도 어떤 AC도 요구하지 않아 원본을 그대로
 * 복사한다.
 */
public record ForkRequest(
    @Size(max = 100) String title,
    @Size(max = 2000) String description,
    @DecimalMin("1.0") @DecimalMax("200.0") BigDecimal doseG,
    @DecimalMin("10.0") @DecimalMax("3000.0") BigDecimal waterG,
    @DecimalMin("60.0") @DecimalMax("100.0") BigDecimal waterTempC,
    @Min(1) @Max(3600) Integer totalTimeSeconds,
    Long brewerId,
    Long filterId,
    Long grinderModelId,
    BigDecimal grindSettingValue,
    GrindSettingUnit grindSettingUnit,
    RecipeTemperatureType temperatureType,
    RecipeRoastLevel recommendedRoastLevel) {}
