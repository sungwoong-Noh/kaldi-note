package com.kaldinote.recipe.presentation.dto;

import com.kaldinote.recipe.domain.GrindSettingUnit;
import com.kaldinote.recipe.domain.RecipeVisibility;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;

public record UpdateRecipeRequest(
    @NotBlank @Size(max = 100) String title,
    @Size(max = 2000) String description,
    RecipeVisibility visibility,
    @NotNull @DecimalMin("1.0") @DecimalMax("200.0") BigDecimal doseG,
    @NotNull @DecimalMin("10.0") @DecimalMax("3000.0") BigDecimal waterG,
    @DecimalMin("60.0") @DecimalMax("100.0") BigDecimal waterTempC,
    @Min(1) @Max(3600) Integer totalTimeSeconds,
    Long brewerId,
    Long filterId,
    Long grinderModelId,
    BigDecimal grindSettingValue,
    GrindSettingUnit grindSettingUnit,
    @Valid @Size(max = 30) List<StepRequest> steps) {

  public UpdateRecipeRequest {
    if (steps == null) {
      steps = List.of();
    }
  }
}
