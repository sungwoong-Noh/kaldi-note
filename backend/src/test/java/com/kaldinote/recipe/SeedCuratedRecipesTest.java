package com.kaldinote.recipe;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.kaldinote.AbstractIntegrationTest;
import com.kaldinote.auth.infrastructure.jwt.JwtTokenProvider;
import com.kaldinote.recipe.domain.Recipe;
import com.kaldinote.recipe.domain.RecipeSourceType;
import com.kaldinote.recipe.domain.RecipeStep;
import com.kaldinote.recipe.domain.RecipeVisibility;
import com.kaldinote.recipe.domain.StepType;
import com.kaldinote.recipe.infrastructure.RecipeRepository;
import com.kaldinote.user.domain.User;
import com.kaldinote.user.infrastructure.UserRepository;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.transaction.annotation.Transactional;

/**
 * 시드 CURATED 레시피 검증.
 *
 * <p>test 프로파일의 Flyway는 db/seed를 읽지 않으므로(application-test.yml) 여기서 @Sql로 직접 적용한다. 운영에 나가는 파일과 여기서
 * 실행하는 파일이 같은 파일이다 — CI가 이 SQL의 오타를 잡는 유일한 지점이다.
 */
@Sql("/db/seed/V11__seed_curated_recipes.sql")
@Transactional
class SeedCuratedRecipesTest extends AbstractIntegrationTest {

  private static final String HOFFMANN = "James Hoffmann Ultimate V60";
  private static final String KASUYA = "Tetsu Kasuya 4:6 Method";

  @Autowired private RecipeRepository recipeRepository;
  @Autowired private JdbcTemplate jdbcTemplate;
  @Autowired private JwtTokenProvider tokenProvider;
  @Autowired private UserRepository userRepository;

  /** 레시피를 하나도 만들지 않은 신규 사용자. */
  private User newUser(String nickname) {
    return userRepository.save(User.create(null, nickname, null));
  }

  private String tokenOf(User user) {
    return "Bearer " + tokenProvider.createAccessToken(user.getId(), user.getRole());
  }

  private Recipe seed(String title) {
    List<Recipe> found =
        recipeRepository.findAll().stream().filter(r -> title.equals(r.getTitle())).toList();
    assertThat(found).hasSize(1);
    return found.get(0);
  }

  @Test
  @DisplayName("AC-SEED-01 · Hoffmann 레시피의 추출 파라미터가 정확하다")
  void Hoffmann_추출_파라미터가_정확하다() {
    Recipe r = seed(HOFFMANN);

    assertThat(r.getDoseG()).isEqualByComparingTo("30.0");
    assertThat(r.getWaterG()).isEqualByComparingTo("500.0");
    assertThat(r.getWaterTempC()).isEqualByComparingTo("100.0");
    assertThat(r.getTotalTimeSeconds()).isEqualTo(210);
  }

  @Test
  @DisplayName("AC-SEED-02 · Hoffmann 스텝 7개가 표와 일치한다")
  void Hoffmann_스텝_7개가_표와_일치한다() {
    List<RecipeStep> steps = seed(HOFFMANN).getSteps();

    assertThat(steps).hasSize(7);
    assertStep(steps.get(0), 1, StepType.BLOOM, 0, 15, "60.0");
    assertStep(steps.get(1), 2, StepType.WAIT, 15, 30, null);
    assertStep(steps.get(2), 3, StepType.POUR, 45, 30, "240.0");
    assertStep(steps.get(3), 4, StepType.POUR, 75, 30, "200.0");
    assertStep(steps.get(4), 5, StepType.STIR, 105, 5, null);
    assertStep(steps.get(5), 6, StepType.SWIRL, 110, 5, null);
    assertStep(steps.get(6), 7, StepType.DRAWDOWN, 115, 95, null);
  }

  @Test
  @DisplayName("AC-SEED-03 · Kasuya 레시피의 추출 파라미터가 정확하다")
  void Kasuya_추출_파라미터가_정확하다() {
    Recipe r = seed(KASUYA);

    assertThat(r.getDoseG()).isEqualByComparingTo("20.0");
    assertThat(r.getWaterG()).isEqualByComparingTo("300.0");
    assertThat(r.getWaterTempC()).isEqualByComparingTo("92.0");
    assertThat(r.getTotalTimeSeconds()).isEqualTo(210);
  }

  @Test
  @DisplayName("AC-SEED-04 · Kasuya 스텝 6개가 표와 일치한다")
  void Kasuya_스텝_6개가_표와_일치한다() {
    List<RecipeStep> steps = seed(KASUYA).getSteps();

    assertThat(steps).hasSize(6);
    assertStep(steps.get(0), 1, StepType.BLOOM, 0, 10, "50.0");
    assertStep(steps.get(1), 2, StepType.POUR, 45, 10, "70.0");
    assertStep(steps.get(2), 3, StepType.POUR, 90, 10, "60.0");
    assertStep(steps.get(3), 4, StepType.POUR, 135, 10, "60.0");
    assertStep(steps.get(4), 5, StepType.POUR, 180, 10, "60.0");
    assertStep(steps.get(5), 6, StepType.DRAWDOWN, 190, 20, null);
  }

  @Test
  @DisplayName("AC-SEED-05 · 두 시드 모두 주인 없는 공개 큐레이션이다")
  void 두_시드_모두_주인_없는_공개_큐레이션이다() {
    for (String title : List.of(HOFFMANN, KASUYA)) {
      Recipe r = seed(title);
      assertThat(r.getOwnerUserId()).isNull();
      assertThat(r.getSourceType()).isEqualTo(RecipeSourceType.CURATED);
      assertThat(r.getVisibility()).isEqualTo(RecipeVisibility.PUBLIC);
      assertThat(r.getBrewMethod().name()).isEqualTo("POUR_OVER");
      assertThat(r.getDeletedAt()).isNull();
    }
  }

  @Test
  @DisplayName("AC-SEED-06 · 두 시드의 장비 FK가 Hario V60 02와 V60 표백 필터 02를 가리킨다")
  void 두_시드의_장비_FK가_올바른_행을_가리킨다() {
    for (String title : List.of(HOFFMANN, KASUYA)) {
      Recipe r = seed(title);

      assertThat(r.getBrewerId()).isNotNull();
      assertThat(r.getFilterId()).isNotNull();
      assertThat(
              jdbcTemplate.queryForObject(
                  "SELECT brand || ' ' || name FROM brewers WHERE id = ?",
                  String.class,
                  r.getBrewerId()))
          .isEqualTo("Hario V60 02");
      assertThat(
              jdbcTemplate.queryForObject(
                  "SELECT name FROM brew_filters WHERE id = ?", String.class, r.getFilterId()))
          .isEqualTo("V60 표백 필터 02");
    }
  }

  @Test
  @DisplayName("AC-SEED-07 · 두 시드의 분쇄도 관련 4개 컬럼이 모두 NULL이다")
  void 두_시드의_분쇄도_컬럼이_전부_NULL이다() {
    for (String title : List.of(HOFFMANN, KASUYA)) {
      Recipe r = seed(title);
      assertThat(r.getGrinderModelId()).isNull();
      assertThat(r.getGrindSettingValue()).isNull();
      assertThat(r.getGrindSettingUnit()).isNull();
      assertThat(r.getGrindMicronEstimated()).isNull();
    }
  }

  @Test
  @DisplayName("AC-SEED-08 · 두 시드 모두 붓는 스텝 물량 합계가 레시피 총 물량과 같다")
  void 붓는_스텝_합계가_총_물량과_같다() {
    for (String title : List.of(HOFFMANN, KASUYA)) {
      Recipe r = seed(title);
      BigDecimal poured =
          r.getSteps().stream()
              .filter(s -> s.getStepType() == StepType.BLOOM || s.getStepType() == StepType.POUR)
              .map(RecipeStep::getWaterG)
              .reduce(BigDecimal.ZERO, BigDecimal::add);

      assertThat(poured).isEqualByComparingTo(r.getWaterG());
    }
  }

  @Test
  @DisplayName("AC-SEED-09 · 두 시드 모두 출처 표기를 갖는다")
  void 두_시드_모두_출처_표기를_갖는다() {
    assertThat(seed(HOFFMANN).getAuthorName()).isEqualTo("James Hoffmann");
    assertThat(seed(KASUYA).getAuthorName()).isEqualTo("Tetsu Kasuya");

    for (String title : List.of(HOFFMANN, KASUYA)) {
      assertThat(seed(title).getSourceUrl()).isNotNull().startsWith("https://");
    }
  }

  @Test
  @DisplayName("AC-SEED-10 · 레시피가 없는 신규 사용자의 목록에 시드 2건이 보인다")
  void 신규_사용자_목록에_시드_2건이_보인다() throws Exception {
    mockMvc
        .perform(
            get("/api/v1/recipes").header(HttpHeaders.AUTHORIZATION, tokenOf(newUser("신규가입자"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(2))
        .andExpect(jsonPath("$.content[*].title", hasItem(HOFFMANN)))
        .andExpect(jsonPath("$.content[*].title", hasItem(KASUYA)));
  }

  @Test
  @DisplayName("AC-SEED-11 · 시드 레시피 단건 조회의 비율이 정확하다")
  void 시드_레시피의_비율이_정확하다() throws Exception {
    String token = tokenOf(newUser("비율보는사람"));

    mockMvc
        .perform(
            get("/api/v1/recipes/{id}", seed(HOFFMANN).getId())
                .header(HttpHeaders.AUTHORIZATION, token))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.ratio").value(16.7));

    mockMvc
        .perform(
            get("/api/v1/recipes/{id}", seed(KASUYA).getId())
                .header(HttpHeaders.AUTHORIZATION, token))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.ratio").value(15.0));
  }

  @Test
  @DisplayName("AC-SEED-12 · 신규 사용자가 시드를 포크하면 자기 레시피가 된다")
  void 신규_사용자가_시드를_포크할_수_있다() throws Exception {
    User user = newUser("포크하는사람");

    mockMvc
        .perform(
            post("/api/v1/recipes/{id}/fork", seed(KASUYA).getId())
                .header(HttpHeaders.AUTHORIZATION, tokenOf(user)))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.sourceType").value("USER"))
        .andExpect(jsonPath("$.ownerUserId").value(user.getId()))
        .andExpect(jsonPath("$.visibility").value("PRIVATE"))
        .andExpect(jsonPath("$.steps.length()").value(6));
  }

  private void assertStep(
      RecipeStep step, int order, StepType type, int startAt, int duration, String waterG) {
    assertThat(step.getStepOrder()).isEqualTo(order);
    assertThat(step.getStepType()).isEqualTo(type);
    assertThat(step.getStartAtSeconds()).isEqualTo(startAt);
    assertThat(step.getDurationSeconds()).isEqualTo(duration);
    if (waterG == null) {
      assertThat(step.getWaterG()).isNull();
    } else {
      assertThat(step.getWaterG()).isEqualByComparingTo(waterG);
    }
  }
}
