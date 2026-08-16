package com.kaldinote.recipe.presentation.dto;

import com.kaldinote.recipe.domain.GrindSettingUnit;
import com.kaldinote.recipe.domain.RecipeSourceType;
import com.kaldinote.recipe.domain.RecipeVisibility;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.List;

public record CreateRecipeRequest(
    RecipeSourceType sourceType,
    @NotNull String title,
    String description,
    RecipeVisibility visibility,
    @NotNull BigDecimal doseG,
    @NotNull BigDecimal waterG,
    BigDecimal waterTempC,
    Integer totalTimeSeconds,
    Long brewerId,
    Long filterId,
    Long grinderModelId,
    BigDecimal grindSettingValue,
    GrindSettingUnit grindSettingUnit,
    @Valid List<StepRequest> steps) {

  public CreateRecipeRequest {
    if (steps == null) {
      steps = List.of();
    }
  }
}
