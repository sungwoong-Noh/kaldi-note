package com.kaldinote.brewlog.presentation;

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
 * AC-HOMECAL-01~14·66~67 — {@code GET /api/v1/brew-logs/calendar}.
 *
 * <p>브루잉 로그는 {@link BrewLogRepository}에 직접 저장한다. {@code BrewLogCreateRequest}의
 * {@code @PastOrPresent}는 DTO 검증이라 도메인 엔티티에는 걸리지 않으므로, 경계값 테스트에 필요한 고정 리터럴 시각(예: {@code
 * 2026-09-19T15:00:00Z})을 실행 시각과 무관하게 쓸 수 있다.
 */
@Transactional
class BrewLogCalendarControllerTest extends AbstractIntegrationTest {

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

  private Long recipeId(User owner, String title) throws Exception {
    return createdId(
        mockMvc.perform(
            post("/api/v1/recipes")
                .header(HttpHeaders.AUTHORIZATION, tokenOf(owner))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"title":"%s","doseG":15.0,"waterG":250.0}
                    """
                        .formatted(title))));
  }

  private Long roasterId(User owner) throws Exception {
    return createdId(
        mockMvc.perform(
            post("/api/v1/roasters")
                .header(HttpHeaders.AUTHORIZATION, tokenOf(owner))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"name":"달력테스트로스터-%s"}
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
                    {"roasterId":%d,"name":"달력테스트상품-%s","beanMix":"SINGLE_ORIGIN",
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
                    {"grinderModelId":%d,"nickname":"달력용 그라인더"}
                    """
                        .formatted(c40Id()))));
  }

  /** 최소 의존관계(레시피·원두·그라인더)를 한 번에 갖춘 픽스처. */
  private record Fixture(Long recipeId, Long beanBatchId, Long userGrinderId) {}

  private Fixture fixtureOf(User owner) throws Exception {
    return fixtureOf(owner, "기본 레시피");
  }

  private Fixture fixtureOf(User owner, String recipeTitle) throws Exception {
    return new Fixture(recipeId(owner, recipeTitle), beanBatchId(owner), userGrinderId(owner));
  }

  /** 공개범위·시각을 자유롭게 지정해 리포지토리에 직접 저장한다. */
  private BrewLog saveBrewLog(
      User owner, Fixture fixture, Instant brewedAt, BrewLogVisibility visibility) {
    BrewLog log =
        BrewLog.create(
            owner.getId(),
            fixture.recipeId(),
            fixture.beanBatchId(),
            brewedAt,
            visibility,
            new BigDecimal("15.0"),
            new BigDecimal("250.0"),
            new BigDecimal("92.0"),
            null,
            null,
            fixture.userGrinderId(),
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
    return brewLogRepository.save(log);
  }

  private ResultActions getCalendar(User caller, String query) throws Exception {
    return mockMvc.perform(
        get("/api/v1/brew-logs/calendar" + query)
            .header(HttpHeaders.AUTHORIZATION, tokenOf(caller)));
  }

  @Test
  @DisplayName("AC-HOMECAL-01 · 기록이 있는 날짜만 담는다")
  void 기록이_있는_날짜만_담는다() throws Exception {
    User me = newUser("me-01");
    Fixture fx = fixtureOf(me);
    saveBrewLog(me, fx, Instant.parse("2026-09-02T01:00:00Z"), BrewLogVisibility.PRIVATE);
    saveBrewLog(me, fx, Instant.parse("2026-09-05T01:00:00Z"), BrewLogVisibility.PRIVATE);

    getCalendar(me, "?month=2026-09")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.days.length()").value(2))
        .andExpect(jsonPath("$.days[0].date").value("2026-09-02"))
        .andExpect(jsonPath("$.days[1].date").value("2026-09-05"));
  }

  @Test
  @DisplayName("AC-HOMECAL-02 · UTC 전날 23시 기록은 KST 다음 날에 집계된다")
  void 자정_전_기록은_다음날에_집계된다() throws Exception {
    User me = newUser("me-02");
    Fixture fx = fixtureOf(me);
    saveBrewLog(me, fx, Instant.parse("2026-09-18T23:00:00Z"), BrewLogVisibility.PRIVATE);

    getCalendar(me, "?month=2026-09")
        .andExpect(jsonPath("$.days.length()").value(1))
        .andExpect(jsonPath("$.days[0].date").value("2026-09-19"));
  }

  @Test
  @DisplayName("AC-HOMECAL-03 · KST 자정 경계가 15:00:00Z에서 갈린다")
  void 경계는_15시에_갈린다() throws Exception {
    User me = newUser("me-03");
    Fixture fx = fixtureOf(me);
    saveBrewLog(me, fx, Instant.parse("2026-09-19T14:59:59Z"), BrewLogVisibility.PRIVATE);
    saveBrewLog(me, fx, Instant.parse("2026-09-19T15:00:00Z"), BrewLogVisibility.PRIVATE);

    getCalendar(me, "?month=2026-09")
        .andExpect(jsonPath("$.days[0].date").value("2026-09-19"))
        .andExpect(jsonPath("$.days[0].count").value(1))
        .andExpect(jsonPath("$.days[1].date").value("2026-09-20"))
        .andExpect(jsonPath("$.days[1].count").value(1));
  }

  @Test
  @DisplayName("AC-HOMECAL-04 · 같은 날 2건이면 항목은 1개이고 count가 2다")
  void 같은_날_2건이면_항목이_1개다() throws Exception {
    User me = newUser("me-04");
    Fixture fx = fixtureOf(me);
    saveBrewLog(me, fx, Instant.parse("2026-09-05T01:00:00Z"), BrewLogVisibility.PRIVATE);
    saveBrewLog(me, fx, Instant.parse("2026-09-05T05:00:00Z"), BrewLogVisibility.PRIVATE);

    getCalendar(me, "?month=2026-09")
        .andExpect(jsonPath("$.days.length()").value(1))
        .andExpect(jsonPath("$.days[0].date").value("2026-09-05"))
        .andExpect(jsonPath("$.days[0].count").value(2));
  }

  @Test
  @DisplayName("AC-HOMECAL-05 · totalCount는 그 달 전체 건수다")
  void totalCount는_전체_건수다() throws Exception {
    User me = newUser("me-05");
    Fixture fx = fixtureOf(me);
    saveBrewLog(me, fx, Instant.parse("2026-09-02T01:00:00Z"), BrewLogVisibility.PRIVATE);
    saveBrewLog(me, fx, Instant.parse("2026-09-05T01:00:00Z"), BrewLogVisibility.PRIVATE);
    saveBrewLog(me, fx, Instant.parse("2026-09-05T05:00:00Z"), BrewLogVisibility.PRIVATE);

    getCalendar(me, "?month=2026-09")
        .andExpect(jsonPath("$.totalCount").value(3))
        .andExpect(jsonPath("$.month").value("2026-09"));
  }

  @Test
  @DisplayName("AC-HOMECAL-06 · days는 date 오름차순이다")
  void days는_오름차순이다() throws Exception {
    User me = newUser("me-06");
    Fixture fx = fixtureOf(me);
    saveBrewLog(me, fx, Instant.parse("2026-09-20T01:00:00Z"), BrewLogVisibility.PRIVATE);
    saveBrewLog(me, fx, Instant.parse("2026-09-02T01:00:00Z"), BrewLogVisibility.PRIVATE);
    saveBrewLog(me, fx, Instant.parse("2026-09-11T01:00:00Z"), BrewLogVisibility.PRIVATE);

    getCalendar(me, "?month=2026-09")
        .andExpect(jsonPath("$.days[0].date").value("2026-09-02"))
        .andExpect(jsonPath("$.days[1].date").value("2026-09-11"))
        .andExpect(jsonPath("$.days[2].date").value("2026-09-20"));
  }

  @Test
  @DisplayName("AC-HOMECAL-07 · 소프트 삭제된 기록은 집계되지 않는다")
  void 소프트_삭제는_집계되지_않는다() throws Exception {
    User me = newUser("me-07");
    Fixture fx = fixtureOf(me);
    saveBrewLog(me, fx, Instant.parse("2026-09-02T01:00:00Z"), BrewLogVisibility.PRIVATE);
    BrewLog deleted =
        saveBrewLog(me, fx, Instant.parse("2026-09-02T05:00:00Z"), BrewLogVisibility.PRIVATE);
    deleted.softDelete();
    brewLogRepository.save(deleted);

    getCalendar(me, "?month=2026-09")
        .andExpect(jsonPath("$.days[0].count").value(1))
        .andExpect(jsonPath("$.totalCount").value(1));
  }

  @Test
  @DisplayName("AC-HOMECAL-08 · 맞팔로우 상대의 FRIENDS 기록이 집계된다")
  void 맞팔로우의_FRIENDS_기록이_집계된다() throws Exception {
    User me = newUser("me-08");
    User other = newUser("other-08");
    mutualFollow(me, other);
    Fixture fx = fixtureOf(other);
    saveBrewLog(other, fx, Instant.parse("2026-09-05T01:00:00Z"), BrewLogVisibility.FRIENDS);

    getCalendar(me, "?userId=" + other.getId() + "&month=2026-09")
        .andExpect(jsonPath("$.totalCount").value(1))
        .andExpect(jsonPath("$.days[0].date").value("2026-09-05"));
  }

  @Test
  @DisplayName("AC-HOMECAL-09 · 맞팔로우가 아니면 PUBLIC만 집계된다")
  void 맞팔이_아니면_공개만_집계된다() throws Exception {
    User me = newUser("me-09");
    User other = newUser("other-09");
    Fixture fx = fixtureOf(other);
    saveBrewLog(other, fx, Instant.parse("2026-09-05T01:00:00Z"), BrewLogVisibility.PUBLIC);
    saveBrewLog(other, fx, Instant.parse("2026-09-06T01:00:00Z"), BrewLogVisibility.FRIENDS);
    saveBrewLog(other, fx, Instant.parse("2026-09-07T01:00:00Z"), BrewLogVisibility.PRIVATE);

    getCalendar(me, "?userId=" + other.getId() + "&month=2026-09")
        .andExpect(jsonPath("$.totalCount").value(1))
        .andExpect(jsonPath("$.days.length()").value(1))
        .andExpect(jsonPath("$.days[0].date").value("2026-09-05"));
  }

  @Test
  @DisplayName("AC-HOMECAL-10 · 존재하지 않는 userId는 200과 빈 결과다")
  void 없는_사용자는_빈_결과다() throws Exception {
    User me = newUser("me-10");

    getCalendar(me, "?userId=999999&month=2026-09")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.days.length()").value(0))
        .andExpect(jsonPath("$.totalCount").value(0));
  }

  @Test
  @DisplayName("AC-HOMECAL-11 · month 형식이 틀리면 400이다")
  void 형식이_틀리면_사백이다() throws Exception {
    User me = newUser("me-11");

    getCalendar(me, "?month=2026-13")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  @DisplayName("AC-HOMECAL-12 · 미래 달은 200과 빈 결과다")
  void 미래_달은_빈_결과다() throws Exception {
    User me = newUser("me-12");
    Fixture fx = fixtureOf(me);
    saveBrewLog(me, fx, Instant.parse("2026-09-02T01:00:00Z"), BrewLogVisibility.PRIVATE);

    getCalendar(me, "?month=2027-01")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.days.length()").value(0))
        .andExpect(jsonPath("$.totalCount").value(0));
  }

  @Test
  @DisplayName("AC-HOMECAL-13 · 토큰이 없으면 401이다")
  void 토큰이_없으면_사백일이다() throws Exception {
    mockMvc
        .perform(get("/api/v1/brew-logs/calendar").param("month", "2026-09"))
        .andExpect(status().isUnauthorized());
  }

  @Test
  @DisplayName("AC-HOMECAL-14 · userId를 생략하면 호출자 본인의 달력이다")
  void userId_생략하면_본인_달력이다() throws Exception {
    User me = newUser("me-14");
    User other = newUser("other-14");
    saveBrewLog(
        me, fixtureOf(me), Instant.parse("2026-09-02T01:00:00Z"), BrewLogVisibility.PRIVATE);
    saveBrewLog(
        other, fixtureOf(other), Instant.parse("2026-09-03T01:00:00Z"), BrewLogVisibility.PUBLIC);

    getCalendar(me, "?month=2026-09")
        .andExpect(jsonPath("$.days.length()").value(1))
        .andExpect(jsonPath("$.days[0].date").value("2026-09-02"));
  }

  @Test
  @DisplayName("AC-HOMECAL-66 · primaryRecipeName은 그날 가장 늦게 내린 기록의 레시피명이다")
  void 대표_레시피는_그날_마지막_기록이다() throws Exception {
    User me = newUser("me-66");
    Fixture v60 = fixtureOf(me, "Hoffmann V60");
    Fixture kasuya = fixtureOf(me, "Kasuya 4:6");
    saveBrewLog(
        me,
        v60,
        Instant.parse("2026-09-04T23:00:00Z"),
        BrewLogVisibility.PRIVATE); // KST 09-05 08:00
    saveBrewLog(
        me,
        kasuya,
        Instant.parse("2026-09-05T05:00:00Z"),
        BrewLogVisibility.PRIVATE); // KST 09-05 14:00

    getCalendar(me, "?month=2026-09")
        .andExpect(jsonPath("$.days[0].primaryRecipeName").value("Kasuya 4:6"));
  }

  @Test
  @DisplayName("AC-HOMECAL-67 · 기록이 없는 날은 days에 항목 자체가 없다")
  void 빈_날은_항목이_없다() throws Exception {
    User me = newUser("me-67");
    saveBrewLog(
        me, fixtureOf(me), Instant.parse("2026-09-02T01:00:00Z"), BrewLogVisibility.PRIVATE);

    getCalendar(me, "?month=2026-09")
        .andExpect(jsonPath("$.days[?(@.date=='2026-09-03')]").isEmpty());
  }
}
