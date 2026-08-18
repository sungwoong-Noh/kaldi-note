package com.kaldinote.recipe.presentation.dto;

import com.kaldinote.recipe.domain.Recipe;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;

public record RecipeResponse(
    Long id,
    Long ownerUserId,
    String sourceType,
    String title,
    String description,
    String brewMethod,
    String visibility,
    Long parentRecipeId,
    Long forkRootId,
    BigDecimal doseG,
    BigDecimal waterG,
    BigDecimal ratio,
    BigDecimal waterTempC,
    Integer totalTimeSeconds,
    Long brewerId,
    Long filterId,
    Long grinderModelId,
    BigDecimal grindSettingValue,
    String grindSettingUnit,
    BigDecimal grindMicronEstimated,
    List<RecipeStepResponse> steps,
    Instant createdAt,
    Instant updatedAt) {

  private static final int DIVISION_SCALE = 6;
  private static final int RATIO_SCALE = 1;

  public static RecipeResponse from(Recipe r) {
    return new RecipeResponse(
        r.getId(),
        r.getOwnerUserId(),
        r.getSourceType().name(),
        r.getTitle(),
        r.getDescription(),
        r.getBrewMethod().name(),
        r.getVisibility().name(),
        r.getParentRecipeId(),
        r.getForkRootId(),
        r.getDoseG(),
        r.getWaterG(),
        ratio(r.getWaterG(), r.getDoseG()),
        r.getWaterTempC(),
        r.getTotalTimeSeconds(),
        r.getBrewerId(),
        r.getFilterId(),
        r.getGrinderModelId(),
        r.getGrindSettingValue(),
        r.getGrindSettingUnit() == null ? null : r.getGrindSettingUnit().name(),
        r.getGrindMicronEstimated(),
        RecipeStepResponse.listFrom(r.getSteps()),
        r.getCreatedAt(),
        r.getUpdatedAt());
  }

  private static BigDecimal ratio(BigDecimal waterG, BigDecimal doseG) {
    return waterG
        .divide(doseG, DIVISION_SCALE, RoundingMode.HALF_UP)
        .setScale(RATIO_SCALE, RoundingMode.HALF_UP);
  }
}
