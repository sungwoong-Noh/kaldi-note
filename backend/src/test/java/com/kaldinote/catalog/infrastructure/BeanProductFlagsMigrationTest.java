package com.kaldinote.catalog.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import com.kaldinote.AbstractIntegrationTest;
import com.kaldinote.catalog.domain.Roaster;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class BeanProductFlagsMigrationTest extends AbstractIntegrationTest {

  @PersistenceContext private EntityManager entityManager;
  @Autowired private RoasterRepository roasterRepository;

  /**
   * 마이그레이션 이전 행 = 두 플래그 컬럼을 모르는 INSERT. ADD COLUMN ... DEFAULT false는 기존 행을 이 기본값으로 채우므로 같은 결과다
   * (RecipeMigrationTest와 같은 방식).
   */
  @Test
  @DisplayName("AC-BEANDETAIL-01 · 마이그레이션 뒤 기존 원두의 두 플래그는 false다")
  @SuppressWarnings("unchecked")
  void 마이그레이션_뒤_기존_원두의_두_플래그는_false다() {
    Long roasterId = roasterRepository.save(Roaster.createBySystem("플래그 로스터")).getId();
    for (String name : List.of("원두 A", "원두 B", "원두 C")) {
      entityManager
          .createNativeQuery(
              "insert into bean_products (roaster_id, name, bean_mix, roast_level)"
                  + " values (:r, :n, 'SINGLE_ORIGIN', 'LIGHT')")
          .setParameter("r", roasterId)
          .setParameter("n", name)
          .executeUpdate();
    }

    List<Object[]> rows =
        entityManager
            .createNativeQuery(
                "select name, roast_level, hidden, manually_edited from bean_products"
                    + " where roaster_id = :r order by name")
            .setParameter("r", roasterId)
            .getResultList();

    assertThat(rows)
        .extracting(r -> r[0], r -> r[1], r -> r[2], r -> r[3])
        .containsExactly(
            org.assertj.core.groups.Tuple.tuple("원두 A", "LIGHT", false, false),
            org.assertj.core.groups.Tuple.tuple("원두 B", "LIGHT", false, false),
            org.assertj.core.groups.Tuple.tuple("원두 C", "LIGHT", false, false));
  }
}
