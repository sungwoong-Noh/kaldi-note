package com.kaldinote.catalog.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import com.kaldinote.AbstractIntegrationTest;
import com.kaldinote.catalog.domain.BeanMix;
import com.kaldinote.catalog.domain.BeanOrigin;
import com.kaldinote.catalog.domain.BeanProduct;
import com.kaldinote.catalog.domain.RoastLevel;
import com.kaldinote.catalog.domain.Roaster;
import com.kaldinote.inventory.domain.BeanBatch;
import com.kaldinote.inventory.infrastructure.BeanBatchRepository;
import com.kaldinote.user.domain.User;
import com.kaldinote.user.infrastructure.UserRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class BeanCatalogRepositoryTest extends AbstractIntegrationTest {

  @Autowired private RoasterRepository roasterRepository;
  @Autowired private BeanProductRepository beanProductRepository;
  @Autowired private BeanBatchRepository beanBatchRepository;
  @Autowired private UserRepository userRepository;

  private Long userId() {
    return userRepository.save(User.create(null, "테스터", null)).getId();
  }

  private Long roasterId() {
    return roasterRepository.save(Roaster.createByUser("프릳츠커피컴퍼니", "KR", null, userId())).getId();
  }

  @Test
  void 원두_상품과_산지를_함께_저장하고_조회한다() {
    BeanProduct product =
        BeanProduct.createByUser(
            roasterId(),
            "예가체프 내추럴",
            BeanMix.SINGLE_ORIGIN,
            RoastLevel.LIGHT,
            null,
            null,
            false,
            null,
            null,
            userId());
    product.attachOrigins(
        List.of(
            BeanOrigin.of("ET", "예가체프", null, null, null, null, null, new BigDecimal("100.0"))));

    BeanProduct saved = beanProductRepository.save(product);

    BeanProduct found = beanProductRepository.findById(saved.getId()).orElseThrow();
    assertThat(found.getOrigins()).hasSize(1);
    assertThat(found.getOrigins().get(0).getRatioPercent()).isEqualByComparingTo("100.0");
  }

  @Test
  void 재고를_저장하면_remainingG가_weightG로_초기화된다() {
    Long uid = userId();
    Long productId =
        beanProductRepository
            .save(
                BeanProduct.createByUser(
                    roasterId(),
                    "시그니처 블렌드",
                    BeanMix.BLEND,
                    RoastLevel.MEDIUM_DARK,
                    null,
                    null,
                    false,
                    null,
                    null,
                    uid))
            .getId();

    BeanBatch batch =
        BeanBatch.create(
            uid, productId, LocalDate.now(), null, new BigDecimal("200.0"), null, null);
    BeanBatch saved = beanBatchRepository.save(batch);

    BeanBatch found = beanBatchRepository.findById(saved.getId()).orElseThrow();
    assertThat(found.getRemainingG()).isEqualByComparingTo("200.0");
    assertThat(found.isFinished()).isFalse();
    assertThat(found.isFrozen()).isFalse();
    assertThat(found.getFrozenAt()).isNull();
  }
}
