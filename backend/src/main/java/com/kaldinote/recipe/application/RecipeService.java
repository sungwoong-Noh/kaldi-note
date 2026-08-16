package com.kaldinote.recipe.application;

import com.kaldinote.common.error.BusinessException;
import com.kaldinote.common.error.ErrorCode;
import com.kaldinote.gear.domain.GrinderModel;
import com.kaldinote.gear.infrastructure.BrewerRepository;
import com.kaldinote.gear.infrastructure.GrinderModelRepository;
import com.kaldinote.grind.domain.GrindConverter;
import com.kaldinote.grind.domain.GrindSpec;
import com.kaldinote.recipe.domain.GrindSettingUnit;
import com.kaldinote.recipe.domain.Recipe;
import com.kaldinote.recipe.domain.RecipeSourceType;
import com.kaldinote.recipe.domain.RecipeStep;
import com.kaldinote.recipe.domain.RecipeVisibility;
import com.kaldinote.recipe.domain.StepType;
import com.kaldinote.recipe.infrastructure.RecipeRepository;
import com.kaldinote.recipe.infrastructure.RecipeStepRepository;
import com.kaldinote.recipe.presentation.dto.CreateRecipeRequest;
import com.kaldinote.recipe.presentation.dto.RecipeResponse;
import com.kaldinote.recipe.presentation.dto.StepRequest;
import com.kaldinote.recipe.presentation.dto.UpdateRecipeRequest;
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
  private final RecipeStepRepository recipeStepRepository;
  private final GrinderModelRepository grinderRepository;
  private final BrewerRepository brewerRepository;
  private final GrindConverter grindConverter = new GrindConverter();

  @Transactional
  public RecipeResponse create(Long userId, CreateRecipeRequest request) {
    if (request.sourceType() != null && request.sourceType() != RecipeSourceType.USER) {
      throw new BusinessException(ErrorCode.FORBIDDEN, "일반 API로는 CURATED 레시피를 만들 수 없습니다.");
    }
    requireExists(request.brewerId(), brewerRepository::existsById, "브루어");

    BigDecimal micron =
        computeGrindMicronEstimated(
            request.grindSettingUnit(), request.grindSettingValue(), request.grinderModelId());

    List<RecipeStep> steps = buildSteps(request.steps(), request.waterG());

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

  public RecipeResponse get(Long userId, Long recipeId) {
    return RecipeResponse.from(findOwned(userId, recipeId));
  }

  @Transactional
  public RecipeResponse update(Long userId, Long recipeId, UpdateRecipeRequest request) {
    Recipe recipe = findOwned(userId, recipeId);

    requireExists(request.brewerId(), brewerRepository::existsById, "브루어");

    BigDecimal micron =
        computeGrindMicronEstimated(
            request.grindSettingUnit(), request.grindSettingValue(), request.grinderModelId());
    List<RecipeStep> steps = buildSteps(request.steps(), request.waterG());

    recipe.applyUpdate(
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

    // UNIQUE(recipe_id, step_order) 위반을 피하려면 기존 스텝을 지우고 flush한 뒤 새로 넣는다.
    // clear()+addAll()만 하면 Hibernate가 insert를 delete보다 먼저 실행해 유니크 제약에 걸린다.
    recipeStepRepository.deleteAllByRecipe(recipe);
    recipeStepRepository.flush();
    recipe.getSteps().clear();
    recipe.replaceSteps(steps);

    return RecipeResponse.from(recipe);
  }

  @Transactional
  public void delete(Long userId, Long recipeId) {
    Recipe recipe = findOwned(userId, recipeId);
    recipe.softDelete();
  }

  private Recipe findOwned(Long userId, Long recipeId) {
    Recipe recipe =
        recipeRepository
            .findByIdAndDeletedAtIsNull(recipeId)
            .orElseThrow(
                () -> new BusinessException(ErrorCode.NOT_FOUND, "레시피를 찾을 수 없습니다: " + recipeId));
    if (!recipe.isOwnedBy(userId)) {
      throw new BusinessException(ErrorCode.FORBIDDEN, "본인의 레시피만 접근할 수 있습니다.");
    }
    return recipe;
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

  private void requireExists(Long id, java.util.function.Predicate<Long> existsById, String label) {
    if (id != null && !existsById.test(id)) {
      throw new BusinessException(ErrorCode.NOT_FOUND, label + "를 찾을 수 없습니다: " + id);
    }
  }

  private List<RecipeStep> buildSteps(List<StepRequest> stepRequests, BigDecimal totalWaterG) {
    List<RecipeStep> steps = new ArrayList<>();
    BigDecimal sum = BigDecimal.ZERO;

    for (int i = 0; i < stepRequests.size(); i++) {
      StepRequest s = stepRequests.get(i);
      validateStepWater(s);

      if (i > 0) {
        StepRequest prev = stepRequests.get(i - 1);
        int prevEnd = prev.startAtSeconds() + prev.durationSeconds();
        if (prevEnd > s.startAtSeconds()) {
          throw new BusinessException(ErrorCode.RECIPE_STEP_OVERLAP);
        }
      }

      if (s.waterG() != null) {
        sum = sum.add(s.waterG());
      }
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

    if (!stepRequests.isEmpty() && sum.compareTo(totalWaterG) != 0) {
      throw new BusinessException(ErrorCode.RECIPE_STEP_WATER_MISMATCH);
    }
    return steps;
  }

  private void validateStepWater(StepRequest s) {
    boolean pours = s.stepType() == StepType.BLOOM || s.stepType() == StepType.POUR;
    boolean hasPositiveWater = s.waterG() != null && s.waterG().compareTo(BigDecimal.ZERO) > 0;
    if (pours && !hasPositiveWater) {
      throw new BusinessException(ErrorCode.RECIPE_STEP_WATER_INVALID, "붓는 스텝은 물량이 0보다 커야 합니다.");
    }
    if (!pours && hasPositiveWater) {
      throw new BusinessException(ErrorCode.RECIPE_STEP_WATER_INVALID, "붓지 않는 스텝에는 물량을 넣을 수 없습니다.");
    }
  }
}
