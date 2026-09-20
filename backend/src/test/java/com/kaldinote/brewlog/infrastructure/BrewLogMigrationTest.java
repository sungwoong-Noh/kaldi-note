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
   * Testcontainers는 매번 빈 DB에 V1~V15를 한 번에 적용하므로, "마이그레이션 이전에 존재했던 실제 brew_logs 행"을 재현할 방법이 없다(백필 대상
   * 자체가 없다). 그래서 이 테스트는 백필 UPDATE의 실행 결과 대신, V15가 끝에 거는 제약(recipe_snapshot NOT NULL)이 실제로 걸렸는지로
   * 마이그레이션 완료를 검증한다 — 운영 DB(기존 행 존재)에서의 백필 자체는 AC-RECIPEV2-18~21(Task 5, 새로 생성되는 recipeSnapshot의
   * 필드별 값)이 같은 JSON 구성 로직을 API 경로로 검증한다.
   */
  @Test
  @DisplayName("AC-RECIPEV2-32 · 마이그레이션 후 recipe_snapshot 컬럼은 NOT NULL이다")
  void 마이그레이션_후_recipe_snapshot_컬럼은_NOT_NULL이다() {
    String nullable =
        (String)
            entityManager
                .createNativeQuery(
                    "select is_nullable from information_schema.columns"
                        + " where table_name = 'brew_logs' and column_name = 'recipe_snapshot'")
                .getSingleResult();

    assertThat(nullable).isEqualTo("NO");
  }
}
