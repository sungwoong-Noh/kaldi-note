package com.kaldinote.recipe.application;

import com.kaldinote.common.error.BusinessException;
import com.kaldinote.common.error.ErrorCode;
import com.kaldinote.gear.domain.GrinderModel;
import com.kaldinote.gear.infrastructure.GrinderModelRepository;
import com.kaldinote.grind.domain.GrindConverter;
import com.kaldinote.grind.domain.GrindSpec;
import com.kaldinote.recipe.domain.GrindSettingUnit;
import com.kaldinote.recipe.domain.Recipe;
import com.kaldinote.recipe.domain.RecipeStep;
import com.kaldinote.recipe.domain.RecipeVisibility;
import com.kaldinote.recipe.infrastructure.RecipeRepository;
import com.kaldinote.recipe.presentation.dto.CreateRecipeRequest;
import com.kaldinote.recipe.presentation.dto.RecipeResponse;
import com.kaldinote.recipe.presentation.dto.StepRequest;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class RecipeService {

  private static final BigDecimal MICRON_MIN = new BigDecimal("100");
  private static final BigDecimal MICRON_MAX = new BigDecimal("2000");

  private final RecipeRepository recipeRepository;
  private final GrinderModelRepository grinderRepository;
  private final GrindConverter grindConverter = new GrindConverter();

  @Transactional
  public RecipeResponse create(Long userId, CreateRecipeRequest request) {
    BigDecimal micron =
        computeGrindMicronEstimated(
            request.grindSettingUnit(), request.grindSettingValue(), request.grinderModelId());

    List<RecipeStep> steps = buildSteps(request.steps());

    Recipe recipe =
        Recipe.create(
            userId,
            request.title(),
            request.description(),
            request.visibility() == null ? RecipeVisibility.PRIVATE : request.visibility(),
            request.doseG(),
            request.waterG(),
            request.waterTempC(),
            request.totalTimeSeconds(),
            request.brewerId(),
            request.filterId(),
            request.grinderModelId(),
            request.grindSettingValue(),
            request.grindSettingUnit(),
            micron);
    recipe.replaceSteps(steps);

    return RecipeResponse.from(recipeRepository.save(recipe));
  }

  private BigDecimal computeGrindMicronEstimated(
      GrindSettingUnit unit, BigDecimal value, Long grinderModelId) {
    if (unit == null) {
      return null;
    }
    if (value == null) {
      throw new BusinessException(
          ErrorCode.INVALID_REQUEST, "grindSettingUnit이 있으면 grindSettingValue가 필요합니다.");
    }
    if (unit == GrindSettingUnit.MICRON) {
      if (value.compareTo(MICRON_MIN) < 0 || value.compareTo(MICRON_MAX) > 0) {
        throw new BusinessException(ErrorCode.INVALID_REQUEST, "MICRON 설정값은 100~2000 사이여야 합니다.");
      }
      return value.setScale(0, RoundingMode.HALF_UP);
    }

    // CLICK / NUMBER
    if (grinderModelId == null) {
      throw new BusinessException(
          ErrorCode.INVALID_REQUEST, "grindSettingUnit이 CLICK/NUMBER이면 grinderModelId가 필요합니다.");
    }
    GrinderModel grinder =
        grinderRepository
            .findById(grinderModelId)
            .orElseThrow(
                () ->
                    new BusinessException(
                        ErrorCode.NOT_FOUND, "그라인더를 찾을 수 없습니다: " + grinderModelId));
    GrindSpec spec = grinder.toGrindSpec();
    if (!spec.convertible()) {
      return null; // 무단계 그라인더: 환산 불가 → 스냅샷 없이 성공 (AC-RECIPE-08)
    }
    return grindConverter.toMicron(spec, value); // 범위 밖이면 GrindSettingOutOfRangeException → 400
  }

  private List<RecipeStep> buildSteps(List<StepRequest> stepRequests) {
    List<RecipeStep> steps = new ArrayList<>();
    for (int i = 0; i < stepRequests.size(); i++) {
      StepRequest s = stepRequests.get(i);
      steps.add(
          RecipeStep.of(
              i + 1,
              s.stepType(),
              s.startAtSeconds(),
              s.durationSeconds(),
              s.waterG(),
              s.pourTechnique(),
              s.agitation(),
              s.note()));
    }
    return steps;
  }
}
