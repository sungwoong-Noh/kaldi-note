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
}
