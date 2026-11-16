package com.kaldinote.crawler.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.kaldinote.AbstractIntegrationTest;
import com.kaldinote.catalog.application.BeanImportService;
import com.kaldinote.catalog.domain.BeanMix;
import com.kaldinote.catalog.domain.BeanProduct;
import com.kaldinote.catalog.domain.RoastLevel;
import com.kaldinote.catalog.domain.Roaster;
import com.kaldinote.catalog.infrastructure.BeanProductRepository;
import com.kaldinote.catalog.infrastructure.RoasterRepository;
import com.kaldinote.crawler.domain.CrawlRun;
import com.kaldinote.crawler.domain.CrawlRunStatus;
import com.kaldinote.crawler.domain.ImportedItem;
import com.kaldinote.crawler.domain.MasterNames;
import com.kaldinote.crawler.domain.SkippedItem;
import com.kaldinote.crawler.infrastructure.CrawlRunRepository;
import com.kaldinote.crawler.infrastructure.CrawlerFixtures;
import com.kaldinote.crawler.infrastructure.MomosSource;
import com.kaldinote.crawler.infrastructure.PageFetcher;
import com.kaldinote.crawler.infrastructure.PageFetcher.RelaySettings;
import com.kaldinote.user.domain.User;
import com.kaldinote.user.infrastructure.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.net.URI;
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
  private static final String LIST_PAGE_2 =
      "https://momos.co.kr/Product_CoffeeBeans/?&page=2&sort=recent";
  private static final String DETAIL = "https://momos.co.kr/Product_CoffeeBeans/?idx=";

  @Autowired private CrawlRunRepository runRepository;
  @Autowired private BeanImportService importService;
  @Autowired private RoasterRepository roasterRepository;
  @Autowired private BeanProductRepository beanProductRepository;
  @Autowired private UserRepository userRepository;
  @PersistenceContext private EntityManager entityManager;

  private final MomosSource momosSource = new MomosSource();
  private MockRestServiceServer server;
  private final List<Duration> sleeps = new ArrayList<>();
  private CrawlRunService service;

  @BeforeEach
  void setUp() {
    RestClient.Builder builder = RestClient.builder();
    server = MockRestServiceServer.bindTo(builder).build();
    service =
        new CrawlRunService(
            List.of(momosSource),
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

  @Test
  @DisplayName("AC-RELAY-27 · 중계 설정이 비어 있으면 모모스 실행은 FAILED")
  void 중계_설정이_비어_있으면_모모스_실행은_FAILED다() {
    RestClient.Builder relayBuilder = RestClient.builder();
    MockRestServiceServer relayServer = MockRestServiceServer.bindTo(relayBuilder).build();
    CrawlRunService unconfigured =
        new CrawlRunService(
            List.of(new MomosSource()),
            runRepository,
            importService,
            new PageFetcher(
                relayBuilder.build(), new RelaySettings("", "t0ken", List.of("momos.co.kr"))),
            Runnable::run,
            sleeps::add);

    Long id = unconfigured.start("momos", null).id();

    CrawlRun run = reload(id);
    assertThat(run.getStatus()).isEqualTo(CrawlRunStatus.FAILED);
    assertThat(run.getErrorMessage()).isEqualTo("목록 요청 실패: 중계 설정 없음: momos.co.kr");
    relayServer.verify();
  }

  @Test
  @DisplayName("2페이지가 있으면 두 페이지 상세를 모두 요청하고 중복 URL은 한 번만 요청한다")
  void 두_페이지_상세를_중복_없이_모두_요청한다() {
    String page1 =
        "<html><body>"
            + "<a href=\"/Product_CoffeeBeans/?idx=1\">상품1</a>"
            + "<a href=\"/Product_CoffeeBeans/?idx=2\">상품2</a>"
            + "<a href=\"/Product_CoffeeBeans/?&page=1&sort=recent\">1</a>"
            + "<a href=\"/Product_CoffeeBeans/?&page=2&sort=recent\">2</a>"
            + "</body></html>";
    String page2 =
        "<html><body>"
            + "<a href=\"/Product_CoffeeBeans/?idx=2\">상품2</a>"
            + "<a href=\"/Product_CoffeeBeans/?idx=3\">상품3</a>"
            + "</body></html>";
    server.expect(requestTo(LIST)).andRespond(withSuccess(page1, MediaType.TEXT_HTML));
    server.expect(requestTo(LIST_PAGE_2)).andRespond(withSuccess(page2, MediaType.TEXT_HTML));
    expectDetail(1);
    expectDetail(2);
    expectDetail(3);

    Long id = service.start("momos", null).id();

    CrawlRun run = reload(id);
    assertThat(run.getStatus()).isEqualTo(CrawlRunStatus.SUCCEEDED);
    assertThat(run.getCreatedCount()).isEqualTo(3);
    assertThat(sleeps)
        .containsExactly(
            Duration.ofMillis(1000),
            Duration.ofMillis(1000),
            Duration.ofMillis(1000),
            Duration.ofMillis(1000));
    server.verify();
  }

  @Test
  @DisplayName("추가 목록 페이지 요청이 실패하면 실행이 FAILED")
  void 추가_목록_페이지_요청이_실패하면_FAILED다() {
    String page1 =
        "<html><body>"
            + "<a href=\"/Product_CoffeeBeans/?idx=1\">상품1</a>"
            + "<a href=\"/Product_CoffeeBeans/?&page=2&sort=recent\">2</a>"
            + "</body></html>";
    server.expect(requestTo(LIST)).andRespond(withSuccess(page1, MediaType.TEXT_HTML));
    server.expect(requestTo(LIST_PAGE_2)).andRespond(withServerError());

    Long id = service.start("momos", null).id();

    CrawlRun run = reload(id);
    assertThat(run.getStatus()).isEqualTo(CrawlRunStatus.FAILED);
    assertThat(run.getErrorMessage()).startsWith("목록 요청 실패");
    assertThat(run.getCreatedCount()).isZero();
    server.verify();
  }

  private Long importMomosBean(int i) {
    MasterNames names = importService.masterNames();
    return importService
        .importBean(momosSource.parseDetail(URI.create(DETAIL + i), detail(i), names).orElseThrow())
        .beanProductId();
  }

  private Long momosProductId(String name) {
    Long roasterId = roasterRepository.findByName("모모스커피").orElseThrow().getId();
    return beanProductRepository.findByRoasterIdAndName(roasterId, name).orElseThrow().getId();
  }

  private Long runSixBeansScenario() {
    for (int i = 3; i <= 6; i++) {
      importMomosBean(i);
    }
    expectList(6);
    expectDetail(1);
    expectDetail(2);
    server
        .expect(requestTo(DETAIL + 3))
        .andRespond(
            withSuccess(
                detail(3).replace("적포도, 블랙커런트, 건 무화과, 발효차, 와인같은", "적포도, 홍차"), MediaType.TEXT_HTML));
    expectDetail(4);
    expectDetail(5);
    expectDetail(6);
    return service.start("momos", null).id();
  }

  @Test
  @DisplayName("AC-CRAWLRESULT-06 · 실행이 생성 · 갱신 목록과 변화 없음 건수를 저장한다")
  void 실행이_생성_갱신_목록과_변화_없음_건수를_저장한다() {
    Long id = runSixBeansScenario();

    CrawlRun run = reload(id);
    String name1 = "원두 에콰도르 농장1 파카마라 내추럴";
    String name2 = "원두 에콰도르 농장2 파카마라 내추럴";
    String name3 = "원두 에콰도르 농장3 파카마라 내추럴";
    assertThat(run.getStatus()).isEqualTo(CrawlRunStatus.SUCCEEDED);
    assertThat(run.getCreatedCount()).isEqualTo(2);
    assertThat(run.getUpdatedCount()).isEqualTo(1);
    assertThat(run.getUnchangedCount()).isEqualTo(3);
    assertThat(run.getImported())
        .containsExactly(
            new ImportedItem(momosProductId(name1), name1, "CREATED"),
            new ImportedItem(momosProductId(name2), name2, "CREATED"),
            new ImportedItem(momosProductId(name3), name3, "UPDATED"));
    server.verify();
  }

  @Test
  @DisplayName("AC-CRAWLRESULT-12 · 이름은 수집 시점 값이다")
  void 이름은_수집_시점_값이다() {
    Long id = runSixBeansScenario();
    String originalName = "원두 에콰도르 농장1 파카마라 내추럴";
    Long productId = momosProductId(originalName);
    entityManager
        .createNativeQuery("update bean_products set name = '바뀐 이름' where id = :id")
        .setParameter("id", productId)
        .executeUpdate();
    entityManager.flush();
    entityManager.clear();

    CrawlRunResponse response = service.run(id);

    assertThat(response.imported().get(0).name()).isEqualTo(originalName);
  }

  @Test
  @DisplayName("AC-CRAWLRESULT-20 · 실패한 실행은 목록이 비어 있다")
  void 실패한_실행은_목록이_비어_있다() {
    server.expect(requestTo(LIST)).andRespond(withServerError());

    Long id = service.start("momos", null).id();

    CrawlRun run = reload(id);
    assertThat(run.getStatus()).isEqualTo(CrawlRunStatus.FAILED);
    assertThat(run.getImported()).isEmpty();
    assertThat(run.getUnchangedCount()).isZero();
  }

  @Test
  @DisplayName("AC-CRAWLRESULT-21 · 건너뛴 원두는 imported에 없다")
  void 건너뛴_원두는_imported에_없다() {
    Long userId = userRepository.save(User.create(null, "소유자", null)).getId();
    Long roasterId = roasterRepository.save(Roaster.createBySystem("모모스커피")).getId();
    String userBeanName = "원두 에콰도르 농장2 파카마라 내추럴";
    beanProductRepository.save(
        BeanProduct.createByUser(
            roasterId,
            userBeanName,
            BeanMix.SINGLE_ORIGIN,
            RoastLevel.LIGHT,
            null,
            null,
            false,
            null,
            null,
            userId));
    expectList(2);
    expectDetail(1);
    expectDetail(2);

    Long id = service.start("momos", null).id();

    CrawlRun run = reload(id);
    String name1 = "원두 에콰도르 농장1 파카마라 내추럴";
    assertThat(run.getImported())
        .containsExactly(new ImportedItem(momosProductId(name1), name1, "CREATED"));
    assertThat(run.getSkipped()).containsExactly(new SkippedItem(userBeanName, "USER_OWNED"));
    assertThat(run.getUnchangedCount()).isZero();
    server.verify();
  }

  @Test
  @DisplayName("모두 UNCHANGED여도 원두로 인식한 상품이므로 SUCCEEDED다")
  void 모두_UNCHANGED여도_SUCCEEDED다() {
    importMomosBean(1);
    importMomosBean(2);
    expectList(2);
    expectDetail(1);
    expectDetail(2);

    Long id = service.start("momos", null).id();

    CrawlRun run = reload(id);
    assertThat(run.getStatus()).isEqualTo(CrawlRunStatus.SUCCEEDED);
    assertThat(run.getCreatedCount()).isZero();
    assertThat(run.getUpdatedCount()).isZero();
    assertThat(run.getUnchangedCount()).isEqualTo(2);
    assertThat(run.getImported()).isEmpty();
    server.verify();
  }
}
