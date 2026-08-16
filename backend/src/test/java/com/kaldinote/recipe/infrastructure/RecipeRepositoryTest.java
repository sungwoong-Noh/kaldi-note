package com.kaldinote.recipe.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import com.kaldinote.AbstractIntegrationTest;
import com.kaldinote.recipe.domain.GrindSettingUnit;
import com.kaldinote.recipe.domain.Recipe;
import com.kaldinote.recipe.domain.RecipeStep;
import com.kaldinote.recipe.domain.RecipeVisibility;
import com.kaldinote.recipe.domain.StepType;
import com.kaldinote.user.domain.User;
import com.kaldinote.user.infrastructure.UserRepository;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class RecipeRepositoryTest extends AbstractIntegrationTest {

  @Autowired private RecipeRepository recipeRepository;
  @Autowired private UserRepository userRepository;

  private Long ownerId() {
    return userRepository.save(User.create(null, "테스터", null)).getId();
  }

  @Test
  void 레시피와_스텝을_함께_저장하고_조회한다() {
    Recipe recipe =
        Recipe.create(
            ownerId(),
            "아침 레시피",
            null,
            RecipeVisibility.PRIVATE,
            new BigDecimal("15.0"),
            new BigDecimal("250.0"),
            null,
            null,
            null,
            null,
            null,
            null,
            (GrindSettingUnit) null,
            null);
    recipe.replaceSteps(
        List.of(RecipeStep.of(1, StepType.BLOOM, 0, 10, new BigDecimal("40.0"), null, null, null)));

    Recipe saved = recipeRepository.save(recipe);

    Recipe found = recipeRepository.findById(saved.getId()).orElseThrow();
    assertThat(found.getSteps()).hasSize(1);
    assertThat(found.getSteps().get(0).getStepOrder()).isEqualTo(1);
  }

  @Test
  void 소프트_삭제된_레시피는_findByIdAndDeletedAtIsNull로_찾을_수_없다() {
    Recipe recipe =
        Recipe.create(
            ownerId(),
            "삭제될 레시피",
            null,
            RecipeVisibility.PRIVATE,
            new BigDecimal("15.0"),
            new BigDecimal("250.0"),
            null,
            null,
            null,
            null,
            null,
            null,
            (GrindSettingUnit) null,
            null);
    Recipe saved = recipeRepository.save(recipe);
    saved.softDelete();
    recipeRepository.save(saved);

    assertThat(recipeRepository.findByIdAndDeletedAtIsNull(saved.getId())).isEmpty();
    assertThat(recipeRepository.findById(saved.getId())).isPresent();
  }
}
