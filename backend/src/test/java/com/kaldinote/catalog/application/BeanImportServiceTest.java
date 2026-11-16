package com.kaldinote.catalog.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.kaldinote.AbstractIntegrationTest;
import com.kaldinote.catalog.application.ImportResult.Outcome;
import com.kaldinote.catalog.application.ImportResult.Unmapped;
import com.kaldinote.catalog.domain.BeanMix;
import com.kaldinote.catalog.domain.BeanOrigin;
import com.kaldinote.catalog.domain.BeanProduct;
import com.kaldinote.catalog.domain.RoastLevel;
import com.kaldinote.catalog.domain.Roaster;
import com.kaldinote.catalog.infrastructure.BeanProductRepository;
import com.kaldinote.catalog.infrastructure.CoffeeProcessRepository;
import com.kaldinote.catalog.infrastructure.RoasterRepository;
import com.kaldinote.catalog.infrastructure.VarietyRepository;
import com.kaldinote.crawler.domain.CrawledBean;
import com.kaldinote.crawler.domain.CrawledOrigin;
import com.kaldinote.user.domain.User;
import com.kaldinote.user.infrastructure.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class BeanImportServiceTest extends AbstractIntegrationTest {

  private static final String ROASTER = "커피화 로스터스";
  private static final String NAME = "[커피화 로스터스] 콜롬비아 나리뇨 벨라비스타 게이샤";
  private static final String URL = "https://unspecialty.com/product/detail.html?product_no=920";

  @Autowired private BeanImportService service;
  @Autowired private RoasterRepository roasterRepository;
  @Autowired private BeanProductRepository beanProductRepository;
  @Autowired private VarietyRepository varietyRepository;
  @Autowired private CoffeeProcessRepository processRepository;
  @Autowired private UserRepository userRepository;
  @PersistenceContext private EntityManager entityManager;

  private static CrawledBean bean(String name, String roastRaw, CrawledOrigin origin) {
    return new CrawledBean(ROASTER, name, URL, roastRaw, "로즈마리, 라벤더", List.of(origin));
  }

  private static CrawledOrigin origin(String altitude, String variety, String process) {
    return new CrawledOrigin(
        "Colombia", "Buesaco, Narino", "Bellavista", altitude, variety, process);
  }

  private BeanProduct saved(String name) {
    return saved(ROASTER, name);
  }

  private BeanProduct saved(String roasterName, String name) {
    Long roasterId = roasterRepository.findByName(roasterName).orElseThrow().getId();
    return beanProductRepository.findByRoasterIdAndName(roasterId, name).orElseThrow();
  }

  @Test
  @DisplayName("AC-CRAWL-10 · 새 상품은 크롤러 소유로 생성된다")
  void 새_상품은_크롤러_소유로_생성된다() {
    ImportResult result =
        service.importBean(bean(NAME, "Light #92", origin("2,200m", "Geisha", null)));

    assertThat(result.outcome()).isEqualTo(Outcome.CREATED);
    Roaster roaster = roasterRepository.findByName(ROASTER).orElseThrow();
    assertThat(roaster.isSystem()).isTrue();
    assertThat(roaster.getCreatedByUserId()).isNull();
    BeanProduct product = saved(NAME);
    assertThat(product.isVerified()).isFalse();
    assertThat(product.getCreatedByUserId()).isNull();
    assertThat(product.getBeanMix()).isEqualTo(BeanMix.SINGLE_ORIGIN);
    assertThat(product.getDescription()).isEqualTo("로즈마리, 라벤더");
    assertThat(product.getProductUrl()).isEqualTo(URL);
    assertThat(product.getOrigins()).hasSize(1);
    assertThat(product.getOrigins().get(0).getRatioPercent()).isEqualByComparingTo("100.0");
  }

  @Test
  @DisplayName("AC-CRAWL-11 · 같은 입력을 두 번 넣어도 행 수가 같다")
  void 같은_입력을_두_번_넣어도_행_수가_같다() {
    CrawledBean input = bean(NAME, "Light #92", origin("2,200m", "Geisha", null));
    service.importBean(input);
    long roasters = roasterRepository.count();
    long products = beanProductRepository.count();

    ImportResult second = service.importBean(input);

    assertThat(second.outcome()).isEqualTo(Outcome.UNCHANGED);
    assertThat(roasterRepository.count()).isEqualTo(roasters);
    assertThat(beanProductRepository.count()).isEqualTo(products);
    assertThat(saved(NAME).getOrigins()).hasSize(1);
  }

  @Test
  @DisplayName("AC-CRAWL-12 · Light #92 → LIGHT + Agtron 92")
  void Light_92는_LIGHT와_Agtron_92다() {
    service.importBean(bean(NAME, "Light #92", origin(null, null, null)));

    assertThat(saved(NAME).getRoastLevel()).isEqualTo(RoastLevel.LIGHT);
    assertThat(saved(NAME).getRoastLevelAgtron()).isEqualTo((short) 92);
  }

  @Test
  @DisplayName("AC-CRAWL-13 · Medium Light는 MEDIUM이 아니라 MEDIUM_LIGHT다")
  void medium_light는_MEDIUM_LIGHT다() {
    service.importBean(bean(NAME, "medium light", origin(null, null, null)));

    assertThat(saved(NAME).getRoastLevel()).isEqualTo(RoastLevel.MEDIUM_LIGHT);
    assertThat(saved(NAME).getRoastLevelAgtron()).isNull();
  }

  @Test
  @DisplayName("AC-CRAWL-46 · Agtron이 소수면 배전도는 그대로, Agtron은 정수로 반올림한다")
  void Agtron_소수는_반올림하고_배전도는_매핑한다() {
    ImportResult result =
        service.importBean(bean(NAME, "Medium light #74.6", origin(null, null, null)));

    assertThat(saved(NAME).getRoastLevel()).isEqualTo(RoastLevel.MEDIUM_LIGHT);
    assertThat(saved(NAME).getRoastLevelAgtron()).isEqualTo((short) 75);
    assertThat(result.unmapped()).isEmpty();
  }

  @Test
  @DisplayName("AC-CRAWL-14 · 배전도 원문이 없으면 null로 들어간다")
  void 배전도_원문이_없으면_null이다() {
    ImportResult result = service.importBean(bean(NAME, null, origin(null, null, null)));

    assertThat(result.outcome()).isEqualTo(Outcome.CREATED);
    assertThat(result.unmapped()).isEmpty();
    assertThat(saved(NAME).getRoastLevel()).isNull();
    assertThat(saved(NAME).getRoastLevelAgtron()).isNull();
  }

  @Test
  @DisplayName("AC-CRAWL-15 · 품종·가공 원문이 마스터와 맞으면 FK로 들어간다")
  void 품종_가공이_마스터와_맞으면_FK다() {
    ImportResult result = service.importBean(bean(NAME, null, origin(null, "파카마라", "내추럴")));

    BeanOrigin o = saved(NAME).getOrigins().get(0);
    assertThat(o.getVarietyId())
        .isEqualTo(varietyRepository.findByName("Pacamara").orElseThrow().getId());
    assertThat(o.getProcessId())
        .isEqualTo(
            processRepository.findAll().stream()
                .filter(p -> p.getName().equals("Natural"))
                .findFirst()
                .orElseThrow()
                .getId());
    assertThat(result.unmapped()).isEmpty();
  }

  @Test
  @DisplayName("AC-CRAWL-16 · 마스터에 없는 가공은 null + unmapped")
  void 마스터에_없는_가공은_null과_unmapped다() {
    ImportResult result =
        service.importBean(bean(NAME, null, origin(null, null, "Beer Yeast & Mosto Anaerobic")));

    assertThat(saved(NAME).getOrigins().get(0).getProcessId()).isNull();
    assertThat(result.unmapped())
        .containsExactly(new Unmapped("process", "Beer Yeast & Mosto Anaerobic"));
  }

  @ParameterizedTest
  @CsvSource(
      delimiter = '|',
      nullValues = "null",
      value = {"2,200m|2200|2200", "1,900-2,100m|1900|2100", "약 2천m|null|null"})
  @DisplayName("AC-CRAWL-17 · 고도 원문 세 가지")
  void 고도_원문을_min_max로_바꾼다(String raw, Short min, Short max) {
    service.importBean(bean(NAME, null, origin(raw, null, null)));

    BeanOrigin o = saved(NAME).getOrigins().get(0);
    assertThat(o.getAltitudeMinM()).isEqualTo(min);
    assertThat(o.getAltitudeMaxM()).isEqualTo(max);
  }

  @Test
  @DisplayName("AC-CRAWL-18 · 사용자가 만든 같은 이름의 상품은 건드리지 않는다")
  void 사용자가_만든_상품은_건드리지_않는다() {
    Long userId = userRepository.save(User.create(null, "테스터", null)).getId();
    Long roasterId =
        roasterRepository.save(Roaster.createByUser(ROASTER, null, null, userId)).getId();
    BeanProduct mine =
        BeanProduct.createByUser(
            roasterId,
            NAME,
            BeanMix.SINGLE_ORIGIN,
            RoastLevel.DARK,
            null,
            null,
            false,
            null,
            "내 메모",
            userId);
    mine.attachOrigins(
        List.of(
            BeanOrigin.of("Kenya", null, null, null, null, null, null, new BigDecimal("100.0"))));
    beanProductRepository.save(mine);

    ImportResult result = service.importBean(bean(NAME, "Light #92", origin(null, null, null)));

    assertThat(result.outcome()).isEqualTo(Outcome.SKIPPED);
    assertThat(result.reason()).isEqualTo("USER_OWNED");
    assertThat(saved(NAME).getDescription()).isEqualTo("내 메모");
    assertThat(saved(NAME).getRoastLevel()).isEqualTo(RoastLevel.DARK);
    assertThat(saved(NAME).getOrigins())
        .extracting(BeanOrigin::getCountry)
        .containsExactly("Kenya");
  }

  @Test
  @DisplayName("AC-CRAWL-19 · 블렌드는 산지 없이 들어간다")
  void 블렌드는_산지_없이_들어간다() {
    String blend = "[무우수 커피 로스터스] 패터슨 블렌드 (하우스 블렌드)";

    service.importBean(
        new CrawledBean(ROASTER, blend, URL, null, null, List.of(origin(null, null, null))));

    assertThat(saved(blend).getBeanMix()).isEqualTo(BeanMix.BLEND);
    assertThat(saved(blend).getOrigins()).isEmpty();
  }

  @Test
  void 싱글오리진인데_국가가_없으면_PARSE_FAILED로_건너뛴다() {
    ImportResult result =
        service.importBean(
            new CrawledBean(
                ROASTER,
                NAME,
                URL,
                null,
                null,
                List.of(new CrawledOrigin(null, null, null, null, null, null))));

    assertThat(result.outcome()).isEqualTo(Outcome.SKIPPED);
    assertThat(result.reason()).isEqualTo("PARSE_FAILED");
    assertThat(roasterRepository.findByName(ROASTER)).isEmpty();
  }

  /** 플래그를 켜는 API는 관리자 원두 스펙 몫이라, 여기서는 SQL로 켠다. */
  private void setFlag(String column, String name) {
    entityManager.flush();
    entityManager
        .createNativeQuery("update bean_products set " + column + " = true where name = :n")
        .setParameter("n", name)
        .executeUpdate();
    entityManager.clear();
  }

  @Test
  @DisplayName("AC-BEANDETAIL-02 · 크롤러는 숨김을 건드리지 않는다")
  void 크롤러는_숨김을_건드리지_않는다() {
    CrawledBean input = bean(NAME, "Light #92", origin(null, null, null));
    service.importBean(input);
    setFlag("hidden", NAME);

    ImportResult result = service.importBean(bean(NAME, "Medium", origin(null, null, null)));

    assertThat(result.outcome()).isEqualTo(Outcome.UPDATED);
    assertThat(saved(NAME).isHidden()).isTrue();
  }

  @Test
  @DisplayName("AC-BEANDETAIL-03 · 수동 수정 원두는 구매 링크만 갱신된다")
  void 수동_수정_원두는_구매_링크만_갱신된다() {
    service.importBean(
        new CrawledBean(
            ROASTER,
            NAME,
            "https://a.example/1",
            "Medium Light",
            "관리자 메모",
            List.of(new CrawledOrigin("콜롬비아", null, null, null, null, null))));
    setFlag("manually_edited", NAME);

    ImportResult result =
        service.importBean(
            new CrawledBean(
                ROASTER,
                NAME,
                "https://a.example/2",
                "Light",
                "새 설명",
                List.of(new CrawledOrigin("페루", null, null, null, null, null))));

    assertThat(result.outcome()).isEqualTo(Outcome.UPDATED);
    BeanProduct product = saved(NAME);
    assertThat(product.getProductUrl()).isEqualTo("https://a.example/2");
    assertThat(product.getRoastLevel()).isEqualTo(RoastLevel.MEDIUM_LIGHT);
    assertThat(product.getDescription()).isEqualTo("관리자 메모");
    assertThat(product.getOrigins()).extracting(BeanOrigin::getCountry).containsExactly("콜롬비아");
  }

  @Test
  @DisplayName("AC-CRAWLRESULT-01 · 새 원두는 CREATED와 저장된 id를 돌려준다")
  void 새_원두는_CREATED와_저장된_id를_돌려준다() {
    String name = "원두 케냐 카구뉴 워시드";
    CrawledBean input =
        new CrawledBean(
            "모모스커피",
            name,
            "https://momos.co.kr/Product_CoffeeBeans/?idx=140",
            null,
            "자두, 꿀",
            List.of(new CrawledOrigin("케냐", null, "카구뉴", null, null, "워시드")));

    ImportResult result = service.importBean(input);

    assertThat(result.outcome()).isEqualTo(Outcome.CREATED);
    assertThat(result.beanProductId()).isEqualTo(saved("모모스커피", name).getId());
  }

  @Test
  @DisplayName("AC-CRAWLRESULT-02 · 컵노트만 바뀌면 UPDATED")
  void 컵노트만_바뀌면_UPDATED다() {
    CrawledBean initial =
        new CrawledBean(
            ROASTER, NAME, URL, "Light #92", "자두, 꿀", List.of(origin("2,200m", "Geisha", "워시드")));
    service.importBean(initial);
    entityManager.flush();
    entityManager
        .createNativeQuery(
            "update bean_products set updated_at = updated_at - interval '1 minute'"
                + " where name = :n")
        .setParameter("n", NAME)
        .executeUpdate();
    entityManager.clear();
    BeanProduct before = saved(NAME);
    Long beforeId = before.getId();
    Instant beforeUpdatedAt = before.getUpdatedAt();

    ImportResult result =
        service.importBean(
            new CrawledBean(
                ROASTER,
                NAME,
                URL,
                "Light #92",
                "자두, 꿀, 홍차",
                List.of(origin("2,200m", "Geisha", "워시드"))));
    entityManager.flush();
    entityManager.clear();

    BeanProduct after = saved(NAME);
    assertThat(result.outcome()).isEqualTo(Outcome.UPDATED);
    assertThat(result.beanProductId()).isEqualTo(beforeId);
    assertThat(after.getDescription()).isEqualTo("자두, 꿀, 홍차");
    assertThat(after.getUpdatedAt()).isAfter(beforeUpdatedAt);
  }

  @Test
  @DisplayName("AC-CRAWLRESULT-03 · 값이 전부 같으면 UNCHANGED이고 저장하지 않는다")
  void 값이_전부_같으면_UNCHANGED이고_저장하지_않는다() {
    CrawledBean input =
        new CrawledBean(
            ROASTER, NAME, URL, "Light #92", "자두, 꿀", List.of(origin("2,200m", "Geisha", "워시드")));
    service.importBean(input);
    entityManager.flush();
    entityManager.clear();
    BeanProduct before = saved(NAME);
    Long beforeId = before.getId();
    Instant beforeUpdatedAt = before.getUpdatedAt();
    Long beforeOriginId = before.getOrigins().get(0).getId();

    ImportResult result = service.importBean(input);
    entityManager.flush();
    entityManager.clear();

    BeanProduct after = saved(NAME);
    assertThat(result.outcome()).isEqualTo(Outcome.UNCHANGED);
    assertThat(result.beanProductId()).isEqualTo(beforeId);
    assertThat(after.getUpdatedAt()).isEqualTo(beforeUpdatedAt);
    assertThat(after.getOrigins()).extracting(BeanOrigin::getId).containsExactly(beforeOriginId);
  }

  @Test
  @DisplayName("AC-CRAWLRESULT-04 · 산지 가공만 바뀌어도 UPDATED")
  void 산지_가공만_바뀌어도_UPDATED다() {
    service.importBean(
        new CrawledBean(
            ROASTER, NAME, URL, "Light #92", "자두, 꿀", List.of(origin("2,200m", "Geisha", "워시드"))));

    ImportResult result =
        service.importBean(
            new CrawledBean(
                ROASTER,
                NAME,
                URL,
                "Light #92",
                "자두, 꿀",
                List.of(origin("2,200m", "Geisha", "내추럴"))));

    Long naturalId =
        processRepository.findAll().stream()
            .filter(p -> p.getName().equals("Natural"))
            .findFirst()
            .orElseThrow()
            .getId();
    assertThat(result.outcome()).isEqualTo(Outcome.UPDATED);
    assertThat(saved(NAME).getOrigins().get(0).getProcessId()).isEqualTo(naturalId);
  }

  @Test
  @DisplayName("AC-CRAWLRESULT-05 · 수동 수정 원두는 구매 링크가 바뀔 때만 UPDATED")
  void 수동_수정_원두는_구매_링크가_바뀔_때만_UPDATED다() {
    service.importBean(
        new CrawledBean(
            ROASTER,
            NAME,
            "https://momos.co.kr/Product_CoffeeBeans/?idx=1",
            "Light #92",
            "관리자 값",
            List.of(origin("2,200m", "Geisha", "워시드"))));
    setFlag("manually_edited", NAME);

    ImportResult unchanged =
        service.importBean(
            new CrawledBean(
                ROASTER,
                NAME,
                "https://momos.co.kr/Product_CoffeeBeans/?idx=1",
                "Dark",
                "크롤러 값",
                List.of(origin("2,200m", "Geisha", "내추럴"))));
    assertThat(unchanged.outcome()).isEqualTo(Outcome.UNCHANGED);
    assertThat(saved(NAME).getDescription()).isEqualTo("관리자 값");

    ImportResult updated =
        service.importBean(
            new CrawledBean(
                ROASTER,
                NAME,
                "https://momos.co.kr/Product_CoffeeBeans/?idx=2",
                "Dark",
                "크롤러 값",
                List.of(origin("2,200m", "Geisha", "내추럴"))));
    assertThat(updated.outcome()).isEqualTo(Outcome.UPDATED);
    assertThat(saved(NAME).getProductUrl())
        .isEqualTo("https://momos.co.kr/Product_CoffeeBeans/?idx=2");
    assertThat(saved(NAME).getDescription()).isEqualTo("관리자 값");
  }

  private static CrawledBean at(String name, String url) {
    return new CrawledBean("해월커피", name, url, "Light", null, List.of(origin(null, null, null)));
  }

  private BeanProduct savedAt(String name) {
    Long roasterId = roasterRepository.findByName("해월커피").orElseThrow().getId();
    return beanProductRepository.findByRoasterIdAndName(roasterId, name).orElseThrow();
  }

  @Test
  @DisplayName("AC-ADMINBEAN-20 · 관리자가 이름을 고친 원두는 같은 링크로 다시 찾는다")
  void 관리자가_이름을_고친_원두는_같은_링크로_다시_찾는다() {
    service.importBean(at("에티오피아 반자 위요 내추", "https://u.example/231"));
    entityManager.flush();
    entityManager
        .createNativeQuery("update bean_products set name = :n where product_url = :u")
        .setParameter("n", "에티오피아 반자 위요 내추럴")
        .setParameter("u", "https://u.example/231")
        .executeUpdate();
    entityManager.clear();
    long before = beanProductRepository.count();

    ImportResult result = service.importBean(at("에티오피아 반자 위요 내추", "https://u.example/231"));

    assertThat(result.outcome()).isEqualTo(Outcome.UNCHANGED);
    assertThat(savedAt("에티오피아 반자 위요 내추럴").getProductUrl()).isEqualTo("https://u.example/231");
    assertThat(beanProductRepository.count()).isEqualTo(before);
  }

  @Test
  @DisplayName("AC-ADMINBEAN-21 · 링크로 못 찾으면 로스터 · 이름으로 찾고 링크를 갱신한다")
  void 링크로_못_찾으면_로스터_이름으로_찾고_링크를_갱신한다() {
    service.importBean(at("케냐 키리냐가", "https://u.example/old"));
    long before = beanProductRepository.count();

    ImportResult result = service.importBean(at("케냐 키리냐가", "https://u.example/new"));

    assertThat(result.outcome()).isEqualTo(Outcome.UPDATED);
    assertThat(savedAt("케냐 키리냐가").getProductUrl()).isEqualTo("https://u.example/new");
    assertThat(beanProductRepository.count()).isEqualTo(before);
  }

  @Test
  @DisplayName("AC-ADMINBEAN-22 · 사용자 원두와 링크가 같으면 건너뛴다")
  void 사용자_원두와_링크가_같으면_건너뛴다() {
    Long userId = userRepository.save(User.create(null, "링크", null)).getId();
    Long roasterId = roasterRepository.save(Roaster.createBySystem("해월커피")).getId();
    beanProductRepository.save(
        BeanProduct.createByUser(
            roasterId,
            "내 키리냐가",
            BeanMix.BLEND,
            RoastLevel.DARK,
            null,
            null,
            false,
            "https://u.example/77",
            "내 메모",
            userId));
    long before = beanProductRepository.count();

    ImportResult result = service.importBean(at("케냐 키리냐가", "https://u.example/77"));

    assertThat(result.outcome()).isEqualTo(Outcome.SKIPPED);
    assertThat(result.reason()).isEqualTo("USER_OWNED");
    assertThat(beanProductRepository.count()).isEqualTo(before);
    assertThat(savedAt("내 키리냐가").getDescription()).isEqualTo("내 메모");
  }
}
