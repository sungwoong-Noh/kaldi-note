package com.kaldinote.recipe.infrastructure;

import com.kaldinote.recipe.domain.Recipe;
import com.kaldinote.recipe.domain.RecipeStep;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RecipeStepRepository extends JpaRepository<RecipeStep, Long> {
  void deleteAllByRecipe(Recipe recipe);
}
