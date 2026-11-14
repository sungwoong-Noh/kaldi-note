package com.kaldinote.brewlog.presentation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.kaldinote.AbstractIntegrationTest;
import com.kaldinote.auth.infrastructure.jwt.JwtTokenProvider;
import com.kaldinote.gear.infrastructure.GrinderModelRepository;
import com.kaldinote.inventory.domain.DegassingStatus;
import com.kaldinote.user.domain.User;
import com.kaldinote.user.infrastructure.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.time.Duration;
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

/** docs/specs/2026-11-14-quick-brew.md — 빠른 기록 백엔드(Task 1~4). */
@Transactional
class QuickBrewControllerTest extends AbstractIntegrationTest {

  @Autowired private JwtTokenProvider tokenProvider;
  @Autowired private UserRepository userRepository;
  @Autowired private GrinderModelRepository grinderModelRepository;
  @PersistenceContext private EntityManager entityManager;

  private String token(String nickname) {
    User user = userRepository.save(User.create(null, nickname, null));
    return "Bearer " + tokenProvider.createAccessToken(user.getId(), user.getRole());
  }

  private Long createdId(ResultActions actions) throws Exception {
    String body = actions.andReturn().getResponse().getContentAsString();
    return Long.valueOf(JsonPath.read(body, "$.id").toString());
  }

  private ResultActions postJson(String token, String path, String body) throws Exception {
    return mockMvc.perform(
        post(path)
            .header(HttpHeaders.AUTHORIZATION, token)
            .contentType(MediaType.APPLICATION_JSON)
            .content(body));
  }

  private ResultActions createBrewLog(String token, String body) throws Exception {
    return postJson(token, "/api/v1/brew-logs", body);
  }

  private Long userGrinderId(String token) throws Exception {
    Long c40 =
        grinderModelRepository.findByBrandAndName("Comandante", "C40 MK4").orElseThrow().getId();
    return createdId(
        postJson(
            token,
            "/api/v1/gear/user-grinders",
            """
            {"grinderModelId":%d,"nickname":"내 그라인더"}
            """
                .formatted(c40)));
  }

  private Long recipeId(String token) throws Exception {
    return createdId(
        postJson(
            token,
            "/api/v1/recipes",
            """
            {"title":"빠른 기록 테스트용","doseG":15.0,"waterG":250.0}
            """));
  }

  private Long beanProductId(String token) throws Exception {
    Long roasterId =
        createdId(
            postJson(
                token,
                "/api/v1/roasters",
                """
                {"name":"빠른기록테스트로스터-%s"}
                """
                    .formatted(UUID.randomUUID())));
    return createdId(
        postJson(
            token,
            "/api/v1/bean-products",
            """
            {"roasterId":%d,"name":"빠른기록테스트상품-%s","beanMix":"SINGLE_ORIGIN",
             "roastLevel":"LIGHT","origins":[{"country":"ET"}]}
            """
                .formatted(roasterId, UUID.randomUUID())));
  }

  private Long beanBatchId(String token) throws Exception {
    return createdId(
        postJson(
            token,
            "/api/v1/bean-batches",
            """
            {"beanProductId":%d,"weightG":200.0,"roastedAt":"%s"}
            """
                .formatted(beanProductId(token), LocalDate.now(ZoneOffset.UTC).minusDays(6))));
  }

  private long rowCount(String table) {
    return ((Number)
            entityManager.createNativeQuery("select count(*) from " + table).getSingleResult())
        .longValue();
  }

  private static final String MIN = "\"actualDoseG\":16.0,\"actualWaterG\":250.0";

  // ── 기능 ──────────────────────────────────────────────────────────────

  @Test
  @DisplayName("AC-QUICKBREW-01 · 원두량·물량만으로 기록이 생긴다")
  void 원두량_물량만으로_기록이_생긴다() throws Exception {
    String token = token("빠른기록01");
    Instant before = Instant.now();

    String body =
        createBrewLog(token, "{" + MIN + "}")
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.visibility").value("PRIVATE"))
            .andExpect(jsonPath("$.brewRatio").value(15.6))
            .andExpect(jsonPath("$.recipeId").doesNotExist())
            .andExpect(jsonPath("$.beanBatchId").doesNotExist())
            .andExpect(jsonPath("$.beanProductId").doesNotExist())
            .andExpect(jsonPath("$.beanName").doesNotExist())
            .andExpect(jsonPath("$.userGrinderId").doesNotExist())
            .andExpect(jsonPath("$.actualGrindSettingValue").doesNotExist())
            .andExpect(jsonPath("$.actualWaterTempC").doesNotExist())
            .andExpect(jsonPath("$.daysOffRoast").doesNotExist())
            .andExpect(jsonPath("$.degassingStatus").doesNotExist())
            .andExpect(jsonPath("$.recipeSnapshot").doesNotExist())
            .andReturn()
            .getResponse()
            .getContentAsString();

    Instant brewedAt = Instant.parse(JsonPath.read(body, "$.brewedAt"));
    assertThat(Duration.between(before, brewedAt).abs()).isLessThan(Duration.ofSeconds(5));
  }

  @Test
  @DisplayName("AC-QUICKBREW-02 · 원두 이름만 직접 적어 기록한다")
  void 원두_이름만_직접_적어_기록한다() throws Exception {
    String token = token("빠른기록02");
    long productsBefore = rowCount("bean_products");

    createBrewLog(token, "{\"actualDoseG\":16.0,\"actualWaterG\":260.0,\"beanName\":\"  하늘 블렌드 \"}")
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.beanName").value("하늘 블렌드"))
        .andExpect(jsonPath("$.beanProductId").doesNotExist())
        .andExpect(jsonPath("$.beanBatchId").doesNotExist());

    assertThat(rowCount("bean_products")).isEqualTo(productsBefore);
  }

  @Test
  @DisplayName("AC-QUICKBREW-03 · 카탈로그 원두를 고른다")
  void 카탈로그_원두를_고른다() throws Exception {
    String token = token("빠른기록03");
    Long productId = beanProductId(token);
    long batchesBefore = rowCount("bean_batches");

    createBrewLog(token, "{" + MIN + ",\"beanProductId\":" + productId + "}")
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.beanProductId").value(productId));

    assertThat(rowCount("bean_batches")).isEqualTo(batchesBefore);
  }

  @Test
  @DisplayName("AC-QUICKBREW-04 · 로스팅 날짜로 경과일을 계산한다")
  void 로스팅_날짜로_경과일을_계산한다() throws Exception {
    String token = token("빠른기록04");

    createBrewLog(
            token,
            "{" + MIN + ",\"brewedAt\":\"2026-11-14T03:00:00Z\",\"roastedAt\":\"2026-11-02\"}")
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.roastedAt").value("2026-11-02"))
        .andExpect(jsonPath("$.daysOffRoast").value(12))
        .andExpect(jsonPath("$.degassingStatus").value(DegassingStatus.of(12).name()));

    createBrewLog(token, "{" + MIN + ",\"brewedAt\":\"2026-11-14T03:00:00Z\"}")
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.daysOffRoast").doesNotExist())
        .andExpect(jsonPath("$.degassingStatus").doesNotExist());
  }

  @Test
  @DisplayName("AC-QUICKBREW-05 · 레시피를 연결할 때만 스냅샷이 생긴다")
  void 레시피를_연결할_때만_스냅샷이_생긴다() throws Exception {
    String token = token("빠른기록05");
    Long recipeId = recipeId(token);

    Long withRecipe =
        createdId(
            createBrewLog(token, "{" + MIN + ",\"recipeId\":" + recipeId + "}")
                .andExpect(status().isCreated()));
    Long without = createdId(createBrewLog(token, "{" + MIN + "}").andExpect(status().isCreated()));

    mockMvc
        .perform(get("/api/v1/brew-logs/{id}", withRecipe).header(HttpHeaders.AUTHORIZATION, token))
        .andExpect(jsonPath("$.recipeSnapshot.title").value("빠른 기록 테스트용"));
    mockMvc
        .perform(get("/api/v1/brew-logs/{id}", without).header(HttpHeaders.AUTHORIZATION, token))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.recipeSnapshot").doesNotExist());
  }

  @Test
  @DisplayName("AC-QUICKBREW-06 · 기존 방식(레시피·봉투·그라인더)으로 만든 기록은 지금처럼 응답한다")
  void 기존_방식으로_만든_기록은_지금처럼_응답한다() throws Exception {
    String token = token("빠른기록06");
    Long recipeId = recipeId(token);
    Long batchId = beanBatchId(token);
    Long grinderId = userGrinderId(token);
    Instant brewedAt = Instant.now().minus(1, ChronoUnit.HOURS).truncatedTo(ChronoUnit.SECONDS);

    Long id =
        createdId(
            createBrewLog(
                    token,
                    """
                    {"recipeId":%d,"beanBatchId":%d,"brewedAt":"%s",
                     "actualDoseG":15.0,"actualWaterG":250.0,"actualWaterTempC":92.0,
                     "userGrinderId":%d,"actualGrindSettingValue":22.0}
                    """
                        .formatted(recipeId, batchId, brewedAt, grinderId))
                .andExpect(status().isCreated()));

    mockMvc
        .perform(get("/api/v1/brew-logs/{id}", id).header(HttpHeaders.AUTHORIZATION, token))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.recipeId").value(recipeId))
        .andExpect(jsonPath("$.beanBatchId").value(batchId))
        .andExpect(jsonPath("$.userGrinderId").value(grinderId))
        .andExpect(jsonPath("$.actualWaterTempC").value(92.0))
        .andExpect(jsonPath("$.actualGrindSettingValue").value(22.0))
        .andExpect(jsonPath("$.actualGrindMicronEstimated").exists())
        .andExpect(jsonPath("$.daysOffRoast").exists())
        .andExpect(jsonPath("$.degassingStatus").exists())
        .andExpect(jsonPath("$.recipeSnapshot.title").value("빠른 기록 테스트용"))
        .andExpect(jsonPath("$.beanProductId").doesNotExist())
        .andExpect(jsonPath("$.beanName").doesNotExist())
        .andExpect(jsonPath("$.roastedAt").doesNotExist());
  }

  @Test
  @DisplayName("AC-QUICKBREW-07 · 「지난번」은 목록의 첫 항목이다")
  void 지난번은_목록의_첫_항목이다() throws Exception {
    String me = token("빠른기록07");
    String other = token("빠른기록07다른");
    for (String at :
        new String[] {"2026-11-10T00:00:00Z", "2026-11-13T00:00:00Z", "2026-11-12T00:00:00Z"}) {
      createBrewLog(me, "{" + MIN + ",\"brewedAt\":\"" + at + "\"}")
          .andExpect(status().isCreated());
    }
    createBrewLog(
            other, "{" + MIN + ",\"brewedAt\":\"2026-11-14T00:00:00Z\",\"visibility\":\"PUBLIC\"}")
        .andExpect(status().isCreated());
    Long myId =
        Long.valueOf(
            JsonPath.read(
                    mockMvc
                        .perform(get("/api/v1/users/me").header(HttpHeaders.AUTHORIZATION, me))
                        .andReturn()
                        .getResponse()
                        .getContentAsString(),
                    "$.id")
                .toString());

    mockMvc
        .perform(
            get("/api/v1/brew-logs")
                .param("userId", myId.toString())
                .param("size", "1")
                .header(HttpHeaders.AUTHORIZATION, me))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(1))
        .andExpect(jsonPath("$.content[0].brewedAt").value("2026-11-13T00:00:00Z"))
        .andExpect(jsonPath("$.totalElements").value(3));
  }

  @Test
  @DisplayName("AC-QUICKBREW-08 · 수정의 null은 「변경 없음」이다 — 새 필드도 같다")
  void 수정의_null은_변경_없음이다() throws Exception {
    String token = token("빠른기록08");
    Long grinderId = userGrinderId(token);
    Long id =
        createdId(
            createBrewLog(
                    token,
                    "{"
                        + MIN
                        + ",\"beanName\":\"하늘 블렌드\",\"userGrinderId\":"
                        + grinderId
                        + ",\"actualGrindSettingValue\":24.0}")
                .andExpect(status().isCreated()));

    mockMvc
        .perform(
            patch("/api/v1/brew-logs/{id}", id)
                .header(HttpHeaders.AUTHORIZATION, token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"beanName\":null,\"userGrinderId\":null,\"rating\":4.5}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.rating").value(4.5))
        .andExpect(jsonPath("$.beanName").value("하늘 블렌드"))
        .andExpect(jsonPath("$.userGrinderId").value(grinderId))
        .andExpect(jsonPath("$.actualGrindSettingValue").value(24.0));

    mockMvc
        .perform(
            patch("/api/v1/brew-logs/{id}", id)
                .header(HttpHeaders.AUTHORIZATION, token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"beanName\":\"구지\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.beanName").value("구지"));
  }

  // ── 엣지 ──────────────────────────────────────────────────────────────

  @Test
  @DisplayName("AC-QUICKBREW-40 · 원두량·물량 경계 — 0.0은 거부, 0.1은 허용, 빠지면 거부")
  void 원두량_물량_경계() throws Exception {
    String token = token("빠른기록40");
    createBrewLog(token, "{\"actualDoseG\":0.0,\"actualWaterG\":250.0}")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    createBrewLog(token, "{\"actualDoseG\":0.1,\"actualWaterG\":250.0}")
        .andExpect(status().isCreated());
    createBrewLog(token, "{\"actualDoseG\":16.0,\"actualWaterG\":0.0}")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    createBrewLog(token, "{\"actualDoseG\":16.0,\"actualWaterG\":0.1}")
        .andExpect(status().isCreated());
    createBrewLog(token, "{\"actualDoseG\":16.0}")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    createBrewLog(token, "{\"actualWaterG\":250.0}")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  @DisplayName("AC-QUICKBREW-41 · 원두 이름 길이 — 100자 허용, 101자 거부, 공백뿐이면 비운다")
  void 원두_이름_길이() throws Exception {
    String token = token("빠른기록41");
    createBrewLog(token, "{" + MIN + ",\"beanName\":\"" + "가".repeat(100) + "\"}")
        .andExpect(status().isCreated());
    createBrewLog(token, "{" + MIN + ",\"beanName\":\"" + "가".repeat(101) + "\"}")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    createBrewLog(token, "{" + MIN + ",\"beanName\":\"   \"}")
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.beanName").doesNotExist());
  }

  @Test
  @DisplayName("AC-QUICKBREW-42 · 로스팅 날짜 경계 — 기록 날짜와 같으면 허용, 하루 늦으면 거부")
  void 로스팅_날짜_경계() throws Exception {
    String token = token("빠른기록42");
    String at = ",\"brewedAt\":\"2026-11-14T03:00:00Z\"";
    createBrewLog(token, "{" + MIN + at + ",\"roastedAt\":\"2026-11-14\"}")
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.daysOffRoast").value(0));
    createBrewLog(token, "{" + MIN + at + ",\"roastedAt\":\"2026-11-15\"}")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  // ── 실패 ──────────────────────────────────────────────────────────────

  @Test
  @DisplayName("AC-QUICKBREW-50 · 원두를 두 방식으로 동시에 주면 400")
  void 원두를_두_방식으로_주면_400() throws Exception {
    String token = token("빠른기록50");
    Long productId = beanProductId(token);
    createBrewLog(token, "{" + MIN + ",\"beanProductId\":" + productId + ",\"beanName\":\"구지\"}")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  @DisplayName("AC-QUICKBREW-51 · 그라인더 없이 분쇄도만 주면 400")
  void 그라인더_없이_분쇄도만_주면_400() throws Exception {
    String token = token("빠른기록51");
    createBrewLog(token, "{" + MIN + ",\"actualGrindSettingValue\":24.0}")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  @DisplayName("AC-QUICKBREW-52 · 없는 원두 상품이면 404")
  void 없는_원두_상품이면_404() throws Exception {
    String token = token("빠른기록52");
    createBrewLog(token, "{" + MIN + ",\"beanProductId\":999999}")
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  @DisplayName("AC-QUICKBREW-53 · 남의 그라인더면 403")
  void 남의_그라인더면_403() throws Exception {
    String owner = token("빠른기록53주인");
    String me = token("빠른기록53");
    Long othersGrinder = userGrinderId(owner);
    createBrewLog(me, "{" + MIN + ",\"userGrinderId\":" + othersGrinder + "}")
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }
}
