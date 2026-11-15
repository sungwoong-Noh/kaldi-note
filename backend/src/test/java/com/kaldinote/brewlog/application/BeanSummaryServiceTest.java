package com.kaldinote.brewlog.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.kaldinote.AbstractIntegrationTest;
import com.kaldinote.brewlog.domain.BeanSummary;
import com.kaldinote.brewlog.domain.BeanSummary.Cup;
import com.kaldinote.brewlog.domain.BrewLog;
import com.kaldinote.brewlog.domain.BrewLogVisibility;
import com.kaldinote.brewlog.infrastructure.BrewLogRepository;
import com.kaldinote.catalog.domain.BeanMix;
import com.kaldinote.catalog.domain.BeanProduct;
import com.kaldinote.catalog.domain.RoastLevel;
import com.kaldinote.catalog.domain.Roaster;
import com.kaldinote.catalog.infrastructure.BeanProductRepository;
import com.kaldinote.catalog.infrastructure.RoasterRepository;
import com.kaldinote.inventory.domain.BeanBatch;
import com.kaldinote.inventory.infrastructure.BeanBatchRepository;
import com.kaldinote.user.domain.User;
import com.kaldinote.user.infrastructure.UserRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class BeanSummaryServiceTest extends AbstractIntegrationTest {

  @Autowired private BrewLogService service;
  @Autowired private BrewLogRepository brewLogRepository;
  @Autowired private UserRepository userRepository;
  @Autowired private RoasterRepository roasterRepository;
  @Autowired private BeanProductRepository beanProductRepository;
  @Autowired private BeanBatchRepository beanBatchRepository;

  private Long me;
  private Long other;
  private Long roasterId;

  @BeforeEach
  void setUp() {
    me = userRepository.save(User.create(null, "나", null)).getId();
    other = userRepository.save(User.create(null, "남", null)).getId();
    roasterId = roasterRepository.save(Roaster.createBySystem("요약 로스터")).getId();
  }

  private Long product(String name) {
    return beanProductRepository
        .save(
            BeanProduct.createByCrawler(
                roasterId, name, BeanMix.SINGLE_ORIGIN, RoastLevel.LIGHT, null, null, null))
        .getId();
  }

  private BrewLog log(
      Long userId,
      Long productId,
      Long batchId,
      String beanName,
      String brewedAt,
      BrewLogVisibility visibility) {
    BrewLog log =
        BrewLog.create(
            userId,
            null,
            null,
            batchId,
            Instant.parse(brewedAt),
            visibility,
            new BigDecimal("16.0"),
            new BigDecimal("250.0"),
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            new BigDecimal("4.0"),
            null,
            null,
            null,
            null,
            null,
            null);
    log.recordBean(productId, beanName, null);
    return brewLogRepository.save(log);
  }

  private BrewLog mine(Long productId, String brewedAt) {
    return log(me, productId, null, null, brewedAt, BrewLogVisibility.PRIVATE);
  }

  @Test
  @DisplayName("AC-BEANDETAIL-13 · 요약은 내 기록만 세고, 봉투로 고른 예전 기록도 센다")
  void 요약은_내_기록만_세고_봉투로_고른_예전_기록도_센다() {
    Long p41 = product("요약 41");
    Long p42 = product("요약 42");
    Long batch =
        beanBatchRepository
            .save(
                BeanBatch.create(
                    me, p41, LocalDate.of(2026, 11, 1), null, new BigDecimal("200.0"), null, null))
            .getId();
    mine(p41, "2026-11-10T00:00:00Z");
    mine(p41, "2026-11-11T00:00:00Z");
    log(me, null, batch, null, "2026-11-01T00:00:00Z", BrewLogVisibility.PRIVATE);
    mine(p42, "2026-11-12T00:00:00Z");
    for (int i = 0; i < 3; i++) {
      log(other, p41, null, null, "2026-11-1%dT00:00:00Z".formatted(i), BrewLogVisibility.PUBLIC);
    }

    assertThat(service.beanSummary(me, p41, null).brewCount()).isEqualTo(3);
  }

  @Test
  @DisplayName("AC-BEANDETAIL-14 · 직접 적은 원두는 이름이 정확히 같은 기록만 센다")
  void 직접_적은_원두는_이름이_정확히_같은_기록만_센다() {
    for (String name : new String[] {"하늘 블렌드", "하늘 블렌드", "하늘 블렌드 2", "하늘블렌드"}) {
      log(me, null, null, name, "2026-11-10T00:00:00Z", BrewLogVisibility.PRIVATE);
    }

    assertThat(service.beanSummary(me, null, " 하늘 블렌드 ").brewCount()).isEqualTo(2);
  }

  @Test
  @DisplayName("AC-BEANDETAIL-18 · 최근 3개는 최신순이다")
  void 최근_3개는_최신순이다() {
    Long p = product("요약 최근");
    for (String day : new String[] {"08", "13", "01", "11", "05"}) {
      mine(p, "2026-11-%sT00:00:00Z".formatted(day));
    }

    BeanSummary s = service.beanSummary(me, p, null);

    assertThat(s.recent())
        .extracting(Cup::brewedAt)
        .containsExactly(
            Instant.parse("2026-11-13T00:00:00Z"),
            Instant.parse("2026-11-11T00:00:00Z"),
            Instant.parse("2026-11-08T00:00:00Z"));
    Cup first = s.recent().get(0);
    assertThat(first.id()).isNotNull();
    assertThat(first.actualDoseG()).isEqualByComparingTo("16.0");
    assertThat(first.actualWaterG()).isEqualByComparingTo("250.0");
    assertThat(first.brewRatio()).isEqualByComparingTo("15.6");
    assertThat(first.rating()).isEqualByComparingTo("4.0");
  }

  @Test
  @DisplayName("AC-BEANDETAIL-19 · 기록이 없으면 0과 빈 값이다")
  void 기록이_없으면_0과_빈_값이다() {
    BeanSummary s = service.beanSummary(me, product("요약 없음"), null);

    assertThat(s.brewCount()).isZero();
    assertThat(s.ratedCount()).isZero();
    assertThat(s.averageRating()).isNull();
    assertThat(s.frequentRatio()).isNull();
    assertThat(s.recent()).isEmpty();
  }
}
