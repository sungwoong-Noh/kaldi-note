package com.kaldinote.brewlog.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import com.kaldinote.AbstractIntegrationTest;
import com.kaldinote.brewlog.domain.BrewLog;
import com.kaldinote.catalog.domain.BeanMix;
import com.kaldinote.catalog.domain.BeanProduct;
import com.kaldinote.catalog.domain.RoastLevel;
import com.kaldinote.catalog.domain.Roaster;
import com.kaldinote.catalog.infrastructure.BeanProductRepository;
import com.kaldinote.catalog.infrastructure.RoasterRepository;
import com.kaldinote.gear.domain.UserGrinder;
import com.kaldinote.gear.infrastructure.GrinderModelRepository;
import com.kaldinote.gear.infrastructure.UserGrinderRepository;
import com.kaldinote.inventory.domain.BeanBatch;
import com.kaldinote.inventory.infrastructure.BeanBatchRepository;
import com.kaldinote.recipe.domain.GrindSettingUnit;
import com.kaldinote.recipe.domain.Recipe;
import com.kaldinote.recipe.domain.RecipeVisibility;
import com.kaldinote.recipe.infrastructure.RecipeRepository;
import com.kaldinote.user.domain.User;
import com.kaldinote.user.infrastructure.UserRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class BrewLogRepositoryTest extends AbstractIntegrationTest {

  @Autowired private BrewLogRepository brewLogRepository;
  @Autowired private UserRepository userRepository;
  @Autowired private RecipeRepository recipeRepository;
  @Autowired private RoasterRepository roasterRepository;
  @Autowired private BeanProductRepository beanProductRepository;
  @Autowired private BeanBatchRepository beanBatchRepository;
  @Autowired private UserGrinderRepository userGrinderRepository;
  @Autowired private GrinderModelRepository grinderModelRepository;

  /** brew_logs의 FK 4개가 전부 NOT NULL이라 실제로 존재하는 로우를 먼저 만들어야 한다. */
  private record Fixture(Long userId, Long recipeId, Long beanBatchId, Long userGrinderId) {}

  private Fixture fixture() {
    Long userId = userRepository.save(User.create(null, "브루로그테스터", null)).getId();

    Long recipeId =
        recipeRepository
            .save(
                Recipe.create(
                    userId,
                    "테스트 레시피",
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
                    null))
            .getId();

    Long roasterId =
        roasterRepository.save(Roaster.createByUser("테스트로스터", null, null, userId)).getId();
    Long beanProductId =
        beanProductRepository
            .save(
                BeanProduct.createByUser(
                    roasterId,
                    "테스트원두",
                    BeanMix.SINGLE_ORIGIN,
                    RoastLevel.LIGHT,
                    null,
                    null,
                    false,
                    null,
                    null,
                    userId))
            .getId();
    Long beanBatchId =
        beanBatchRepository
            .save(
                BeanBatch.create(
                    userId,
                    beanProductId,
                    LocalDate.of(2026, 8, 11),
                    null,
                    new BigDecimal("200.0"),
                    null,
                    null))
            .getId();

    Long grinderModelId =
        grinderModelRepository.findByBrandAndName("Comandante", "C40 MK4").orElseThrow().getId();
    Long userGrinderId =
        userGrinderRepository.save(UserGrinder.of(userId, grinderModelId, "내 C40")).getId();

    return new Fixture(userId, recipeId, beanBatchId, userGrinderId);
  }

  @Test
  void 브루잉_로그를_저장하고_조회한다() {
    Fixture f = fixture();

    BrewLog log =
        BrewLog.create(
            f.userId(),
            f.recipeId(),
            f.beanBatchId(),
            Instant.parse("2026-08-17T08:30:00Z"),
            new BigDecimal("15.0"),
            new BigDecimal("250.0"),
            new BigDecimal("92.0"),
            210,
            180,
            f.userGrinderId(),
            new BigDecimal("22.0"),
            new BigDecimal("660"),
            new BigDecimal("240.0"),
            new BigDecimal("1.25"),
            6,
            "IDEAL",
            new BigDecimal("4.5"),
            (short) 4,
            (short) 3,
            (short) 3,
            (short) 2,
            (short) 4,
            "테스트 노트");

    BrewLog saved = brewLogRepository.save(log);

    BrewLog found = brewLogRepository.findById(saved.getId()).orElseThrow();
    assertThat(found.getActualDoseG()).isEqualByComparingTo("15.0");
    assertThat(found.getTdsPercent()).isEqualByComparingTo("1.25");
    assertThat(found.getDaysOffRoast()).isEqualTo(6);
    assertThat(found.getDegassingStatus()).isEqualTo("IDEAL");
  }

  @Test
  void 소유자만_isOwnedBy로_참이_된다() {
    Fixture f = fixture();
    Long otherUserId = userRepository.save(User.create(null, "다른사람", null)).getId();

    BrewLog log =
        BrewLog.create(
            f.userId(),
            f.recipeId(),
            f.beanBatchId(),
            Instant.parse("2026-08-17T08:30:00Z"),
            new BigDecimal("15.0"),
            new BigDecimal("250.0"),
            new BigDecimal("92.0"),
            null,
            null,
            f.userGrinderId(),
            new BigDecimal("22.0"),
            null,
            null,
            null,
            6,
            "IDEAL",
            null,
            null,
            null,
            null,
            null,
            null,
            null);

    BrewLog saved = brewLogRepository.save(log);

    assertThat(saved.isOwnedBy(f.userId())).isTrue();
    assertThat(saved.isOwnedBy(otherUserId)).isFalse();
  }

  @Test
  void 관능_평가와_측정값이_없어도_저장된다() {
    Fixture f = fixture();

    BrewLog log =
        BrewLog.create(
            f.userId(),
            f.recipeId(),
            f.beanBatchId(),
            Instant.parse("2026-08-17T08:30:00Z"),
            new BigDecimal("15.0"),
            new BigDecimal("250.0"),
            new BigDecimal("92.0"),
            null,
            null,
            f.userGrinderId(),
            new BigDecimal("22.0"),
            null,
            null,
            null,
            2,
            "TOO_FRESH",
            null,
            null,
            null,
            null,
            null,
            null,
            null);

    BrewLog found = brewLogRepository.findById(brewLogRepository.save(log).getId()).orElseThrow();

    assertThat(found.getBeverageWeightG()).isNull();
    assertThat(found.getTdsPercent()).isNull();
    assertThat(found.getRating()).isNull();
    assertThat(found.getDegassingStatus()).isEqualTo("TOO_FRESH");
  }
}
