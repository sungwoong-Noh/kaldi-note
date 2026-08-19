package com.kaldinote.recipe.presentation.dto;

import com.kaldinote.recipe.domain.Recipe;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;

/**
 * 목록 항목용. RecipeResponse에서 steps만 뺐다.
 *
 * <p>스텝을 담지 않으므로 20개 레시피를 반환할 때 스텝 100여 개가 함께 직렬화되는 일이 없다. 스텝이 필요하면 단건 조회를 부른다.
 */
public record RecipeSummaryResponse(
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
    Instant createdAt,
    Instant updatedAt) {

  private static final int DIVISION_SCALE = 6;
  private static final int RATIO_SCALE = 1;

  public static RecipeSummaryResponse from(Recipe r) {
    return new RecipeSummaryResponse(
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
        r.getCreatedAt(),
        r.getUpdatedAt());
  }

  private static BigDecimal ratio(BigDecimal waterG, BigDecimal doseG) {
    if (waterG == null || doseG == null || doseG.signum() == 0) {
      return null;
    }
    return waterG
        .divide(doseG, DIVISION_SCALE, RoundingMode.HALF_UP)
        .setScale(RATIO_SCALE, RoundingMode.HALF_UP);
  }
}
