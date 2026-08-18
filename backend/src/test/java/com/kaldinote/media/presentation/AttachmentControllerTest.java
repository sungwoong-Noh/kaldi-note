package com.kaldinote.media.presentation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.endsWith;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.kaldinote.AbstractIntegrationTest;
import com.kaldinote.auth.infrastructure.jwt.JwtTokenProvider;
import com.kaldinote.gear.infrastructure.GrinderModelRepository;
import com.kaldinote.media.domain.Attachment;
import com.kaldinote.media.domain.TargetType;
import com.kaldinote.media.infrastructure.AttachmentRepository;
import com.kaldinote.user.domain.User;
import com.kaldinote.user.infrastructure.UserRepository;
import java.time.Instant;
import java.time.LocalDate;
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
class AttachmentControllerTest extends AbstractIntegrationTest {

  @Autowired private JwtTokenProvider tokenProvider;
  @Autowired private UserRepository userRepository;
  @Autowired private GrinderModelRepository grinderModelRepository;
  @Autowired private AttachmentRepository attachmentRepository;

  private User newUser(String nickname) {
    return userRepository.save(User.create(null, nickname, null));
  }

  private String tokenOf(User user) {
    return "Bearer " + tokenProvider.createAccessToken(user.getId(), user.getRole());
  }

  private Long createdId(ResultActions actions) throws Exception {
    String body = actions.andReturn().getResponse().getContentAsString();
    return Long.valueOf(JsonPath.read(body, "$.id").toString());
  }

  private Long recipeId(String token, String visibility) throws Exception {
    return createdId(
        mockMvc.perform(
            post("/api/v1/recipes")
                .header(HttpHeaders.AUTHORIZATION, token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"title":"첨부 테스트","doseG":15.0,"waterG":250.0,"visibility":"%s"}
                    """
                        .formatted(visibility))));
  }

  private Long c40Id() {
    return grinderModelRepository.findByBrandAndName("Comandante", "C40 MK4").orElseThrow().getId();
  }

  private Long userGrinderId(String token) throws Exception {
    return createdId(
        mockMvc.perform(
            post("/api/v1/gear/user-grinders")
                .header(HttpHeaders.AUTHORIZATION, token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"grinderModelId":%d,"nickname":"첨부 테스트 그라인더"}
                    """
                        .formatted(c40Id()))));
  }

  private Long roasterId(String token) throws Exception {
    return createdId(
        mockMvc.perform(
            post("/api/v1/roasters")
                .header(HttpHeaders.AUTHORIZATION, token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"name":"첨부테스트로스터-%s"}
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
                    {"roasterId":%d,"name":"첨부테스트상품-%s","beanMix":"SINGLE_ORIGIN",
                     "roastLevel":"LIGHT","origins":[{"country":"ET"}]}
                    """
                        .formatted(roasterId(token), UUID.randomUUID()))));
  }

  private Long beanBatchId(String token) throws Exception {
    return createdId(
        mockMvc.perform(
            post("/api/v1/bean-batches")
                .header(HttpHeaders.AUTHORIZATION, token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"beanProductId":%d,"weightG":200.0,"roastedAt":"%s"}
                    """
                        .formatted(beanProductId(token), LocalDate.now().minusDays(3)))));
  }

  /** roaster→beanProduct→beanBatch→userGrinder→recipe(PUBLIC) 체인을 다 태워 브루로그 하나를 만든다. */
  private Long brewLogId(String token) throws Exception {
    return createdId(
        mockMvc.perform(
            post("/api/v1/brew-logs")
                .header(HttpHeaders.AUTHORIZATION, token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"recipeId":%d,"beanBatchId":%d,"brewedAt":"%s",
                     "actualDoseG":15.0,"actualWaterG":250.0,"actualWaterTempC":92.0,
                     "userGrinderId":%d,"actualGrindSettingValue":22.0}
                    """
                        .formatted(
                            recipeId(token, "PUBLIC"),
                            beanBatchId(token),
                            Instant.now()
                                .minus(1, ChronoUnit.HOURS)
                                .truncatedTo(ChronoUnit.SECONDS),
                            userGrinderId(token)))));
  }

  private ResultActions issueUploadUrl(
      String token, String targetType, Long targetId, String contentType) throws Exception {
    return mockMvc.perform(
        post("/api/v1/attachments/upload-url")
            .header(HttpHeaders.AUTHORIZATION, token)
            .contentType(MediaType.APPLICATION_JSON)
            .content(
                """
                {"targetType":"%s","targetId":%d,"contentType":"%s"}
                """
                    .formatted(targetType, targetId, contentType)));
  }

  private void seedAttachment(TargetType targetType, Long targetId, Long ownerId, int sortOrder) {
    attachmentRepository.save(
        Attachment.create(
            ownerId,
            targetType,
            targetId,
            "seed/" + UUID.randomUUID(),
            "image/jpeg",
            100,
            100,
            sortOrder));
  }

  @Test
  @DisplayName("AC-MEDIA-01 · RECIPE 소유자가 업로드 URL을 발급받는다")
  void RECIPE_소유자가_업로드_URL을_발급받는다() throws Exception {
    User owner = newUser("media-01");
    Long r1 = recipeId(tokenOf(owner), "PUBLIC");

    issueUploadUrl(tokenOf(owner), "RECIPE", r1, "image/jpeg")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.objectKey", startsWith("attachments/RECIPE/" + r1 + "/")))
        .andExpect(jsonPath("$.objectKey", endsWith(".jpg")))
        .andExpect(jsonPath("$.uploadUrl").exists())
        .andExpect(jsonPath("$.expiresAt").exists());
  }

  @Test
  @DisplayName("AC-MEDIA-02 · BREW_LOG 소유자가 업로드 URL을 발급받는다")
  void BREW_LOG_소유자가_업로드_URL을_발급받는다() throws Exception {
    User owner = newUser("media-02");
    Long l1 = brewLogId(tokenOf(owner));

    issueUploadUrl(tokenOf(owner), "BREW_LOG", l1, "image/png")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.objectKey", startsWith("attachments/BREW_LOG/" + l1 + "/")))
        .andExpect(jsonPath("$.objectKey", endsWith(".png")));
  }

  @Test
  @DisplayName("AC-MEDIA-03 · expiresAt은 발급 시각으로부터 정확히 10분 뒤다")
  void expiresAt은_10분_뒤다() throws Exception {
    User owner = newUser("media-03");
    Long r1 = recipeId(tokenOf(owner), "PUBLIC");
    Instant before = Instant.now();

    String body =
        issueUploadUrl(tokenOf(owner), "RECIPE", r1, "image/jpeg")
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();

    Instant expiresAt = Instant.parse((String) JsonPath.read(body, "$.expiresAt"));
    long deltaSeconds = expiresAt.getEpochSecond() - before.getEpochSecond();
    assertThat(deltaSeconds).isBetween(595L, 605L);
  }

  @Test
  @DisplayName("AC-MEDIA-04 · content-type마다 확장자가 다르게 붙는다")
  void 콘텐츠타입마다_확장자가_다르게_붙는다() throws Exception {
    User owner = newUser("media-04");
    Long r1 = recipeId(tokenOf(owner), "PUBLIC");

    issueUploadUrl(tokenOf(owner), "RECIPE", r1, "image/webp")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.objectKey", endsWith(".webp")));
  }

  @Test
  @DisplayName("AC-MEDIA-05 · 허용 밖 content-type은 400이다")
  void 허용_밖_콘텐츠타입은_400이다() throws Exception {
    User owner = newUser("media-05");
    Long r1 = recipeId(tokenOf(owner), "PUBLIC");

    issueUploadUrl(tokenOf(owner), "RECIPE", r1, "image/gif")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    assertThat(attachmentRepository.countByTargetTypeAndTargetId(TargetType.RECIPE, r1)).isZero();
  }

  @Test
  @DisplayName("AC-MEDIA-06 · 없는 대상은 404다")
  void 없는_대상은_404다() throws Exception {
    User owner = newUser("media-06");

    issueUploadUrl(tokenOf(owner), "RECIPE", 999999L, "image/jpeg")
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  @DisplayName("AC-MEDIA-07 · 소프트 삭제된 레시피는 404다")
  void 소프트_삭제된_레시피는_404다() throws Exception {
    User owner = newUser("media-07");
    Long r1 = recipeId(tokenOf(owner), "PUBLIC");
    mockMvc
        .perform(
            delete("/api/v1/recipes/{id}", r1).header(HttpHeaders.AUTHORIZATION, tokenOf(owner)))
        .andExpect(status().isNoContent());

    issueUploadUrl(tokenOf(owner), "RECIPE", r1, "image/jpeg")
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  @DisplayName("AC-MEDIA-08 · 소유자가 아니면 403이다")
  void 발급_소유자가_아니면_403이다() throws Exception {
    User owner = newUser("media-08a");
    User other = newUser("media-08b");
    Long r1 = recipeId(tokenOf(owner), "PUBLIC");

    issueUploadUrl(tokenOf(other), "RECIPE", r1, "image/jpeg")
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }

  @Test
  @DisplayName("AC-MEDIA-09 · 이미 4장이면 400이다")
  void 이미_4장이면_400이다() throws Exception {
    User owner = newUser("media-09");
    Long r1 = recipeId(tokenOf(owner), "PUBLIC");
    for (int i = 1; i <= 4; i++) {
      seedAttachment(TargetType.RECIPE, r1, owner.getId(), i);
    }

    issueUploadUrl(tokenOf(owner), "RECIPE", r1, "image/jpeg")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  @DisplayName("AC-MEDIA-10 · 3장까지는 정상 발급된다 (경계값)")
  void 세장까지는_정상_발급된다() throws Exception {
    User owner = newUser("media-10");
    Long r1 = recipeId(tokenOf(owner), "PUBLIC");
    for (int i = 1; i <= 3; i++) {
      seedAttachment(TargetType.RECIPE, r1, owner.getId(), i);
    }

    issueUploadUrl(tokenOf(owner), "RECIPE", r1, "image/jpeg").andExpect(status().isOk());
  }

  @Test
  @DisplayName("AC-MEDIA-11 · 토큰 없이 요청하면 401이다")
  void 토큰_없이_요청하면_401이다() throws Exception {
    User owner = newUser("media-11");
    Long r1 = recipeId(tokenOf(owner), "PUBLIC");

    mockMvc
        .perform(
            post("/api/v1/attachments/upload-url")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"targetType":"RECIPE","targetId":%d,"contentType":"image/jpeg"}
                    """
                        .formatted(r1)))
        .andExpect(status().isUnauthorized());
  }
}
