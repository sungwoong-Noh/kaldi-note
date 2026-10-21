package com.kaldinote.crawler.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.kaldinote.AbstractIntegrationTest;
import com.kaldinote.catalog.application.BeanImportService;
import com.kaldinote.crawler.domain.CrawlRun;
import com.kaldinote.crawler.domain.CrawlRunStatus;
import com.kaldinote.crawler.domain.SkippedItem;
import com.kaldinote.crawler.infrastructure.CrawlRunRepository;
import com.kaldinote.crawler.infrastructure.CrawlerFixtures;
import com.kaldinote.crawler.infrastructure.MomosSource;
import com.kaldinote.crawler.infrastructure.PageFetcher;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

@Transactional
class CrawlRunServiceTest extends AbstractIntegrationTest {

  private static final String LIST = "https://momos.co.kr/Product_CoffeeBeans";
  private static final String DETAIL = "https://momos.co.kr/Product_CoffeeBeans/?idx=";

  @Autowired private CrawlRunRepository runRepository;
  @Autowired private BeanImportService importService;

  private MockRestServiceServer server;
  private final List<Duration> sleeps = new ArrayList<>();
  private CrawlRunService service;

  @BeforeEach
  void setUp() {
    RestClient.Builder builder = RestClient.builder();
    server = MockRestServiceServer.bindTo(builder).build();
    service =
        new CrawlRunService(
            List.of(new MomosSource()),
            runRepository,
            importService,
            new PageFetcher(builder.build()),
            Runnable::run,
            sleeps::add);
  }

  /** 상세 n개를 가리키는 목록. 목록 파싱 자체는 실제 픽스처로 MomosSourceTest가 검증한다. */
  private static String listOf(int n) {
    StringBuilder html = new StringBuilder("<html><body>");
    for (int i = 1; i <= n; i++) {
      html.append("<a href=\"/Product_CoffeeBeans/?idx=").append(i).append("\">상품</a>");
    }
    return html.append("</body></html>").toString();
  }

  /** 실제 상세 픽스처에서 상품명만 바꿔, 서로 다른 상품 n개를 만든다. */
  private static String detail(int i) {
    return CrawlerFixtures.read("momos-4938.html").replace("산 어거스틴", "농장" + i);
  }

  private void expectList(int n) {
    server.expect(requestTo(LIST)).andRespond(withSuccess(listOf(n), MediaType.TEXT_HTML));
  }

  private void expectDetail(int i) {
    server.expect(requestTo(DETAIL + i)).andRespond(withSuccess(detail(i), MediaType.TEXT_HTML));
  }

  private CrawlRun reload(Long id) {
    return runRepository.findById(id).orElseThrow();
  }

  @Test
  @DisplayName("AC-CRAWL-34 · 목록 요청이 실패하면 실행이 FAILED")
  void 목록_요청이_실패하면_FAILED다() {
    server.expect(requestTo(LIST)).andRespond(withServerError());

    Long id = service.start("momos", null).id();

    CrawlRun run = reload(id);
    assertThat(run.getStatus()).isEqualTo(CrawlRunStatus.FAILED);
    assertThat(run.getErrorMessage()).isNotBlank();
    assertThat(run.getCreatedCount()).isZero();
    assertThat(run.getFinishedAt()).isNotNull();
  }

  @Test
  @DisplayName("AC-CRAWL-35 · 상세 하나가 실패해도 나머지는 들어간다")
  void 상세_하나가_실패해도_나머지는_들어간다() {
    expectList(3);
    expectDetail(1);
    server.expect(requestTo(DETAIL + 2)).andRespond(withServerError());
    expectDetail(3);

    Long id = service.start("momos", null).id();

    CrawlRun run = reload(id);
    assertThat(run.getStatus()).isEqualTo(CrawlRunStatus.SUCCEEDED);
    assertThat(run.getCreatedCount()).isEqualTo(2);
    assertThat(run.getSkipped()).containsExactly(new SkippedItem(DETAIL + 2, "FETCH_FAILED"));
    server.verify();
  }

  @Test
  @DisplayName("AC-CRAWL-37 · 목록에서 상품을 하나도 찾지 못하면 FAILED")
  void 목록이_비면_FAILED다() {
    expectList(0);

    Long id = service.start("momos", null).id();

    CrawlRun run = reload(id);
    assertThat(run.getStatus()).isEqualTo(CrawlRunStatus.FAILED);
    assertThat(run.getErrorMessage()).isEqualTo("목록에서 상품 링크를 찾지 못했습니다");
    assertThat(sleeps).isEmpty();
    server.verify();
  }

  @Test
  @DisplayName("AC-CRAWL-38 · 원두로 인식한 상품이 하나도 없으면 FAILED")
  void 원두가_하나도_없으면_FAILED다() {
    expectList(2);
    server
        .expect(requestTo(DETAIL + 1))
        .andRespond(withSuccess("<html></html>", MediaType.TEXT_HTML));
    server
        .expect(requestTo(DETAIL + 2))
        .andRespond(withSuccess("<html></html>", MediaType.TEXT_HTML));

    Long id = service.start("momos", null).id();

    CrawlRun run = reload(id);
    assertThat(run.getStatus()).isEqualTo(CrawlRunStatus.FAILED);
    assertThat(run.getErrorMessage()).isEqualTo("원두로 인식한 상품이 없습니다 (상품 2개)");
    assertThat(run.getCreatedCount()).isZero();
    server.verify();
  }

  @Test
  @DisplayName("AC-CRAWL-40 · 요청 사이에 1000ms 쉰다")
  void 요청_사이에_1000ms_쉰다() {
    expectList(2);
    expectDetail(1);
    expectDetail(2);

    service.start("momos", null);

    assertThat(sleeps).containsExactly(Duration.ofMillis(1000), Duration.ofMillis(1000));
  }

  @Test
  @DisplayName("AC-CRAWL-23 · 앱이 뜰 때 남은 RUNNING은 INTERRUPTED가 된다")
  void 남은_RUNNING은_INTERRUPTED가_된다() {
    Long id = runRepository.save(CrawlRun.start("momos", null, Instant.now())).getId();

    service.interruptLeftovers();

    assertThat(reload(id).getStatus()).isEqualTo(CrawlRunStatus.INTERRUPTED);
    assertThat(reload(id).getFinishedAt()).isNotNull();
  }
}
