package com.kaldinote.user.presentation;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.kaldinote.AbstractIntegrationTest;
import com.kaldinote.auth.infrastructure.jwt.JwtTokenProvider;
import com.kaldinote.brewlog.domain.BrewLog;
import com.kaldinote.brewlog.domain.BrewLogVisibility;
import com.kaldinote.brewlog.infrastructure.BrewLogRepository;
import com.kaldinote.gear.infrastructure.GrinderModelRepository;
import com.kaldinote.inventory.domain.DegassingStatus;
import com.kaldinote.user.domain.User;
import com.kaldinote.user.infrastructure.UserRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

/**
 * AC-HOMECAL-18~24 — {@code GET /api/v1/users/me/mutual-follows}.
 *
 * <p>users·follows·brew_logs에 실제로 쓰므로 클래스 레벨 {@code @Transactional}이 필수다(FollowControllerTest와 같은
 * 이유 — docs/JOURNAL.md 2026-08-17).
 */
@Transactional
class MutualFollowControllerTest extends AbstractIntegrationTest {

  @Autowired private JwtTokenProvider tokenProvider;
  @Autowired private UserRepository userRepository;
  @Autowired private GrinderModelRepository grinderModelRepository;
  @Autowired private BrewLogRepository brewLogRepository;

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

  private Long createdId(ResultActions actions) throws Exception {
    String body = actions.andReturn().getResponse().getContentAsString();
    return Long.valueOf(JsonPath.read(body, "$.id").toString());
  }

  private Long c40Id() {
    return grinderModelRepository.findByBrandAndName("Comandante", "C40 MK4").orElseThrow().getId();
  }

  private Long recipeId(User owner) throws Exception {
    return createdId(
        mockMvc.perform(
            post("/api/v1/recipes")
                .header(HttpHeaders.AUTHORIZATION, tokenOf(owner))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"title":"맞팔목록테스트","doseG":15.0,"waterG":250.0}
                    """)));
  }

  private Long roasterId(User owner) throws Exception {
    return createdId(
        mockMvc.perform(
            post("/api/v1/roasters")
                .header(HttpHeaders.AUTHORIZATION, tokenOf(owner))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"name":"맞팔목록테스트로스터-%s"}
                    """
                        .formatted(UUID.randomUUID()))));
  }

  private Long beanProductId(User owner) throws Exception {
    return createdId(
        mockMvc.perform(
            post("/api/v1/bean-products")
                .header(HttpHeaders.AUTHORIZATION, tokenOf(owner))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"roasterId":%d,"name":"맞팔목록테스트상품-%s","beanMix":"SINGLE_ORIGIN",
                     "roastLevel":"LIGHT","origins":[{"country":"ET"}]}
                    """
                        .formatted(roasterId(owner), UUID.randomUUID()))));
  }

  private Long beanBatchId(User owner) throws Exception {
    return createdId(
        mockMvc.perform(
            post("/api/v1/bean-batches")
                .header(HttpHeaders.AUTHORIZATION, tokenOf(owner))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"beanProductId":%d,"weightG":200.0,"roastedAt":"2026-08-01"}
                    """
                        .formatted(beanProductId(owner)))));
  }

  private Long userGrinderId(User owner) throws Exception {
    return createdId(
        mockMvc.perform(
            post("/api/v1/gear/user-grinders")
                .header(HttpHeaders.AUTHORIZATION, tokenOf(owner))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"grinderModelId":%d,"nickname":"맞팔목록용 그라인더"}
                    """
                        .formatted(c40Id()))));
  }

  /** owner 명의로 recipeId·beanBatchId·userGrinderId를 한 번에 갖춘 기록을 저장한다. */
  private void saveBrewLog(User owner, Instant brewedAt, BrewLogVisibility visibility)
      throws Exception {
    BrewLog log =
        BrewLog.create(
            owner.getId(),
            recipeId(owner),
            beanBatchId(owner),
            brewedAt,
            visibility,
            new BigDecimal("15.0"),
            new BigDecimal("250.0"),
            new BigDecimal("92.0"),
            null,
            null,
            userGrinderId(owner),
            new BigDecimal("22.0"),
            null,
            null,
            null,
            10,
            DegassingStatus.IDEAL.name(),
            null,
            null,
            null,
            null,
            null,
            null,
            null);
    brewLogRepository.save(log);
  }

  private ResultActions getMutualFollows(User caller) throws Exception {
    return mockMvc.perform(
        get("/api/v1/users/me/mutual-follows").header(HttpHeaders.AUTHORIZATION, tokenOf(caller)));
  }

  @Test
  @DisplayName("AC-HOMECAL-18 · 맞팔로우인 사람만 담긴다")
  void 맞팔로우만_담는다() throws Exception {
    User me = newUser("mutual-18-me");
    User mutual = newUser("mutual-18-mutual");
    User onlyIFollow = newUser("mutual-18-only-i-follow");
    User onlyFollowsMe = newUser("mutual-18-only-follows-me");
    mutualFollow(me, mutual);
    follow(me, onlyIFollow);
    follow(onlyFollowsMe, me);

    getMutualFollows(me)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(1))
        .andExpect(jsonPath("$[0].id").value(mutual.getId()));
  }

  @Test
  @DisplayName("AC-HOMECAL-19 · 마지막 기록이 최근인 순으로 정렬된다")
  void 마지막_기록이_최근인_순으로_정렬된다() throws Exception {
    User me = newUser("mutual-19-me");
    User a = newUser("mutual-19-a");
    User b = newUser("mutual-19-b");
    mutualFollow(me, a);
    mutualFollow(me, b);
    saveBrewLog(a, Instant.parse("2026-09-10T01:00:00Z"), BrewLogVisibility.PUBLIC);
    saveBrewLog(b, Instant.parse("2026-09-18T01:00:00Z"), BrewLogVisibility.PUBLIC);

    getMutualFollows(me)
        .andExpect(jsonPath("$[0].id").value(b.getId()))
        .andExpect(jsonPath("$[1].id").value(a.getId()));
  }

  @Test
  @DisplayName("AC-HOMECAL-20 · 기록이 없는 맞팔로우는 맨 뒤에 닉네임 오름차순으로 놓인다")
  void 무기록자는_맨_뒤에_이름순이다() throws Exception {
    User me = newUser("mutual-20-me");
    User 지연 = newUser("지연");
    User 하은 = newUser("하은");
    User 민재 = newUser("민재");
    mutualFollow(me, 지연);
    mutualFollow(me, 하은);
    mutualFollow(me, 민재);
    saveBrewLog(지연, Instant.parse("2026-09-10T01:00:00Z"), BrewLogVisibility.PUBLIC);

    getMutualFollows(me)
        .andExpect(jsonPath("$[0].id").value(지연.getId()))
        .andExpect(jsonPath("$[1].id").value(민재.getId()))
        .andExpect(jsonPath("$[2].id").value(하은.getId()));
  }

  @Test
  @DisplayName("AC-HOMECAL-21 · 마지막 기록 시각이 같으면 닉네임 오름차순이다")
  void 시각이_같으면_이름순이다() throws Exception {
    User me = newUser("mutual-21-me");
    User 하은 = newUser("하은-21");
    User 민재 = newUser("민재-21");
    mutualFollow(me, 하은);
    mutualFollow(me, 민재);
    Instant same = Instant.parse("2026-09-10T01:00:00Z");
    saveBrewLog(하은, same, BrewLogVisibility.PUBLIC);
    saveBrewLog(민재, same, BrewLogVisibility.PUBLIC);

    getMutualFollows(me)
        .andExpect(jsonPath("$[0].id").value(민재.getId()))
        .andExpect(jsonPath("$[1].id").value(하은.getId()));
  }

  @Test
  @DisplayName("AC-HOMECAL-22 · 응답에 email과 role이 없다")
  void 이메일과_역할을_안_내보낸다() throws Exception {
    User me = newUser("mutual-22-me");
    User other = newUser("mutual-22-other");
    mutualFollow(me, other);

    getMutualFollows(me)
        .andExpect(jsonPath("$[0].email").doesNotExist())
        .andExpect(jsonPath("$[0].role").doesNotExist())
        .andExpect(jsonPath("$[0].createdAt").doesNotExist());
  }

  @Test
  @DisplayName("AC-HOMECAL-23 · 자기 자신은 목록에 없다")
  void 자기_자신은_없다() throws Exception {
    User me = newUser("mutual-23-me");
    User other = newUser("mutual-23-other");
    mutualFollow(me, other);

    getMutualFollows(me).andExpect(jsonPath("$[?(@.id=='" + me.getId() + "')]").isEmpty());
  }

  @Test
  @DisplayName("AC-HOMECAL-24 · 토큰이 없으면 401이다")
  void 토큰이_없으면_사백일이다() throws Exception {
    mockMvc.perform(get("/api/v1/users/me/mutual-follows")).andExpect(status().isUnauthorized());
  }
}
