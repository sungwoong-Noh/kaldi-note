package com.kaldinote.recipe.presentation.dto;

import com.kaldinote.recipe.domain.RecipeStep;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

public record RecipeStepResponse(
    Integer stepOrder,
    String stepType,
    Integer startAtSeconds,
    Integer durationSeconds,
    BigDecimal waterG,
    BigDecimal cumulativeWaterG,
    String pourTechnique,
    String agitation,
    String note) {

  public static List<RecipeStepResponse> listFrom(List<RecipeStep> steps) {
    List<RecipeStepResponse> result = new ArrayList<>();
    BigDecimal cumulative = BigDecimal.ZERO.setScale(1);
    for (RecipeStep s : steps) {
      if (s.getWaterG() != null) {
        cumulative = cumulative.add(s.getWaterG());
      }
      result.add(
          new RecipeStepResponse(
              s.getStepOrder(),
              s.getStepType().name(),
              s.getStartAtSeconds(),
              s.getDurationSeconds(),
              s.getWaterG(),
              cumulative,
              s.getPourTechnique() == null ? null : s.getPourTechnique().name(),
              s.getAgitation() == null ? null : s.getAgitation().name(),
              s.getNote()));
    }
    return result;
  }
}
