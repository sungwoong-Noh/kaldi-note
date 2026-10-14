package com.kaldinote.crawler.presentation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.notNullValue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.kaldinote.AbstractIntegrationTest;
import com.kaldinote.auth.infrastructure.jwt.JwtTokenProvider;
import com.kaldinote.crawler.domain.CrawlRun;
import com.kaldinote.crawler.infrastructure.CrawlRunRepository;
import com.kaldinote.crawler.infrastructure.CrawlerFixtures;
import com.kaldinote.crawler.infrastructure.PageFetcher;
import com.kaldinote.user.domain.User;
import com.kaldinote.user.infrastructure.UserRepository;
import java.net.URI;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClientException;

@Transactional
class CrawlAdminControllerTest extends AbstractIntegrationTest {

  private static final URI LIST = URI.create("https://momos.co.kr/Product_CoffeeBeans");

  @Autowired private JwtTokenProvider tokenProvider;
  @Autowired private UserRepository userRepository;
  @Autowired private CrawlRunRepository runRepository;
  @MockitoBean private PageFetcher fetcher;

  private Long adminId;

  private String adminToken() {
    User admin = User.create(null, "관리자", null);
    admin.promoteToAdmin();
    admin = userRepository.save(admin);
    adminId = admin.getId();
    return "Bearer " + tokenProvider.createAccessToken(admin.getId(), admin.getRole());
  }

  private String userToken() {
    User user = userRepository.save(User.create(null, "사용자", null));
    return "Bearer " + tokenProvider.createAccessToken(user.getId(), user.getRole());
  }

  private static MockHttpServletRequestBuilder as(String token, MockHttpServletRequestBuilder req) {
    return req.header(HttpHeaders.AUTHORIZATION, token);
  }

  private CrawlRun finishedRun(String source, String startedAt) {
    CrawlRun run = CrawlRun.start(source, null, Instant.parse(startedAt));
    run.succeed(0, 0, List.of(), List.of(), Instant.parse(startedAt).plusSeconds(60));
    return runRepository.save(run);
  }

  @Test
  @DisplayName("AC-CRAWL-20 · 소스 목록은 마지막 실행을 함께 준다")
  void 소스_목록은_마지막_실행을_함께_준다() throws Exception {
    runRepository.deleteAll();

    mockMvc
        .perform(as(adminToken(), get("/api/v1/admin/crawl-sources")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$", hasSize(2)))
        .andExpect(jsonPath("$[*].key", containsInAnyOrder("momos", "unspecialty")))
        // 전역 non_null 설정 — null인 lastRun은 응답에서 빠진다
        .andExpect(jsonPath("$[0].lastRun").doesNotExist())
        .andExpect(jsonPath("$[1].lastRun").doesNotExist());
  }

  @Test
  @DisplayName("AC-CRAWL-21 · 실행을 시작하면 202, 끝나면 SUCCEEDED")
  void 실행을_시작하면_202_끝나면_SUCCEEDED() throws Exception {
    String token = adminToken();
    String list =
        "<a href=\"/Product_CoffeeBeans/?idx=1\"></a><a href=\"/Product_CoffeeBeans/?idx=2\"></a>";
    String detail = CrawlerFixtures.read("momos-4938.html");
    given(fetcher.get(any()))
        .willAnswer(
            inv -> {
              URI uri = inv.getArgument(0);
              if (uri.equals(LIST)) {
                return list;
              }
              return detail.replace("산 어거스틴", "농장" + uri.getQuery());
            });

    String body =
        mockMvc
            .perform(as(token, post("/api/v1/admin/crawl-sources/momos/runs")))
            .andExpect(status().isAccepted())
            .andExpect(jsonPath("$.status").value("RUNNING"))
            .andExpect(jsonPath("$.id", notNullValue()))
            .andReturn()
            .getResponse()
            .getContentAsString();
    long id = Long.parseLong(body.replaceAll(".*\"id\":(\\d+).*", "$1"));

    mockMvc
        .perform(as(token, get("/api/v1/admin/crawl-runs/" + id)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("SUCCEEDED"))
        .andExpect(jsonPath("$.created").value(2))
        .andExpect(jsonPath("$.finishedAt", notNullValue()));
    assertThat(runRepository.findById(id).orElseThrow().getTriggeredByUserId()).isEqualTo(adminId);
  }

  @Test
  @DisplayName("AC-CRAWL-22 · 실행 이력은 최신순이다")
  void 실행_이력은_최신순이다() throws Exception {
    runRepository.deleteAll();
    finishedRun("momos", "2026-10-14T10:00:00Z");
    finishedRun("momos", "2026-10-14T12:00:00Z");
    finishedRun("momos", "2026-10-14T11:00:00Z");
    finishedRun("unspecialty", "2026-10-14T13:00:00Z");

    mockMvc
        .perform(as(adminToken(), get("/api/v1/admin/crawl-runs").param("source", "momos")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content", hasSize(3)))
        .andExpect(
            jsonPath(
                "$.content[*].startedAt",
                contains("2026-10-14T12:00:00Z", "2026-10-14T11:00:00Z", "2026-10-14T10:00:00Z")))
        .andExpect(jsonPath("$.size").value(20));
  }

  @Test
  @DisplayName("AC-CRAWL-30 · 모르는 소스")
  void 모르는_소스는_404다() throws Exception {
    long before = runRepository.count();

    mockMvc
        .perform(as(adminToken(), post("/api/v1/admin/crawl-sources/nope/runs")))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("CRAWL_SOURCE_NOT_FOUND"));
    assertThat(runRepository.count()).isEqualTo(before);
  }

  @Test
  @DisplayName("AC-CRAWL-31 · 같은 소스가 실행 중이면 거부")
  void 같은_소스가_실행_중이면_409다() throws Exception {
    runRepository.save(CrawlRun.start("momos", null, Instant.now()));
    long before = runRepository.count();

    mockMvc
        .perform(as(adminToken(), post("/api/v1/admin/crawl-sources/momos/runs")))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("CRAWL_ALREADY_RUNNING"));
    assertThat(runRepository.count()).isEqualTo(before);
  }

  @Test
  @DisplayName("AC-CRAWL-32 · 없는 실행")
  void 없는_실행은_404다() throws Exception {
    mockMvc
        .perform(as(adminToken(), get("/api/v1/admin/crawl-runs/999999")))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("CRAWL_RUN_NOT_FOUND"));
  }

  @Test
  @DisplayName("AC-CRAWL-36 · ADMIN이 아니면 403")
  void ADMIN이_아니면_403이다() throws Exception {
    String token = userToken();
    given(fetcher.get(any())).willThrow(new RestClientException("호출되면 안 된다"));

    mockMvc
        .perform(as(token, get("/api/v1/admin/crawl-sources")))
        .andExpect(status().isForbidden());
    mockMvc
        .perform(as(token, post("/api/v1/admin/crawl-sources/momos/runs")))
        .andExpect(status().isForbidden());
    mockMvc.perform(as(token, get("/api/v1/admin/crawl-runs"))).andExpect(status().isForbidden());
    mockMvc.perform(as(token, get("/api/v1/admin/crawl-runs/1"))).andExpect(status().isForbidden());
  }
}
