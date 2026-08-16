package com.kaldinote.recipe.infrastructure;

import com.kaldinote.recipe.domain.Recipe;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RecipeRepository extends JpaRepository<Recipe, Long> {
  Optional<Recipe> findByIdAndDeletedAtIsNull(Long id);
}
