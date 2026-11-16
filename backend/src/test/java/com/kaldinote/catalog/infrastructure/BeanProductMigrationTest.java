package com.kaldinote.catalog.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.kaldinote.AbstractIntegrationTest;
import com.kaldinote.catalog.domain.Roaster;
import com.kaldinote.user.domain.User;
import com.kaldinote.user.infrastructure.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class BeanProductMigrationTest extends AbstractIntegrationTest {

  @PersistenceContext private EntityManager entityManager;
  @Autowired private RoasterRepository roasterRepository;
  @Autowired private UserRepository userRepository;

  private void insert(Long roasterId, String name, String url, Long ownerId) {
    // 마이그레이션 이전 행 = promoted 컬럼을 모르는 INSERT(BeanProductFlagsMigrationTest와 같은 방식)
    entityManager
        .createNativeQuery(
            "insert into bean_products (roaster_id, name, bean_mix, product_url, created_by_user_id)"
                + " values (:r, :n, 'SINGLE_ORIGIN', :u, :o)")
        .setParameter("r", roasterId)
        .setParameter("n", name)
        .setParameter("u", url)
        .setParameter("o", ownerId)
        .executeUpdate();
  }

  @Test
  @DisplayName("AC-ADMINBEAN-61 · 마이그레이션 뒤 기존 원두의 promoted는 false이고 크롤러 URL은 유일하다")
  @SuppressWarnings("unchecked")
  void 기존_원두의_promoted는_false이고_크롤러_URL은_유일하다() {
    Long r = roasterRepository.save(Roaster.createBySystem("마이그레이션 로스터")).getId();
    Long u1 = userRepository.save(User.create(null, "하나", null)).getId();
    Long u2 = userRepository.save(User.create(null, "둘", null)).getId();
    insert(r, "크롤러 A", "https://m.example/a", null);
    insert(r, "크롤러 B", "https://m.example/b", null);
    insert(r, "사용자 A", "https://m.example/same", u1);
    insert(r, "사용자 B", "https://m.example/same", u2);

    List<Object[]> rows =
        entityManager
            .createNativeQuery(
                "select name, promoted from bean_products where roaster_id = :r order by name")
            .setParameter("r", r)
            .getResultList();
    assertThat(rows).hasSize(4).allSatisfy(row -> assertThat(row[1]).isEqualTo(false));

    // 실패한 INSERT는 트랜잭션을 깨므로 마지막에 둔다
    assertThatThrownBy(() -> insert(r, "크롤러 C", "https://m.example/a", null))
        .hasStackTraceContaining("uq_bean_products_crawler_url");
  }
}
