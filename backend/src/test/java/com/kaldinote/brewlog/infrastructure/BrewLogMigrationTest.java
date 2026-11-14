package com.kaldinote.brewlog.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import com.kaldinote.AbstractIntegrationTest;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class BrewLogMigrationTest extends AbstractIntegrationTest {

  @PersistenceContext private EntityManager entityManager;

  /**
   * V15의 백필 결과 — 레시피를 참조하는 기록은 스냅샷을 갖는다. V19(빠른 기록)부터 컬럼은 nullable이라 「컬럼 NOT NULL」로는 더 이상 확인할 수
   * 없다(docs/specs/2026-09-20-recipe-v2-data-model.md AC-32 정정). 레시피 없이 쓴 기록만 스냅샷이 비어 있어야 한다.
   */
  @Test
  @DisplayName("AC-RECIPEV2-32 · 레시피가 연결된 잔은 전부 recipeSnapshot이 채워져 있다")
  void 레시피가_연결된_잔은_전부_recipeSnapshot이_채워져_있다() {
    Number missing =
        (Number)
            entityManager
                .createNativeQuery(
                    "select count(*) from brew_logs"
                        + " where recipe_id is not null and recipe_snapshot is null")
                .getSingleResult();

    assertThat(missing.longValue()).isZero();
  }
}
