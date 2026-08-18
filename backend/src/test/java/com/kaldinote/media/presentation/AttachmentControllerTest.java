package com.kaldinote.media.presentation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.endsWith;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
import com.kaldinote.media.infrastructure.FakeObjectStorageClient;
import com.kaldinote.user.domain.User;
import com.kaldinote.user.infrastructure.UserRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
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
  @Autowired private FakeObjectStorageClient fakeObjectStorageClient;

  @BeforeEach
  void resetFake() {
    fakeObjectStorageClient.reset();
  }

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

  private String objectKeyFor(String token, String targetType, Long targetId, String contentType)
      throws Exception {
    String body =
        issueUploadUrl(token, targetType, targetId, contentType)
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return (String) JsonPath.read(body, "$.objectKey");
  }

  private ResultActions confirm(
      String token,
      String targetType,
      Long targetId,
      String objectKey,
      Integer width,
      Integer height)
      throws Exception {
    String widthPart = width == null ? "null" : width.toString();
    String heightPart = height == null ? "null" : height.toString();
    return mockMvc.perform(
        post("/api/v1/attachments")
            .header(HttpHeaders.AUTHORIZATION, token)
            .contentType(MediaType.APPLICATION_JSON)
            .content(
                """
                {"targetType":"%s","targetId":%d,"objectKey":"%s","width":%s,"height":%s}
                """
                    .formatted(targetType, targetId, objectKey, widthPart, heightPart)));
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

  private ResultActions list(String token, String targetType, Long targetId) throws Exception {
    return mockMvc.perform(
        get("/api/v1/attachments")
            .header(HttpHeaders.AUTHORIZATION, token)
            .param("targetType", targetType)
            .param("targetId", String.valueOf(targetId)));
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

  @Test
  @DisplayName("AC-MEDIA-12 · 정상 확정하면 201과 AttachmentResponse를 반환한다")
  void 정상_확정하면_201을_반환한다() throws Exception {
    User owner = newUser("media-12");
    Long r1 = recipeId(tokenOf(owner), "PUBLIC");
    String objectKey = objectKeyFor(tokenOf(owner), "RECIPE", r1, "image/jpeg");
    fakeObjectStorageClient.stubUploaded(objectKey, 500_000L, "image/jpeg");

    confirm(tokenOf(owner), "RECIPE", r1, objectKey, 1200, 900)
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.targetType").value("RECIPE"))
        .andExpect(jsonPath("$.targetId").value(r1))
        .andExpect(jsonPath("$.width").value(1200))
        .andExpect(jsonPath("$.height").value(900))
        .andExpect(jsonPath("$.sortOrder").value(1));
  }

  @Test
  @DisplayName("AC-MEDIA-13 · 두 번째 확정의 sortOrder는 2다")
  void 두번째_확정의_sortOrder는_2다() throws Exception {
    User owner = newUser("media-13");
    Long r1 = recipeId(tokenOf(owner), "PUBLIC");
    String key1 = objectKeyFor(tokenOf(owner), "RECIPE", r1, "image/jpeg");
    fakeObjectStorageClient.stubUploaded(key1, 100_000L, "image/jpeg");
    confirm(tokenOf(owner), "RECIPE", r1, key1, 100, 100).andExpect(status().isCreated());

    String key2 = objectKeyFor(tokenOf(owner), "RECIPE", r1, "image/jpeg");
    fakeObjectStorageClient.stubUploaded(key2, 100_000L, "image/jpeg");

    confirm(tokenOf(owner), "RECIPE", r1, key2, 100, 100)
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.sortOrder").value(2));
  }

  @Test
  @DisplayName("AC-MEDIA-14 · content_type은 클라이언트 값이 아니라 OCI HEAD 응답 값이 저장된다")
  void content_type은_HEAD_응답_값이_저장된다() throws Exception {
    User owner = newUser("media-14");
    Long r1 = recipeId(tokenOf(owner), "PUBLIC");
    String objectKey = objectKeyFor(tokenOf(owner), "RECIPE", r1, "image/jpeg");
    fakeObjectStorageClient.stubUploaded(objectKey, 100_000L, "image/png");

    confirm(tokenOf(owner), "RECIPE", r1, objectKey, 100, 100)
        .andExpect(jsonPath("$.contentType").value("image/png"));
  }

  @Test
  @DisplayName("AC-MEDIA-15 · width·height가 없으면 400이다")
  void width_height가_없으면_400이다() throws Exception {
    User owner = newUser("media-15");
    Long r1 = recipeId(tokenOf(owner), "PUBLIC");
    String objectKey = objectKeyFor(tokenOf(owner), "RECIPE", r1, "image/jpeg");
    fakeObjectStorageClient.stubUploaded(objectKey, 100_000L, "image/jpeg");

    confirm(tokenOf(owner), "RECIPE", r1, objectKey, null, null)
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  @DisplayName("AC-MEDIA-16 · OCI에 파일이 없으면(HEAD 실패) 404다")
  void OCI에_파일이_없으면_404다() throws Exception {
    User owner = newUser("media-16");
    Long r1 = recipeId(tokenOf(owner), "PUBLIC");
    String objectKey = objectKeyFor(tokenOf(owner), "RECIPE", r1, "image/jpeg");

    confirm(tokenOf(owner), "RECIPE", r1, objectKey, 100, 100)
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    assertThat(attachmentRepository.existsByObjectKey(objectKey)).isFalse();
  }

  @Test
  @DisplayName("AC-MEDIA-17 · 10MB를 초과하면 OCI 객체를 지우고 400을 반환한다")
  void 십MB_초과하면_객체를_지우고_400을_반환한다() throws Exception {
    User owner = newUser("media-17");
    Long r1 = recipeId(tokenOf(owner), "PUBLIC");
    String objectKey = objectKeyFor(tokenOf(owner), "RECIPE", r1, "image/jpeg");
    fakeObjectStorageClient.stubUploaded(objectKey, 10_485_761L, "image/jpeg");

    confirm(tokenOf(owner), "RECIPE", r1, objectKey, 100, 100)
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    assertThat(fakeObjectStorageClient.wasDeleted(objectKey)).isTrue();
    assertThat(attachmentRepository.existsByObjectKey(objectKey)).isFalse();
  }

  @Test
  @DisplayName("AC-MEDIA-18 · 정확히 10MB는 통과한다 (경계값 포함)")
  void 정확히_십MB는_통과한다() throws Exception {
    User owner = newUser("media-18");
    Long r1 = recipeId(tokenOf(owner), "PUBLIC");
    String objectKey = objectKeyFor(tokenOf(owner), "RECIPE", r1, "image/jpeg");
    fakeObjectStorageClient.stubUploaded(objectKey, 10_485_760L, "image/jpeg");

    confirm(tokenOf(owner), "RECIPE", r1, objectKey, 100, 100).andExpect(status().isCreated());
  }

  @Test
  @DisplayName("AC-MEDIA-19 · 같은 objectKey로 중복 확정하면 400이다")
  void 같은_objectKey로_중복_확정하면_400이다() throws Exception {
    User owner = newUser("media-19");
    Long r1 = recipeId(tokenOf(owner), "PUBLIC");
    String objectKey = objectKeyFor(tokenOf(owner), "RECIPE", r1, "image/jpeg");
    fakeObjectStorageClient.stubUploaded(objectKey, 100_000L, "image/jpeg");
    confirm(tokenOf(owner), "RECIPE", r1, objectKey, 100, 100).andExpect(status().isCreated());

    confirm(tokenOf(owner), "RECIPE", r1, objectKey, 100, 100)
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  @DisplayName("AC-MEDIA-20 · 소유자가 아니면 403이다")
  void 확정_소유자가_아니면_403이다() throws Exception {
    User owner = newUser("media-20a");
    User other = newUser("media-20b");
    Long r1 = recipeId(tokenOf(owner), "PUBLIC");
    String objectKey = objectKeyFor(tokenOf(owner), "RECIPE", r1, "image/jpeg");
    fakeObjectStorageClient.stubUploaded(objectKey, 100_000L, "image/jpeg");

    confirm(tokenOf(other), "RECIPE", r1, objectKey, 100, 100)
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }

  @Test
  @DisplayName("AC-MEDIA-21 · 토큰 없이 확정하면 401이다")
  void 토큰_없이_확정하면_401이다() throws Exception {
    User owner = newUser("media-21");
    Long r1 = recipeId(tokenOf(owner), "PUBLIC");
    String objectKey = objectKeyFor(tokenOf(owner), "RECIPE", r1, "image/jpeg");
    fakeObjectStorageClient.stubUploaded(objectKey, 100_000L, "image/jpeg");

    mockMvc
        .perform(
            post("/api/v1/attachments")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"targetType":"RECIPE","targetId":%d,"objectKey":"%s","width":100,"height":100}
                    """
                        .formatted(r1, objectKey)))
        .andExpect(status().isUnauthorized());
  }

  @Test
  @DisplayName("AC-MEDIA-22 · 소유자는 PRIVATE 대상의 첨부를 sortOrder 오름차순으로 본다")
  void 소유자는_PRIVATE_대상의_첨부를_정렬순으로_본다() throws Exception {
    User owner = newUser("media-22");
    Long r1 = recipeId(tokenOf(owner), "PRIVATE");
    seedAttachment(TargetType.RECIPE, r1, owner.getId(), 1);
    seedAttachment(TargetType.RECIPE, r1, owner.getId(), 2);

    list(tokenOf(owner), "RECIPE", r1)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(2))
        .andExpect(jsonPath("$[0].sortOrder").value(1))
        .andExpect(jsonPath("$[1].sortOrder").value(2));
  }

  @Test
  @DisplayName("AC-MEDIA-23 · 타인은 PUBLIC 대상의 첨부를 본다")
  void 타인은_PUBLIC_대상의_첨부를_본다() throws Exception {
    User owner = newUser("media-23a");
    User other = newUser("media-23b");
    Long r1 = recipeId(tokenOf(owner), "PUBLIC");
    seedAttachment(TargetType.RECIPE, r1, owner.getId(), 1);

    list(tokenOf(other), "RECIPE", r1)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(1));
  }

  @Test
  @DisplayName("AC-MEDIA-24 · 상호 팔로우면 FRIENDS 대상의 첨부를 본다")
  void 상호_팔로우면_FRIENDS_대상의_첨부를_본다() throws Exception {
    User owner = newUser("media-24a");
    User other = newUser("media-24b");
    Long r1 = recipeId(tokenOf(owner), "FRIENDS");
    seedAttachment(TargetType.RECIPE, r1, owner.getId(), 1);
    mutualFollow(owner, other);

    list(tokenOf(other), "RECIPE", r1)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(1));
  }

  @Test
  @DisplayName("AC-MEDIA-25 · 타인의 PRIVATE 대상은 403이다")
  void 타인의_PRIVATE_대상은_403이다() throws Exception {
    User owner = newUser("media-25a");
    User other = newUser("media-25b");
    Long r1 = recipeId(tokenOf(owner), "PRIVATE");

    list(tokenOf(other), "RECIPE", r1)
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }

  @Test
  @DisplayName("AC-MEDIA-26 · 첨부가 없으면 빈 배열을 반환한다")
  void 첨부가_없으면_빈_배열을_반환한다() throws Exception {
    User owner = newUser("media-26");
    Long r1 = recipeId(tokenOf(owner), "PUBLIC");

    list(tokenOf(owner), "RECIPE", r1)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(0));
  }

  @Test
  @DisplayName("AC-MEDIA-27 · 없는 대상은 404다")
  void 목록조회_없는_대상은_404다() throws Exception {
    User owner = newUser("media-27");

    list(tokenOf(owner), "RECIPE", 999999L)
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  @DisplayName("AC-MEDIA-28 · 토큰 없이 조회하면 401이다")
  void 토큰_없이_조회하면_401이다() throws Exception {
    User owner = newUser("media-28");
    Long r1 = recipeId(tokenOf(owner), "PUBLIC");

    mockMvc
        .perform(
            get("/api/v1/attachments")
                .param("targetType", "RECIPE")
                .param("targetId", String.valueOf(r1)))
        .andExpect(status().isUnauthorized());
  }

  @Test
  @DisplayName("AC-MEDIA-29 · 소유자가 삭제하면 204이고 DB 행과 OCI 객체가 모두 사라진다")
  void 소유자가_삭제하면_204이고_모두_사라진다() throws Exception {
    User owner = newUser("media-29");
    Long r1 = recipeId(tokenOf(owner), "PUBLIC");
    String objectKey = objectKeyFor(tokenOf(owner), "RECIPE", r1, "image/jpeg");
    fakeObjectStorageClient.stubUploaded(objectKey, 100_000L, "image/jpeg");
    String confirmBody =
        confirm(tokenOf(owner), "RECIPE", r1, objectKey, 100, 100)
            .andReturn()
            .getResponse()
            .getContentAsString();
    Long attachmentId = Long.valueOf(JsonPath.read(confirmBody, "$.id").toString());

    mockMvc
        .perform(
            delete("/api/v1/attachments/{id}", attachmentId)
                .header(HttpHeaders.AUTHORIZATION, tokenOf(owner)))
        .andExpect(status().isNoContent());

    assertThat(attachmentRepository.findById(attachmentId)).isEmpty();
    assertThat(fakeObjectStorageClient.head(objectKey)).isEmpty();
  }

  @Test
  @DisplayName("AC-MEDIA-30 · 소유자가 아니면 403이다")
  void 삭제_소유자가_아니면_403이다() throws Exception {
    User owner = newUser("media-30a");
    User other = newUser("media-30b");
    Long r1 = recipeId(tokenOf(owner), "PUBLIC");
    seedAttachment(TargetType.RECIPE, r1, owner.getId(), 1);
    Long attachmentId =
        attachmentRepository
            .findByTargetTypeAndTargetIdOrderBySortOrderAsc(TargetType.RECIPE, r1)
            .get(0)
            .getId();

    mockMvc
        .perform(
            delete("/api/v1/attachments/{id}", attachmentId)
                .header(HttpHeaders.AUTHORIZATION, tokenOf(other)))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    assertThat(attachmentRepository.findById(attachmentId)).isPresent();
  }

  @Test
  @DisplayName("AC-MEDIA-31 · 없는 첨부를 삭제하면 404다")
  void 없는_첨부를_삭제하면_404다() throws Exception {
    User owner = newUser("media-31");

    mockMvc
        .perform(
            delete("/api/v1/attachments/{id}", 999999L)
                .header(HttpHeaders.AUTHORIZATION, tokenOf(owner)))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  @DisplayName("AC-MEDIA-32 · 토큰 없이 삭제하면 401이다")
  void 토큰_없이_삭제하면_401이다() throws Exception {
    User owner = newUser("media-32");
    Long r1 = recipeId(tokenOf(owner), "PUBLIC");
    seedAttachment(TargetType.RECIPE, r1, owner.getId(), 1);
    Long attachmentId =
        attachmentRepository
            .findByTargetTypeAndTargetIdOrderBySortOrderAsc(TargetType.RECIPE, r1)
            .get(0)
            .getId();

    mockMvc
        .perform(delete("/api/v1/attachments/{id}", attachmentId))
        .andExpect(status().isUnauthorized());
  }
}
