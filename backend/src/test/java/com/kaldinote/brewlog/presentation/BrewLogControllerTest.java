package com.kaldinote.brewlog.presentation;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.kaldinote.AbstractIntegrationTest;
import com.kaldinote.auth.infrastructure.jwt.JwtTokenProvider;
import com.kaldinote.gear.infrastructure.GrinderModelRepository;
import com.kaldinote.user.domain.User;
import com.kaldinote.user.infrastructure.UserRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class BrewLogControllerTest extends AbstractIntegrationTest {

  private static final Instant BREWED_AT = Instant.parse("2026-08-17T08:30:00Z");

  @Autowired private JwtTokenProvider tokenProvider;
  @Autowired private UserRepository userRepository;
  @Autowired private GrinderModelRepository grinderModelRepository;

  private String token(String nickname) {
    User user = userRepository.save(User.create(null, nickname, null));
    return "Bearer " + tokenProvider.createAccessToken(user.getId(), user.getRole());
  }

  private Long c40Id() {
    return grinderModelRepository.findByBrandAndName("Comandante", "C40 MK4").orElseThrow().getId();
  }

  private Long wilfaId() {
    return grinderModelRepository.findByBrandAndName("Wilfa", "Uniform").orElseThrow().getId();
  }

  private Long createdId(ResultActions actions) throws Exception {
    String body = actions.andReturn().getResponse().getContentAsString();
    return Long.valueOf(JsonPath.read(body, "$.id").toString());
  }

  private Long userGrinderId(String token, Long grinderModelId) throws Exception {
    return createdId(
        mockMvc.perform(
            post("/api/v1/gear/user-grinders")
                .header(HttpHeaders.AUTHORIZATION, token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"grinderModelId":%d,"nickname":"내 그라인더"}
                    """
                        .formatted(grinderModelId))));
  }

  private Long recipeId(String token) throws Exception {
    return createdId(
        mockMvc.perform(
            post("/api/v1/recipes")
                .header(HttpHeaders.AUTHORIZATION, token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"title":"브루잉 로그 테스트용","doseG":15.0,"waterG":250.0}
                    """)));
  }

  private Long roasterId(String token) throws Exception {
    return createdId(
        mockMvc.perform(
            post("/api/v1/roasters")
                .header(HttpHeaders.AUTHORIZATION, token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"name":"브루잉로그테스트로스터-%s"}
                    """
                        .formatted(UUID.randomUUID()))));
  }

  private Long beanProductId(String token) throws Exception {
    return createdId(
        mockMvc.perform(
            post("/api/v1/bean-products")
                .header(HttpHeaders.AUTHORIZATION, token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"roasterId":%d,"name":"브루잉로그테스트상품-%s","beanMix":"SINGLE_ORIGIN",
                     "roastLevel":"LIGHT","origins":[{"country":"ET"}]}
                    """
                        .formatted(roasterId(token), UUID.randomUUID()))));
  }

  /** roastedAt이 brewedAt 날짜(UTC)로부터 daysAgo일 전인 재고를 만든다. */
  private Long beanBatchId(String token, Instant brewedAt, long daysAgo) throws Exception {
    LocalDate roastedAt = brewedAt.atZone(ZoneOffset.UTC).toLocalDate().minusDays(daysAgo);
    return createdId(
        mockMvc.perform(
            post("/api/v1/bean-batches")
                .header(HttpHeaders.AUTHORIZATION, token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"beanProductId":%d,"weightG":200.0,"roastedAt":"%s"}
                    """
                        .formatted(beanProductId(token), roastedAt))));
  }

  private String minimalBody(
      Long recipeId, Long beanBatchId, Instant brewedAt, Long userGrinderId) {
    return """
        {"recipeId":%d,"beanBatchId":%d,"brewedAt":"%s",
         "actualDoseG":15.0,"actualWaterG":250.0,"actualWaterTempC":92.0,
         "userGrinderId":%d,"actualGrindSettingValue":22.0}
        """
        .formatted(recipeId, beanBatchId, brewedAt, userGrinderId);
  }

  private ResultActions createBrewLog(String token, String body) throws Exception {
    return mockMvc.perform(
        post("/api/v1/brew-logs")
            .header(HttpHeaders.AUTHORIZATION, token)
            .contentType(MediaType.APPLICATION_JSON)
            .content(body));
  }

  @Test
  @DisplayName("AC-BREW-01 · 필수 값만으로 브루잉 로그가 생성된다")
  void 필수_값만으로_생성된다() throws Exception {
    String token = token("테스터");
    Long recipeId = recipeId(token);
    Long beanBatchId = beanBatchId(token, BREWED_AT, 6);
    Long userGrinderId = userGrinderId(token, c40Id());

    createBrewLog(token, minimalBody(recipeId, beanBatchId, BREWED_AT, userGrinderId))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.visibility").value("PRIVATE"))
        .andExpect(jsonPath("$.actualGrindMicronEstimated").value(660))
        .andExpect(jsonPath("$.beverageWeightG").doesNotExist())
        .andExpect(jsonPath("$.rating").doesNotExist());
  }

  @Test
  @DisplayName("AC-BREW-02 · 음료 중량과 TDS가 있으면 EY/구간이 함께 반환된다")
  void 음료중량과_TDS가_있으면_EY가_반환된다() throws Exception {
    String token = token("테스터");
    Long recipeId = recipeId(token);
    Long beanBatchId = beanBatchId(token, BREWED_AT, 6);
    Long userGrinderId = userGrinderId(token, c40Id());

    createBrewLog(
            token,
            """
            {"recipeId":%d,"beanBatchId":%d,"brewedAt":"%s",
             "actualDoseG":15.0,"actualWaterG":250.0,"actualWaterTempC":92.0,
             "userGrinderId":%d,"actualGrindSettingValue":22.0,
             "beverageWeightG":240.0,"tdsPercent":1.25}
            """
                .formatted(recipeId, beanBatchId, BREWED_AT, userGrinderId))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.extractionYieldPercent").value(20.0))
        .andExpect(jsonPath("$.strengthZone").value("IDEAL"))
        .andExpect(jsonPath("$.extractionZone").value("IDEAL"))
        .andExpect(jsonPath("$.diagnosis").value(containsString("이상적")));
  }

  @Test
  @DisplayName("AC-BREW-03 · TDS가 없으면 수율과 구간이 모두 null이다")
  void TDS가_없으면_수율과_구간이_null이다() throws Exception {
    String token = token("테스터");
    Long recipeId = recipeId(token);
    Long beanBatchId = beanBatchId(token, BREWED_AT, 6);
    Long userGrinderId = userGrinderId(token, c40Id());

    createBrewLog(
            token,
            """
            {"recipeId":%d,"beanBatchId":%d,"brewedAt":"%s",
             "actualDoseG":15.0,"actualWaterG":250.0,"actualWaterTempC":92.0,
             "userGrinderId":%d,"actualGrindSettingValue":22.0,
             "beverageWeightG":240.0}
            """
                .formatted(recipeId, beanBatchId, BREWED_AT, userGrinderId))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.extractionYieldPercent").doesNotExist())
        .andExpect(jsonPath("$.strengthZone").doesNotExist())
        .andExpect(jsonPath("$.extractionZone").doesNotExist())
        .andExpect(jsonPath("$.diagnosis").value(containsString("TDS")));
  }

  @Test
  @DisplayName("AC-BREW-04 · 무단계 그라인더를 쓰면 마이크론 추정치만 null이고 생성은 성공한다")
  void 무단계_그라인더는_추정치만_null이다() throws Exception {
    String token = token("테스터");
    Long recipeId = recipeId(token);
    Long beanBatchId = beanBatchId(token, BREWED_AT, 6);
    Long userGrinderId = userGrinderId(token, wilfaId());

    createBrewLog(token, minimalBody(recipeId, beanBatchId, BREWED_AT, userGrinderId))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.actualGrindMicronEstimated").doesNotExist());
  }

  @Test
  @DisplayName("AC-BREW-05 · daysOffRoast와 degassingStatus는 brewedAt 기준으로 생성 시점에 계산된다")
  void daysOffRoast는_brewedAt_기준으로_계산된다() throws Exception {
    String token = token("테스터");
    Long recipeId = recipeId(token);
    Long beanBatchId = beanBatchId(token, BREWED_AT, 6);
    Long userGrinderId = userGrinderId(token, c40Id());

    createBrewLog(token, minimalBody(recipeId, beanBatchId, BREWED_AT, userGrinderId))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.daysOffRoast").value(6))
        .andExpect(jsonPath("$.degassingStatus").value("IDEAL"));
  }

  @Test
  @DisplayName("AC-BREW-09 · 관능 평가 필드를 전부 생략해도 생성된다")
  void 관능_평가를_전부_생략해도_생성된다() throws Exception {
    String token = token("테스터");
    Long recipeId = recipeId(token);
    Long beanBatchId = beanBatchId(token, BREWED_AT, 6);
    Long userGrinderId = userGrinderId(token, c40Id());

    createBrewLog(token, minimalBody(recipeId, beanBatchId, BREWED_AT, userGrinderId))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.rating").doesNotExist())
        .andExpect(jsonPath("$.acidity").doesNotExist())
        .andExpect(jsonPath("$.overallNote").doesNotExist());
  }

  @Test
  @DisplayName("AC-BREW-30 · 인증 없이 생성할 수 없다")
  void 인증_없이_생성할_수_없다() throws Exception {
    mockMvc
        .perform(
            post("/api/v1/brew-logs")
                .contentType(MediaType.APPLICATION_JSON)
                .content(minimalBody(1L, 1L, BREWED_AT, 1L)))
        .andExpect(status().isUnauthorized());
  }

  @Test
  @DisplayName("AC-BREW-31 · 존재하지 않는 recipeId는 404다")
  void 존재하지_않는_recipeId는_404다() throws Exception {
    String token = token("테스터");
    Long beanBatchId = beanBatchId(token, BREWED_AT, 6);
    Long userGrinderId = userGrinderId(token, c40Id());

    createBrewLog(token, minimalBody(999999L, beanBatchId, BREWED_AT, userGrinderId))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  @DisplayName("AC-BREW-32 · 남의 레시피를 가리키면 403이다")
  void 남의_레시피를_가리키면_403이다() throws Exception {
    String owner = token("소유자");
    Long othersRecipeId = recipeId(owner);

    String requester = token("요청자");
    Long beanBatchId = beanBatchId(requester, BREWED_AT, 6);
    Long userGrinderId = userGrinderId(requester, c40Id());

    createBrewLog(requester, minimalBody(othersRecipeId, beanBatchId, BREWED_AT, userGrinderId))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }

  @Test
  @DisplayName("AC-BREW-33 · 존재하지 않는 beanBatchId는 404다")
  void 존재하지_않는_beanBatchId는_404다() throws Exception {
    String token = token("테스터");
    Long recipeId = recipeId(token);
    Long userGrinderId = userGrinderId(token, c40Id());

    createBrewLog(token, minimalBody(recipeId, 999999L, BREWED_AT, userGrinderId))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  @DisplayName("AC-BREW-34 · 남의 재고를 가리키면 403이다")
  void 남의_재고를_가리키면_403이다() throws Exception {
    String owner = token("소유자");
    Long othersBeanBatchId = beanBatchId(owner, BREWED_AT, 6);

    String requester = token("요청자");
    Long recipeId = recipeId(requester);
    Long userGrinderId = userGrinderId(requester, c40Id());

    createBrewLog(requester, minimalBody(recipeId, othersBeanBatchId, BREWED_AT, userGrinderId))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }

  @Test
  @DisplayName("AC-BREW-35 · 존재하지 않는 userGrinderId는 404다")
  void 존재하지_않는_userGrinderId는_404다() throws Exception {
    String token = token("테스터");
    Long recipeId = recipeId(token);
    Long beanBatchId = beanBatchId(token, BREWED_AT, 6);

    createBrewLog(token, minimalBody(recipeId, beanBatchId, BREWED_AT, 999999L))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  @DisplayName("AC-BREW-36 · 남의 그라인더를 가리키면 403이다")
  void 남의_그라인더를_가리키면_403이다() throws Exception {
    String owner = token("소유자");
    Long othersUserGrinderId = userGrinderId(owner, c40Id());

    String requester = token("요청자");
    Long recipeId = recipeId(requester);
    Long beanBatchId = beanBatchId(requester, BREWED_AT, 6);

    createBrewLog(requester, minimalBody(recipeId, beanBatchId, BREWED_AT, othersUserGrinderId))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }
}
