package com.kaldinote.brewlog.presentation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.everyItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.kaldinote.AbstractIntegrationTest;
import com.kaldinote.auth.infrastructure.jwt.JwtTokenProvider;
import com.kaldinote.brewlog.infrastructure.BrewLogRepository;
import com.kaldinote.gear.infrastructure.GrinderModelRepository;
import com.kaldinote.user.domain.User;
import com.kaldinote.user.infrastructure.UserRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
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

  /**
   * 추출 시각. {@code @PastOrPresent}가 걸려 있으므로 고정 리터럴을 쓰면 실행 시각에 따라 미래가 되어 거부된다. 실행 시점 기준 한 시간 전으로 잡아
   * 언제 돌려도 과거가 되게 한다.
   */
  private static final Instant BREWED_AT =
      Instant.now().minus(1, ChronoUnit.HOURS).truncatedTo(ChronoUnit.SECONDS);

  @Autowired private JwtTokenProvider tokenProvider;
  @Autowired private UserRepository userRepository;
  @Autowired private GrinderModelRepository grinderModelRepository;
  @Autowired private BrewLogRepository brewLogRepository;

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

  /** 필수 필드에 {@code extraJson}을 덧붙인 본문. 경계값 테스트가 필드 하나만 바꿔가며 쓴다. */
  private String bodyWith(
      Long recipeId, Long beanBatchId, Instant brewedAt, Long userGrinderId, String extraJson) {
    return """
        {"recipeId":%d,"beanBatchId":%d,"brewedAt":"%s",
         "actualDoseG":15.0,"actualWaterG":250.0,"actualWaterTempC":92.0,
         "userGrinderId":%d,"actualGrindSettingValue":22.0,%s}
        """
        .formatted(recipeId, beanBatchId, brewedAt, userGrinderId, extraJson);
  }

  private ResultActions createBrewLog(String token, String body) throws Exception {
    return mockMvc.perform(
        post("/api/v1/brew-logs")
            .header(HttpHeaders.AUTHORIZATION, token)
            .contentType(MediaType.APPLICATION_JSON)
            .content(body));
  }

  /** 기본 픽스처(경과 6일)를 만들고 extraJson만 덧붙여 생성을 시도한다. */
  private ResultActions createWith(String token, String extraJson) throws Exception {
    Long recipeId = recipeId(token);
    Long beanBatchId = beanBatchId(token, BREWED_AT, 6);
    Long userGrinderId = userGrinderId(token, c40Id());
    return createBrewLog(
        token, bodyWith(recipeId, beanBatchId, BREWED_AT, userGrinderId, extraJson));
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

  @Test
  @DisplayName("AC-BREW-10 · rating 0.5는 허용된다")
  void rating_0_5는_허용된다() throws Exception {
    createWith(token("테스터"), "\"rating\":0.5").andExpect(status().isCreated());
  }

  @Test
  @DisplayName("AC-BREW-11 · rating 5.0은 허용된다")
  void rating_5_0은_허용된다() throws Exception {
    createWith(token("테스터"), "\"rating\":5.0").andExpect(status().isCreated());
  }

  @Test
  @DisplayName("AC-BREW-12 · rating 0.4는 거부된다")
  void rating_0_4는_거부된다() throws Exception {
    createWith(token("테스터"), "\"rating\":0.4")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  @DisplayName("AC-BREW-13 · rating 5.1은 거부된다")
  void rating_5_1은_거부된다() throws Exception {
    createWith(token("테스터"), "\"rating\":5.1")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  @DisplayName("AC-BREW-14 · rating이 0.5의 배수가 아니면 거부된다")
  void rating이_0_5_배수가_아니면_거부된다() throws Exception {
    createWith(token("테스터"), "\"rating\":3.3")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  @DisplayName("AC-BREW-15 · acidity 1은 허용된다")
  void acidity_1은_허용된다() throws Exception {
    createWith(token("테스터"), "\"acidity\":1").andExpect(status().isCreated());
  }

  @Test
  @DisplayName("AC-BREW-16 · acidity 5는 허용된다")
  void acidity_5는_허용된다() throws Exception {
    createWith(token("테스터"), "\"acidity\":5").andExpect(status().isCreated());
  }

  @Test
  @DisplayName("AC-BREW-17 · acidity 0은 거부된다")
  void acidity_0은_거부된다() throws Exception {
    createWith(token("테스터"), "\"acidity\":0")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  @DisplayName("AC-BREW-18 · acidity 6은 거부된다")
  void acidity_6은_거부된다() throws Exception {
    createWith(token("테스터"), "\"acidity\":6")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  /** 경과일 경계 4개는 재고의 roastedAt만 바꿔 확인한다. */
  private ResultActions createWithDaysOffRoast(String token, long daysAgo) throws Exception {
    Long recipeId = recipeId(token);
    Long beanBatchId = beanBatchId(token, BREWED_AT, daysAgo);
    Long userGrinderId = userGrinderId(token, c40Id());
    return createBrewLog(token, minimalBody(recipeId, beanBatchId, BREWED_AT, userGrinderId));
  }

  @Test
  @DisplayName("AC-BREW-19 · 경과 2일은 TOO_FRESH다")
  void 경과_2일은_TOO_FRESH다() throws Exception {
    createWithDaysOffRoast(token("테스터"), 2)
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.daysOffRoast").value(2))
        .andExpect(jsonPath("$.degassingStatus").value("TOO_FRESH"));
  }

  @Test
  @DisplayName("AC-BREW-20 · 경과 3일은 IDEAL이다")
  void 경과_3일은_IDEAL이다() throws Exception {
    createWithDaysOffRoast(token("테스터"), 3)
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.daysOffRoast").value(3))
        .andExpect(jsonPath("$.degassingStatus").value("IDEAL"));
  }

  @Test
  @DisplayName("AC-BREW-21 · 경과 14일은 IDEAL이다")
  void 경과_14일은_IDEAL이다() throws Exception {
    createWithDaysOffRoast(token("테스터"), 14)
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.daysOffRoast").value(14))
        .andExpect(jsonPath("$.degassingStatus").value("IDEAL"));
  }

  @Test
  @DisplayName("AC-BREW-22 · 경과 15일은 PAST_PEAK이다")
  void 경과_15일은_PAST_PEAK이다() throws Exception {
    createWithDaysOffRoast(token("테스터"), 15)
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.daysOffRoast").value(15))
        .andExpect(jsonPath("$.degassingStatus").value("PAST_PEAK"));
  }

  @Test
  @DisplayName("AC-BREW-23 · 음료 중량이 실측 물량과 같으면 허용된다")
  void 음료중량이_물량과_같으면_허용된다() throws Exception {
    createWith(token("테스터"), "\"beverageWeightG\":250.0,\"tdsPercent\":1.25")
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.extractionYieldPercent").value(20.8));
  }

  @Test
  @DisplayName("AC-BREW-24 · 음료 중량이 실측 물량보다 많으면 거부된다")
  void 음료중량이_물량보다_많으면_거부된다() throws Exception {
    createWith(token("테스터"), "\"beverageWeightG\":250.1,\"tdsPercent\":1.25")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_BREW_MEASUREMENT"));
  }

  /** 수율 경계는 물량을 300으로 키워야 음료 중량 250 이상을 넣을 수 있다. */
  private ResultActions createForYield(String token, String beverageWeightG) throws Exception {
    Long recipeId = recipeId(token);
    Long beanBatchId = beanBatchId(token, BREWED_AT, 6);
    Long userGrinderId = userGrinderId(token, c40Id());
    return createBrewLog(
        token,
        """
        {"recipeId":%d,"beanBatchId":%d,"brewedAt":"%s",
         "actualDoseG":15.0,"actualWaterG":300.0,"actualWaterTempC":92.0,
         "userGrinderId":%d,"actualGrindSettingValue":22.0,
         "beverageWeightG":%s,"tdsPercent":1.8}
        """
            .formatted(recipeId, beanBatchId, BREWED_AT, userGrinderId, beverageWeightG));
  }

  @Test
  @DisplayName("AC-BREW-25 · 수율 30.0은 허용된다")
  void 수율_30_0은_허용된다() throws Exception {
    createForYield(token("테스터"), "250.0")
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.extractionYieldPercent").value(30.0));
  }

  @Test
  @DisplayName("AC-BREW-26 · 수율이 30.0을 넘으면 거부된다")
  void 수율이_30을_넘으면_거부된다() throws Exception {
    createForYield(token("테스터"), "251.0")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_BREW_MEASUREMENT"));
  }

  @Test
  @DisplayName("AC-BREW-27 · overallNote 1000자는 허용된다")
  void overallNote_1000자는_허용된다() throws Exception {
    createWith(token("테스터"), "\"overallNote\":\"%s\"".formatted("가".repeat(1000)))
        .andExpect(status().isCreated());
  }

  @Test
  @DisplayName("AC-BREW-28 · overallNote 1001자는 거부된다")
  void overallNote_1001자는_거부된다() throws Exception {
    createWith(token("테스터"), "\"overallNote\":\"%s\"".formatted("가".repeat(1001)))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  @DisplayName("AC-BREW-37 · brewedAt이 미래 시각이면 거부된다")
  void brewedAt이_미래면_거부된다() throws Exception {
    String token = token("테스터");
    Long recipeId = recipeId(token);
    Long beanBatchId = beanBatchId(token, Instant.now(), 6);
    Long userGrinderId = userGrinderId(token, c40Id());

    createBrewLog(
            token,
            minimalBody(recipeId, beanBatchId, Instant.now().plusSeconds(86400), userGrinderId))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  @DisplayName("AC-BREW-38 · actualDoseG가 0 이하면 거부된다")
  void actualDoseG가_0이면_거부된다() throws Exception {
    String token = token("테스터");
    Long recipeId = recipeId(token);
    Long beanBatchId = beanBatchId(token, BREWED_AT, 6);
    Long userGrinderId = userGrinderId(token, c40Id());

    createBrewLog(
            token,
            """
            {"recipeId":%d,"beanBatchId":%d,"brewedAt":"%s",
             "actualDoseG":0,"actualWaterG":250.0,"actualWaterTempC":92.0,
             "userGrinderId":%d,"actualGrindSettingValue":22.0}
            """
                .formatted(recipeId, beanBatchId, BREWED_AT, userGrinderId))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  private ResultActions getBrewLog(String token, Long id) throws Exception {
    return mockMvc.perform(get("/api/v1/brew-logs/" + id).header(HttpHeaders.AUTHORIZATION, token));
  }

  @Test
  @DisplayName("AC-BREW-06 · 단건 조회는 저장된 값과 재계산된 EY/SCA를 함께 반환한다")
  void 단건_조회는_저장값과_EY를_함께_반환한다() throws Exception {
    String token = token("테스터");
    Long id = createdId(createWith(token, "\"beverageWeightG\":240.0,\"tdsPercent\":1.25"));

    getBrewLog(token, id)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.actualDoseG").value(15.0))
        .andExpect(jsonPath("$.extractionYieldPercent").value(20.0))
        .andExpect(jsonPath("$.strengthZone").value("IDEAL"))
        .andExpect(jsonPath("$.extractionZone").value("IDEAL"));
  }

  @Test
  @DisplayName("AC-BREW-07 · 레시피의 doseG를 나중에 수정해도 기존 브루잉 로그의 actualDoseG는 변하지 않는다")
  void 레시피를_수정해도_스냅샷은_불변이다() throws Exception {
    String token = token("테스터");
    Long recipeId = recipeId(token);
    Long beanBatchId = beanBatchId(token, BREWED_AT, 6);
    Long userGrinderId = userGrinderId(token, c40Id());
    Long id =
        createdId(
            createBrewLog(token, minimalBody(recipeId, beanBatchId, BREWED_AT, userGrinderId)));

    mockMvc
        .perform(
            put("/api/v1/recipes/" + recipeId)
                .header(HttpHeaders.AUTHORIZATION, token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"title":"수정됨","doseG":20.0,"waterG":250.0}
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.doseG").value(20.0));

    getBrewLog(token, id)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.actualDoseG").value(15.0));
  }

  @Test
  @DisplayName("AC-BREW-08 · BeanBatch를 삭제해도 daysOffRoast·degassingStatus는 남는다")
  void 재고를_삭제해도_daysOffRoast는_남는다() throws Exception {
    String token = token("테스터");
    Long recipeId = recipeId(token);
    Long beanBatchId = beanBatchId(token, BREWED_AT, 6);
    Long userGrinderId = userGrinderId(token, c40Id());
    Long id =
        createdId(
            createBrewLog(token, minimalBody(recipeId, beanBatchId, BREWED_AT, userGrinderId)));

    mockMvc
        .perform(
            delete("/api/v1/bean-batches/" + beanBatchId).header(HttpHeaders.AUTHORIZATION, token))
        .andExpect(status().isNoContent());

    getBrewLog(token, id)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.daysOffRoast").value(6))
        .andExpect(jsonPath("$.degassingStatus").value("IDEAL"));
  }

  @Test
  @DisplayName("AC-BREW-39 · 존재하지 않는 브루잉 로그 조회는 404다")
  void 존재하지_않는_브루잉_로그_조회는_404다() throws Exception {
    getBrewLog(token("테스터"), 999999L)
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  @DisplayName("AC-BREW-40 · 남의 브루잉 로그는 조회할 수 없다")
  void 남의_브루잉_로그는_조회할_수_없다() throws Exception {
    String owner = token("소유자");
    Long recipeId = recipeId(owner);
    Long beanBatchId = beanBatchId(owner, BREWED_AT, 6);
    Long userGrinderId = userGrinderId(owner, c40Id());
    Long id =
        createdId(
            createBrewLog(owner, minimalBody(recipeId, beanBatchId, BREWED_AT, userGrinderId)));

    getBrewLog(token("다른사람"), id)
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }

  // ===== 공개범위 인가 (AC-VIS-18~28) =====

  /** 팔로우 픽스처를 만들려면 상대의 id가 필요해 User를 그대로 돌려준다. */
  private User newUser(String nickname) {
    return userRepository.save(User.create(null, nickname, null));
  }

  private String tokenOf(User user) {
    return "Bearer " + tokenProvider.createAccessToken(user.getId(), user.getRole());
  }

  private void follow(User follower, User followee) throws Exception {
    mockMvc
        .perform(
            post("/api/v1/users/{id}/follow", followee.getId())
                .header(HttpHeaders.AUTHORIZATION, tokenOf(follower)))
        .andExpect(status().isNoContent());
  }

  private void mutualFollow(User a, User b) throws Exception {
    follow(a, b);
    follow(b, a);
  }

  /** visibility를 지정해 브루잉 로그를 만들고 id를 돌려준다. */
  private Long brewLogWith(String token, String visibility) throws Exception {
    Long recipe = recipeId(token);
    Long batch = beanBatchId(token, BREWED_AT, 6);
    Long grinder = userGrinderId(token, c40Id());
    return createdId(
        createBrewLog(
            token,
            bodyWith(
                recipe, batch, BREWED_AT, grinder, "\"visibility\":\"%s\"".formatted(visibility))));
  }

  // ---------- visibility 입력 ----------

  @Test
  @DisplayName("AC-VIS-18 · visibility를 생략하면 PRIVATE으로 저장된다")
  void visibility를_생략하면_PRIVATE이다() throws Exception {
    String token = token("vis-18");
    Long recipe = recipeId(token);
    Long batch = beanBatchId(token, BREWED_AT, 6);
    Long grinder = userGrinderId(token, c40Id());

    createBrewLog(token, minimalBody(recipe, batch, BREWED_AT, grinder))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.visibility").value("PRIVATE"));
  }

  @Test
  @DisplayName("AC-VIS-19 · visibility에 PUBLIC을 주면 그대로 저장된다")
  void visibility_PUBLIC은_그대로_저장된다() throws Exception {
    String token = token("vis-19");
    Long id = brewLogWith(token, "PUBLIC");

    getBrewLog(token, id).andExpect(jsonPath("$.visibility").value("PUBLIC"));
  }

  @Test
  @DisplayName("AC-VIS-20 · visibility에 FRIENDS를 주면 그대로 저장된다")
  void visibility_FRIENDS는_그대로_저장된다() throws Exception {
    String token = token("vis-20");
    Long id = brewLogWith(token, "FRIENDS");

    getBrewLog(token, id).andExpect(jsonPath("$.visibility").value("FRIENDS"));
  }

  @Test
  @DisplayName("AC-VIS-21 · 허용값 밖의 visibility는 400이다")
  void 허용값_밖_visibility는_400이다() throws Exception {
    String token = token("vis-21");
    Long recipe = recipeId(token);
    Long batch = beanBatchId(token, BREWED_AT, 6);
    Long grinder = userGrinderId(token, c40Id());

    createBrewLog(token, bodyWith(recipe, batch, BREWED_AT, grinder, "\"visibility\":\"SECRET\""))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  // ---------- 조회 인가 ----------

  @Test
  @DisplayName("AC-VIS-22 · 소유자는 PRIVATE 로그를 본다")
  void 소유자는_PRIVATE_로그를_본다() throws Exception {
    String token = token("vis-22");
    Long id = brewLogWith(token, "PRIVATE");

    getBrewLog(token, id).andExpect(status().isOk());
  }

  @Test
  @DisplayName("AC-VIS-23 · 타인의 PRIVATE 로그는 403이다")
  void 타인의_PRIVATE_로그는_403이다() throws Exception {
    User a = newUser("vis-23a");
    User b = newUser("vis-23b");
    Long id = brewLogWith(tokenOf(a), "PRIVATE");
    mutualFollow(a, b);

    getBrewLog(tokenOf(b), id)
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }

  @Test
  @DisplayName("AC-VIS-24 · 타인은 PUBLIC 로그를 본다")
  void 타인은_PUBLIC_로그를_본다() throws Exception {
    User a = newUser("vis-24a");
    User b = newUser("vis-24b");
    Long id = brewLogWith(tokenOf(a), "PUBLIC");

    String ownerBody = getBrewLog(tokenOf(a), id).andReturn().getResponse().getContentAsString();
    // Object로 받아야 한다. var로 두면 제네릭이 Matcher로 추론돼 value(Matcher) 오버로드가 잡힌다.
    Object brewRatio = JsonPath.read(ownerBody, "$.brewRatio");
    Object daysOffRoast = JsonPath.read(ownerBody, "$.daysOffRoast");

    getBrewLog(tokenOf(b), id)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.brewRatio").value(brewRatio))
        .andExpect(jsonPath("$.daysOffRoast").value(daysOffRoast));
  }

  @Test
  @DisplayName("AC-VIS-25 · 상호 팔로우면 타인이 FRIENDS 로그를 본다")
  void 상호_팔로우면_FRIENDS_로그를_본다() throws Exception {
    User a = newUser("vis-25a");
    User b = newUser("vis-25b");
    Long id = brewLogWith(tokenOf(a), "FRIENDS");
    mutualFollow(a, b);

    getBrewLog(tokenOf(b), id).andExpect(status().isOk());
  }

  @Test
  @DisplayName("AC-VIS-26 · 단방향 팔로우면 FRIENDS 로그는 403이다")
  void 단방향_팔로우면_FRIENDS_로그는_403이다() throws Exception {
    User a = newUser("vis-26a");
    User b = newUser("vis-26b");
    Long id = brewLogWith(tokenOf(a), "FRIENDS");
    follow(b, a);

    getBrewLog(tokenOf(b), id).andExpect(status().isForbidden());
  }

  @Test
  @DisplayName("AC-VIS-27 · PRIVATE 레시피를 참조하는 PUBLIC 로그는 타인에게 200이다")
  void PRIVATE_레시피를_참조하는_PUBLIC_로그는_타인에게_200이다() throws Exception {
    User a = newUser("vis-27a");
    User b = newUser("vis-27b");
    String tokenA = tokenOf(a);

    Long recipe = recipeId(tokenA); // 기본값 PRIVATE
    Long batch = beanBatchId(tokenA, BREWED_AT, 6);
    Long grinder = userGrinderId(tokenA, c40Id());
    Long logId =
        createdId(
            createBrewLog(
                tokenA, bodyWith(recipe, batch, BREWED_AT, grinder, "\"visibility\":\"PUBLIC\"")));

    getBrewLog(tokenOf(b), logId)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.recipeId").value(recipe));

    // 같은 사람이 그 레시피를 직접 열면 여전히 막힌다 — 둘의 visibility는 독립이다
    mockMvc
        .perform(get("/api/v1/recipes/{id}", recipe).header(HttpHeaders.AUTHORIZATION, tokenOf(b)))
        .andExpect(status().isForbidden());
  }

  @Test
  @DisplayName("AC-VIS-28 · 토큰 없이 PUBLIC 로그를 조회하면 401이다")
  void 토큰_없이_PUBLIC_로그_조회는_401이다() throws Exception {
    String token = token("vis-28");
    Long id = brewLogWith(token, "PUBLIC");

    mockMvc.perform(get("/api/v1/brew-logs/{id}", id)).andExpect(status().isUnauthorized());
  }

  // ===== 소프트 삭제 (AC-BLEDIT-12·13·15·18) =====

  /** 기본 픽스처(경과 6일)로 브루잉 로그 하나를 만들고 id를 돌려준다. */
  private Long newBrewLog(String token) throws Exception {
    Long recipe = recipeId(token);
    Long batch = beanBatchId(token, BREWED_AT, 6);
    Long grinder = userGrinderId(token, c40Id());
    return createdId(createBrewLog(token, minimalBody(recipe, batch, BREWED_AT, grinder)));
  }

  private ResultActions deleteBrewLog(String token, Long id) throws Exception {
    return mockMvc.perform(
        delete("/api/v1/brew-logs/{id}", id).header(HttpHeaders.AUTHORIZATION, token));
  }

  @Test
  @DisplayName("AC-BLEDIT-12 · 삭제하면 204이고 deleted_at이 채워진다")
  void 삭제하면_204이고_deleted_at이_채워진다() throws Exception {
    String token = token("bledit-12");
    Long id = newBrewLog(token);

    deleteBrewLog(token, id).andExpect(status().isNoContent());

    assertThat(brewLogRepository.findById(id).orElseThrow().getDeletedAt()).isNotNull();
  }

  @Test
  @DisplayName("AC-BLEDIT-13 · 삭제 후 단건 조회는 404다")
  void 삭제_후_단건_조회는_404다() throws Exception {
    String token = token("bledit-13");
    Long id = newBrewLog(token);
    deleteBrewLog(token, id).andExpect(status().isNoContent());

    getBrewLog(token, id)
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  @DisplayName("AC-BLEDIT-15 · 타인의 로그는 삭제할 수 없다")
  void 타인의_로그는_삭제할_수_없다() throws Exception {
    String owner = token("bledit-15-주인");
    String other = token("bledit-15-남");
    Long id = newBrewLog(owner);

    deleteBrewLog(other, id)
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));

    assertThat(brewLogRepository.findById(id).orElseThrow().getDeletedAt()).isNull();
  }

  // ===== 부분 수정 (AC-BLEDIT-01~11, 14, 16, 17, 19) =====

  private ResultActions patchBrewLog(String token, Long id, String body) throws Exception {
    return mockMvc.perform(
        patch("/api/v1/brew-logs/{id}", id)
            .header(HttpHeaders.AUTHORIZATION, token)
            .contentType(MediaType.APPLICATION_JSON)
            .content(body));
  }

  @Test
  @DisplayName("AC-BLEDIT-01 · 보낸 필드만 바뀐다")
  void 보낸_필드만_바뀐다() throws Exception {
    String token = token("bledit-01");
    Long id = createdId(createWith(token, "\"rating\":3.0,\"overallNote\":\"묽다\""));

    patchBrewLog(
            token,
            id,
            """
        {"rating":4.0}
        """)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.rating").value(4.0))
        .andExpect(jsonPath("$.actualDoseG").value(15.0))
        .andExpect(jsonPath("$.overallNote").value("묽다"));
  }

  @Test
  @DisplayName("AC-BLEDIT-02 · 생략한 필드는 null로 지워지지 않는다")
  void 생략한_필드는_유지된다() throws Exception {
    String token = token("bledit-02");
    Long id = createdId(createWith(token, "\"beverageWeightG\":250.0,\"tdsPercent\":1.35"));

    patchBrewLog(
            token,
            id,
            """
        {"rating":4.0}
        """)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.tdsPercent").value(1.35));
  }

  @Test
  @DisplayName("AC-BLEDIT-03 · 명시적 null도 변경 없음으로 취급한다")
  void 명시적_null도_변경_없음이다() throws Exception {
    String token = token("bledit-03");
    Long id = createdId(createWith(token, "\"beverageWeightG\":250.0,\"tdsPercent\":1.35"));

    patchBrewLog(
            token,
            id,
            """
        {"tdsPercent":null}
        """)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.tdsPercent").value(1.35));
  }

  @Test
  @DisplayName("AC-BLEDIT-04 · TDS를 넣으면 추출 수율이 계산되어 응답에 나온다")
  void TDS를_넣으면_추출_수율이_계산된다() throws Exception {
    String token = token("bledit-04");
    Long id = createdId(createWith(token, "\"beverageWeightG\":250.0"));

    getBrewLog(token, id).andExpect(jsonPath("$.extractionYieldPercent").doesNotExist());

    patchBrewLog(
            token,
            id,
            """
        {"tdsPercent":1.35}
        """)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.extractionYieldPercent").value(22.5))
        .andExpect(jsonPath("$.extractionZone").value("OVER"));
  }

  @Test
  @DisplayName("AC-BLEDIT-05 · 음료 중량을 바꾸면 추출 수율이 따라 바뀐다")
  void 음료_중량을_바꾸면_추출_수율이_바뀐다() throws Exception {
    String token = token("bledit-05");
    Long id = createdId(createWith(token, "\"beverageWeightG\":250.0,\"tdsPercent\":1.35"));

    getBrewLog(token, id).andExpect(jsonPath("$.extractionYieldPercent").value(22.5));

    patchBrewLog(
            token,
            id,
            """
        {"beverageWeightG":225.0}
        """)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.extractionYieldPercent").value(20.3));
  }

  @Test
  @DisplayName("AC-BLEDIT-06 · 분쇄도 설정을 바꾸면 마이크론 추정값이 다시 저장된다")
  void 분쇄도를_바꾸면_마이크론이_재저장된다() throws Exception {
    String token = token("bledit-06");
    Long id = createdId(createWith(token, "\"rating\":3.0"));

    getBrewLog(token, id).andExpect(jsonPath("$.actualGrindMicronEstimated").value(660));

    patchBrewLog(
            token,
            id,
            """
        {"actualGrindSettingValue":24.0}
        """)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.actualGrindMicronEstimated").value(720));

    assertThat(brewLogRepository.findById(id).orElseThrow().getActualGrindMicronEstimated())
        .isEqualByComparingTo("720");
  }

  @Test
  @DisplayName("AC-BLEDIT-07 · 추출 시각을 바꾸면 경과일과 디게싱 상태가 다시 저장된다")
  void 추출_시각을_바꾸면_경과일과_디게싱이_재저장된다() throws Exception {
    String token = token("bledit-07");
    // 로스팅 10일 전 재고로, 추출은 9일 전에 했다 → 경과 1일 TOO_FRESH
    Long batch = beanBatchId(token, BREWED_AT, 10);
    Long grinder = userGrinderId(token, c40Id());
    Long recipe = recipeId(token);
    Instant nineDaysAgo = BREWED_AT.minus(9, ChronoUnit.DAYS);
    Long id = brewLogOf(token, recipe, batch, grinder, nineDaysAgo);

    getBrewLog(token, id)
        .andExpect(jsonPath("$.daysOffRoast").value(1))
        .andExpect(jsonPath("$.degassingStatus").value("TOO_FRESH"));

    patchBrewLog(
            token,
            id,
            """
        {"brewedAt":"%s"}
        """
                .formatted(BREWED_AT))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.daysOffRoast").value(10))
        .andExpect(jsonPath("$.degassingStatus").value("IDEAL"));

    assertThat(brewLogRepository.findById(id).orElseThrow().getDaysOffRoast()).isEqualTo(10);
  }

  @Test
  @DisplayName("AC-BLEDIT-08 · 원두 재고가 삭제된 뒤 추출 시각을 바꿔도 경과일은 유지된다")
  void 재고_삭제_후에도_경과일은_유지된다() throws Exception {
    String token = token("bledit-08");
    Long batch = beanBatchId(token, BREWED_AT, 10);
    Long grinder = userGrinderId(token, c40Id());
    Long recipe = recipeId(token);
    Instant nineDaysAgo = BREWED_AT.minus(9, ChronoUnit.DAYS);
    Long id = brewLogOf(token, recipe, batch, grinder, nineDaysAgo);

    mockMvc
        .perform(
            delete("/api/v1/bean-batches/{id}", batch).header(HttpHeaders.AUTHORIZATION, token))
        .andExpect(status().isNoContent());

    patchBrewLog(
            token,
            id,
            """
        {"brewedAt":"%s"}
        """
                .formatted(BREWED_AT))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.daysOffRoast").value(1));
  }

  @Test
  @DisplayName("AC-BLEDIT-09 · 공개범위를 FRIENDS로 바꾸면 상호 팔로우 상대가 볼 수 있다")
  void 공개범위를_FRIENDS로_바꾸면_상대가_본다() throws Exception {
    User a = newUser("bledit-09-a");
    User b = newUser("bledit-09-b");
    mutualFollow(a, b);
    Long id = brewLogWith(tokenOf(a), "PRIVATE");

    getBrewLog(tokenOf(b), id).andExpect(status().isForbidden());

    patchBrewLog(
            tokenOf(a),
            id,
            """
        {"visibility":"FRIENDS"}
        """)
        .andExpect(status().isOk());

    getBrewLog(tokenOf(b), id).andExpect(status().isOk());
  }

  @Test
  @DisplayName("AC-BLEDIT-10 · recipeId를 보내도 무시된다")
  void recipeId를_보내도_무시된다() throws Exception {
    String token = token("bledit-10");
    Long id = createdId(createWith(token, "\"rating\":3.0"));
    Long before = brewLogRepository.findById(id).orElseThrow().getRecipeId();
    Long other = recipeId(token);

    patchBrewLog(
            token,
            id,
            """
        {"recipeId":%d,"rating":4.0}
        """
                .formatted(other))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.recipeId").value(before))
        .andExpect(jsonPath("$.rating").value(4.0));
  }

  @Test
  @DisplayName("AC-BLEDIT-11 · 레시피를 수정해도 목록의 실측 스냅샷은 불변이다")
  void 레시피를_수정해도_목록의_스냅샷은_불변이다() throws Exception {
    String token = token("bledit-11");
    Long batch = beanBatchId(token, BREWED_AT, 6);
    Long grinder = userGrinderId(token, c40Id());
    Long recipe = recipeId(token);
    brewLogOf(token, recipe, batch, grinder, BREWED_AT);

    mockMvc
        .perform(
            put("/api/v1/recipes/{id}", recipe)
                .header(HttpHeaders.AUTHORIZATION, token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"title":"물량 바뀐 레시피","doseG":16.0,"waterG":250.0}
                    """))
        .andExpect(status().isOk());

    listBrewLogs(token, "?recipeId=" + recipe)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[0].actualDoseG").value(15.0));
  }

  @Test
  @DisplayName("AC-BLEDIT-14 · 타인의 로그는 수정할 수 없다")
  void 타인의_로그는_수정할_수_없다() throws Exception {
    User a = newUser("bledit-14-a");
    User b = newUser("bledit-14-b");
    mutualFollow(a, b);
    Long id = brewLogWith(tokenOf(a), "PUBLIC");

    // 볼 수는 있다
    getBrewLog(tokenOf(b), id).andExpect(status().isOk());

    patchBrewLog(
            tokenOf(b),
            id,
            """
        {"rating":4.0}
        """)
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }

  @Test
  @DisplayName("AC-BLEDIT-16 · 존재하지 않는 로그를 수정하면 404다")
  void 존재하지_않는_로그를_수정하면_404다() throws Exception {
    patchBrewLog(
            token("bledit-16"),
            999999L,
            """
        {"rating":4.0}
        """)
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  @DisplayName("AC-BLEDIT-17 · 삭제된 로그를 수정하면 404다")
  void 삭제된_로그를_수정하면_404다() throws Exception {
    String token = token("bledit-17");
    Long id = newBrewLog(token);
    deleteBrewLog(token, id).andExpect(status().isNoContent());

    patchBrewLog(
            token,
            id,
            """
        {"rating":4.0}
        """)
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  @DisplayName("AC-BLEDIT-19 · JWT 없이 수정하면 401이다")
  void JWT_없이_수정하면_401이다() throws Exception {
    mockMvc
        .perform(
            patch("/api/v1/brew-logs/{id}", 1L)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"rating":4.0}
                    """))
        .andExpect(status().isUnauthorized());
  }

  // ===== 목록 조회 (AC-LIST-18~27, 34, 36) =====

  private ResultActions listBrewLogs(String token, String query) throws Exception {
    return mockMvc.perform(
        get("/api/v1/brew-logs" + query).header(HttpHeaders.AUTHORIZATION, token));
  }

  /** 픽스처를 공유해 여러 건을 만들 때 쓴다. 로스팅일을 넉넉히 과거로 잡아 경과일이 음수가 되지 않게 한다. */
  private Long brewLogOf(String token, Long recipe, Long batch, Long grinder, Instant brewedAt)
      throws Exception {
    return createdId(createBrewLog(token, minimalBody(recipe, batch, brewedAt, grinder)));
  }

  @Test
  @DisplayName("AC-LIST-18 · 타인의 PRIVATE 로그는 제외된다")
  void 타인의_PRIVATE_로그는_제외된다() throws Exception {
    User a = newUser("list-18-a");
    User b = newUser("list-18-b");
    Long id = brewLogWith(tokenOf(b), "PRIVATE");

    listBrewLogs(tokenOf(a), "")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[?(@.id == " + id + ")]").isEmpty())
        .andExpect(jsonPath("$.totalElements").value(0));
  }

  @Test
  @DisplayName("AC-LIST-19 · 상호 팔로우 상대의 FRIENDS 로그는 포함된다")
  void 상호_팔로우_상대의_FRIENDS_로그는_포함된다() throws Exception {
    User a = newUser("list-19-a");
    User b = newUser("list-19-b");
    Long id = brewLogWith(tokenOf(b), "FRIENDS");
    mutualFollow(a, b);

    listBrewLogs(tokenOf(a), "")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[0].id").value(id));
  }

  @Test
  @DisplayName("AC-LIST-20 · recipeId 필터가 해당 레시피의 기록만 남긴다")
  void recipeId_필터가_해당_레시피의_기록만_남긴다() throws Exception {
    String token = token("list-20");
    Long batch = beanBatchId(token, BREWED_AT, 30);
    Long grinder = userGrinderId(token, c40Id());
    Long recipeA = recipeId(token);
    Long recipeB = recipeId(token);

    brewLogOf(token, recipeA, batch, grinder, BREWED_AT);
    brewLogOf(token, recipeA, batch, grinder, BREWED_AT);
    brewLogOf(token, recipeA, batch, grinder, BREWED_AT);
    brewLogOf(token, recipeB, batch, grinder, BREWED_AT);
    brewLogOf(token, recipeB, batch, grinder, BREWED_AT);

    listBrewLogs(token, "?recipeId=" + recipeA)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(3))
        .andExpect(jsonPath("$.content[*].recipeId").value(everyItem(equalTo(recipeA.intValue()))));
  }

  @Test
  @DisplayName("AC-LIST-21 · userId 필터가 해당 사용자의 기록만 남긴다")
  void userId_필터가_해당_사용자의_기록만_남긴다() throws Exception {
    User a = newUser("list-21-a");
    User b = newUser("list-21-b");
    String tokenA = tokenOf(a);
    Long batch = beanBatchId(tokenA, BREWED_AT, 30);
    Long grinder = userGrinderId(tokenA, c40Id());
    Long recipe = recipeId(tokenA);
    brewLogOf(tokenA, recipe, batch, grinder, BREWED_AT);
    brewLogOf(tokenA, recipe, batch, grinder, BREWED_AT);
    brewLogWith(tokenOf(b), "PUBLIC");

    listBrewLogs(tokenA, "?userId=" + b.getId())
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(1))
        .andExpect(jsonPath("$.content[0].userId").value(b.getId()));
  }

  @Test
  @DisplayName("AC-LIST-22 · beanBatchId 필터가 해당 봉지의 기록만 남긴다")
  void beanBatchId_필터가_해당_봉지의_기록만_남긴다() throws Exception {
    String token = token("list-22");
    Long grinder = userGrinderId(token, c40Id());
    Long recipe = recipeId(token);
    Long batchA = beanBatchId(token, BREWED_AT, 30);
    Long batchB = beanBatchId(token, BREWED_AT, 30);

    brewLogOf(token, recipe, batchA, grinder, BREWED_AT);
    brewLogOf(token, recipe, batchA, grinder, BREWED_AT);
    brewLogOf(token, recipe, batchB, grinder, BREWED_AT);

    listBrewLogs(token, "?beanBatchId=" + batchA)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(2))
        .andExpect(
            jsonPath("$.content[*].beanBatchId").value(everyItem(equalTo(batchA.intValue()))));
  }

  @Test
  @DisplayName("AC-LIST-23 · 필터를 함께 쓰면 AND로 결합한다")
  void 필터를_함께_쓰면_AND로_결합한다() throws Exception {
    String token = token("list-23");
    Long grinder = userGrinderId(token, c40Id());
    Long recipe = recipeId(token);
    Long batchA = beanBatchId(token, BREWED_AT, 30);
    Long batchB = beanBatchId(token, BREWED_AT, 30);

    brewLogOf(token, recipe, batchA, grinder, BREWED_AT);
    brewLogOf(token, recipe, batchB, grinder, BREWED_AT);

    listBrewLogs(token, "?recipeId=" + recipe + "&beanBatchId=" + batchA)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(1));
  }

  @Test
  @DisplayName("AC-LIST-24 · brewedAt 내림차순으로 나오고 동점이면 id 내림차순이다")
  void brewedAt_내림차순이고_동점이면_id_내림차순이다() throws Exception {
    String token = token("list-24");
    Long batch = beanBatchId(token, BREWED_AT, 30);
    Long grinder = userGrinderId(token, c40Id());
    Long recipe = recipeId(token);

    Instant older = BREWED_AT.minus(2, ChronoUnit.DAYS);
    Instant newer = BREWED_AT.minus(1, ChronoUnit.DAYS);
    Long oldest = brewLogOf(token, recipe, batch, grinder, older);
    Long tie1 = brewLogOf(token, recipe, batch, grinder, newer);
    Long tie2 = brewLogOf(token, recipe, batch, grinder, newer);

    listBrewLogs(token, "")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[0].id").value(tie2))
        .andExpect(jsonPath("$.content[1].id").value(tie1))
        .andExpect(jsonPath("$.content[2].id").value(oldest));
  }

  @Test
  @DisplayName("AC-LIST-25 · 목록 응답에 overallNote 키가 없다")
  void 목록_응답에_overallNote_키가_없다() throws Exception {
    String token = token("list-25");
    createdId(createWith(token, "\"overallNote\":\"묽고 밍밍하다\""));

    listBrewLogs(token, "")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[0].overallNote").doesNotExist())
        .andExpect(jsonPath("$.content[0].actualDoseG").value(15.0));
  }

  @Test
  @DisplayName("AC-LIST-26 · TDS가 없는 로그도 목록에 나오고 분석 필드가 없다")
  void TDS가_없는_로그도_목록에_나온다() throws Exception {
    String token = token("list-26");
    newBrewLog(token);

    listBrewLogs(token, "")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[0].extractionYieldPercent").doesNotExist())
        .andExpect(jsonPath("$.content[0].strengthZone").doesNotExist())
        .andExpect(jsonPath("$.content[0].brewRatio").exists());
  }

  @Test
  @DisplayName("AC-LIST-27 · 소프트 삭제된 로그는 목록에서 제외된다")
  void 소프트_삭제된_로그는_목록에서_제외된다() throws Exception {
    String token = token("list-27");
    Long batch = beanBatchId(token, BREWED_AT, 30);
    Long grinder = userGrinderId(token, c40Id());
    Long recipe = recipeId(token);
    brewLogOf(token, recipe, batch, grinder, BREWED_AT);
    Long doomed = brewLogOf(token, recipe, batch, grinder, BREWED_AT);

    deleteBrewLog(token, doomed).andExpect(status().isNoContent());

    listBrewLogs(token, "")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(1))
        .andExpect(jsonPath("$.content[?(@.id == " + doomed + ")]").isEmpty());
  }

  @Test
  @DisplayName("AC-LIST-34 · 볼 수 없는 레시피 id로 필터해도 빈 목록이다")
  void 볼_수_없는_레시피_id로_필터해도_빈_목록이다() throws Exception {
    User a = newUser("list-34-a");
    User b = newUser("list-34-b");
    Long bRecipe = recipeId(tokenOf(b)); // 기본 visibility는 PRIVATE

    listBrewLogs(tokenOf(a), "?recipeId=" + bRecipe)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content").isEmpty());
  }

  @Test
  @DisplayName("AC-LIST-36 · JWT 없이 브루잉 로그 목록을 부르면 401이다")
  void JWT_없이_브루잉_로그_목록은_401이다() throws Exception {
    mockMvc.perform(get("/api/v1/brew-logs")).andExpect(status().isUnauthorized());
  }

  @Test
  @DisplayName("AC-BLEDIT-18 · 이미 삭제된 로그를 다시 삭제하면 404다")
  void 이미_삭제된_로그를_다시_삭제하면_404다() throws Exception {
    String token = token("bledit-18");
    Long id = newBrewLog(token);
    deleteBrewLog(token, id).andExpect(status().isNoContent());

    deleteBrewLog(token, id)
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }
}
