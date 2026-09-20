package com.kaldinote.recipe.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import com.kaldinote.AbstractIntegrationTest;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class RecipeMigrationTest extends AbstractIntegrationTest {

  @PersistenceContext private EntityManager entityManager;

  @Test
  @DisplayName(
      "AC-RECIPEV2-31 · temperature_type·recommended_roast_level을 지정하지 않고 만든 행은 HOT/MEDIUM이다")
  void temperature_type_recommended_roast_level을_지정하지_않은_행은_HOT_MEDIUM이다() {
    entityManager
        .createNativeQuery(
            "insert into recipes (title, dose_g, water_g) values ('마이그레이션 이전 레시피', 15.0, 250.0)")
        .executeUpdate();

    Object[] row =
        (Object[])
            entityManager
                .createNativeQuery(
                    "select temperature_type, recommended_roast_level from recipes"
                        + " where title = '마이그레이션 이전 레시피'")
                .getSingleResult();

    assertThat(row[0]).isEqualTo("HOT");
    assertThat(row[1]).isEqualTo("MEDIUM");
  }
}
