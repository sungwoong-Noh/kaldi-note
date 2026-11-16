package com.kaldinote.catalog.presentation;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.kaldinote.AbstractIntegrationTest;
import com.kaldinote.auth.infrastructure.jwt.JwtTokenProvider;
import com.kaldinote.brewlog.domain.BrewLog;
import com.kaldinote.brewlog.domain.BrewLogVisibility;
import com.kaldinote.brewlog.infrastructure.BrewLogRepository;
import com.kaldinote.catalog.domain.BeanMix;
import com.kaldinote.catalog.domain.BeanOrigin;
import com.kaldinote.catalog.domain.BeanProduct;
import com.kaldinote.catalog.domain.CoffeeProcess;
import com.kaldinote.catalog.domain.ProcessCategory;
import com.kaldinote.catalog.domain.RoastLevel;
import com.kaldinote.catalog.domain.Roaster;
import com.kaldinote.catalog.domain.Variety;
import com.kaldinote.catalog.infrastructure.BeanProductRepository;
import com.kaldinote.catalog.infrastructure.CoffeeProcessRepository;
import com.kaldinote.catalog.infrastructure.RoasterRepository;
import com.kaldinote.catalog.infrastructure.VarietyRepository;
import com.kaldinote.inventory.domain.BeanBatch;
import com.kaldinote.inventory.infrastructure.BeanBatchRepository;
import com.kaldinote.user.domain.User;
import com.kaldinote.user.infrastructure.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

/** 관리자 원두 목록 · 상세 API — docs/specs/2026-11-15-admin-beans.md 「목록」 「상세」. */
@Transactional
class AdminBeanProductControllerTest extends AbstractIntegrationTest {

  private static final String BASE = "/api/v1/admin/bean-products";

  @Autowired private JwtTokenProvider tokenProvider;
  @Autowired private UserRepository userRepository;
  @Autowired private RoasterRepository roasterRepository;
  @Autowired private BeanProductRepository beanProductRepository;
  @Autowired private VarietyRepository varietyRepository;
  @Autowired private CoffeeProcessRepository processRepository;
  @Autowired private BrewLogRepository brewLogRepository;
  @Autowired private BeanBatchRepository beanBatchRepository;
  @PersistenceContext private EntityManager entityManager;

  private String admin;
  private Long varietyId;
  private Long processId;

  @BeforeEach
  void setUp() {
    User user = User.create(null, "관리자", null);
    user.promoteToAdmin();
    user = userRepository.save(user);
    admin = "Bearer " + tokenProvider.createAccessToken(user.getId(), user.getRole());
    varietyId = varietyRepository.save(Variety.createByUser("Heirloom A", "에어룸 A", null)).getId();
    processId =
        processRepository
            .save(CoffeeProcess.createByUser("Washed A", null, ProcessCategory.WASHED, null))
            .getId();
  }

  private Long roaster(String name) {
    return roasterRepository.save(Roaster.createBySystem(name)).getId();
  }

  private BeanOrigin full() {
    return BeanOrigin.of(
        "에티오피아", null, null, null, null, varietyId, processId, new BigDecimal("100.0"));
  }

  /** 크롤러 원두(정보 완전). ownerId가 있으면 사용자 원두. */
  private BeanProduct bean(
      Long roasterId, String name, RoastLevel roast, boolean decaf, Long ownerId) {
    BeanProduct p =
        BeanProduct.createByUser(
            roasterId, name, BeanMix.SINGLE_ORIGIN, roast, null, null, decaf, null, null, ownerId);
    p.attachOrigins(new ArrayList<>(List.of(full())));
    return beanProductRepository.save(p);
  }

  private BeanProduct bean(Long roasterId, String name) {
    return bean(roasterId, name, RoastLevel.LIGHT, false, null);
  }

  private void sql(String statement, Object... idAndValue) {
    entityManager.flush();
    var q = entityManager.createNativeQuery(statement);
    for (int i = 0; i < idAndValue.length; i += 2) {
      q.setParameter((String) idAndValue[i], idAndValue[i + 1]);
    }
    q.executeUpdate();
    entityManager.clear();
  }

  private ResultActions list(MockHttpServletRequestBuilder req) throws Exception {
    entityManager.flush();
    return mockMvc.perform(req.header(HttpHeaders.AUTHORIZATION, admin));
  }

  private ResultActions list(String query) throws Exception {
    return list(get(BASE + query));
  }

  @Test
  @DisplayName("AC-ADMINBEAN-01 · 이름 또는 로스터 이름으로 찾는다")
  void 이름_또는_로스터_이름으로_찾는다() throws Exception {
    Long sanchaek = roaster("산책 로스터스");
    bean(sanchaek, "에티오피아 구지 함벨라");
    bean(roaster("해월커피"), "케냐 키리냐가");
    bean(sanchaek, "Ethiopia Guji");

    list("?q=함벨").andExpect(jsonPath("$.content[*].name", contains("에티오피아 구지 함벨라")));
    list("?q=해월").andExpect(jsonPath("$.content[*].name", contains("케냐 키리냐가")));
    list("?q=guji").andExpect(jsonPath("$.content[*].name", contains("Ethiopia Guji")));
  }

  @Test
  @DisplayName("AC-ADMINBEAN-02 · 상태 필터는 숨김이 우선이다")
  void 상태_필터는_숨김이_우선이다() throws Exception {
    Long r = roaster("상태 로스터");
    bean(r, "A");
    Long b = bean(r, "B").getId();
    Long c = bean(r, "C").getId();
    sql("update bean_products set verified = true where id in (:b, :c)", "b", b, "c", c);
    sql("update bean_products set hidden = true where id = :c", "c", c);

    String rq = "&roasterId=" + r;
    list("?status=NEEDS_REVIEW" + rq).andExpect(jsonPath("$.content[*].name", contains("A")));
    list("?status=VERIFIED" + rq).andExpect(jsonPath("$.content[*].name", contains("B")));
    list("?status=HIDDEN" + rq).andExpect(jsonPath("$.content[*].name", contains("C")));
    list("?roasterId=" + r)
        .andExpect(jsonPath("$.content[*].name", containsInAnyOrder("A", "B", "C")));
  }

  @Test
  @DisplayName("AC-ADMINBEAN-03 · 출처·디카페인·로스터 필터는 AND다")
  void 출처_디카페인_로스터_필터는_AND다() throws Exception {
    Long r3 = roaster("로스터 3");
    Long owner = userRepository.save(User.create(null, "원두러버", null)).getId();
    bean(r3, "D1", RoastLevel.LIGHT, true, null);
    bean(r3, "D2", RoastLevel.LIGHT, false, null);
    bean(r3, "U1", RoastLevel.LIGHT, true, owner);

    list("?source=CRAWLER&decaf=true&roasterId=" + r3)
        .andExpect(jsonPath("$.content[*].name", contains("D1")));
    list("?source=USER&roasterId=" + r3)
        .andExpect(jsonPath("$.content[*].name", contains("U1")))
        .andExpect(jsonPath("$.content[0].source").value("USER"))
        .andExpect(jsonPath("$.content[0].creatorNickname").value("원두러버"));
  }

  @Test
  @DisplayName("AC-ADMINBEAN-04 · 「정보 빠짐」 네 경우와 missing 배열")
  void 정보_빠짐_네_경우와_missing_배열() throws Exception {
    Long r = roaster("빠짐 로스터");
    bean(r, "M1", null, false, null);
    BeanProduct m2 =
        BeanProduct.createByCrawler(r, "M2", BeanMix.BLEND, RoastLevel.LIGHT, null, null, null);
    beanProductRepository.save(m2);
    BeanProduct m3 =
        BeanProduct.createByCrawler(
            r, "M3", BeanMix.SINGLE_ORIGIN, RoastLevel.LIGHT, null, null, null);
    m3.attachOrigins(
        new ArrayList<>(
            List.of(
                BeanOrigin.of(
                    "케냐", null, null, null, null, null, processId, new BigDecimal("100.0")))));
    beanProductRepository.save(m3);
    BeanProduct m4 =
        BeanProduct.createByCrawler(r, "M4", BeanMix.BLEND, RoastLevel.LIGHT, null, null, null);
    m4.attachOrigins(
        new ArrayList<>(
            List.of(
                BeanOrigin.of(
                    "브라질", null, null, null, null, varietyId, processId, new BigDecimal("50.0")),
                BeanOrigin.of(
                    "콜롬비아", null, null, null, null, varietyId, null, new BigDecimal("50.0")))));
    beanProductRepository.save(m4);
    bean(r, "F");

    String rq = "&roasterId=" + r;
    list("?missing=true" + rq + "&size=10")
        .andExpect(jsonPath("$.content[*].name", containsInAnyOrder("M1", "M2", "M3", "M4")));
    list("?roasterId=" + r)
        .andExpect(jsonPath("$.content[?(@.name=='M1')].missing[*]", contains("roastLevel")))
        .andExpect(jsonPath("$.content[?(@.name=='M2')].missing[*]", contains("origin")))
        .andExpect(jsonPath("$.content[?(@.name=='M3')].missing[*]", contains("variety")))
        .andExpect(jsonPath("$.content[?(@.name=='M4')].missing[*]", contains("process")))
        .andExpect(jsonPath("$.content[?(@.name=='F')].missing[*]", empty()));
  }

  private void log(Long userId, Long productId, Long batchId, BrewLogVisibility visibility) {
    BrewLog log =
        BrewLog.create(
            userId,
            null,
            null,
            batchId,
            Instant.parse("2026-11-10T00:00:00Z"),
            visibility,
            new BigDecimal("16.0"),
            new BigDecimal("250.0"),
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null);
    log.recordBean(productId, null, null);
    brewLogRepository.save(log);
  }

  @Test
  @DisplayName("AC-ADMINBEAN-05 · 기록 수는 모든 사용자 · 비공개 · 봉투 기록을 센다")
  void 기록_수는_모든_사용자_비공개_봉투_기록을_센다() throws Exception {
    Long r = roaster("기록 로스터");
    Long p45 = bean(r, "원두 45").getId();
    Long other = bean(r, "다른 원두").getId();
    Long u1 = userRepository.save(User.create(null, "하나", null)).getId();
    Long u2 = userRepository.save(User.create(null, "둘", null)).getId();
    Long batch =
        beanBatchRepository
            .save(
                BeanBatch.create(
                    u1, p45, LocalDate.of(2026, 11, 1), null, new BigDecimal("200.0"), null, null))
            .getId();
    log(u2, p45, null, BrewLogVisibility.PRIVATE);
    log(u1, null, batch, BrewLogVisibility.PRIVATE);
    log(u1, p45, null, BrewLogVisibility.PUBLIC);
    log(u1, other, null, BrewLogVisibility.PUBLIC);

    list("?roasterId=" + r)
        .andExpect(jsonPath("$.content[?(@.name=='원두 45')].brewCount", contains(3)))
        .andExpect(jsonPath("$.content[?(@.name=='다른 원두')].brewCount", contains(1)));
  }

  @Test
  @DisplayName("AC-ADMINBEAN-06 · counts는 status · missing을 빼고 나머지 필터를 적용한다")
  void counts는_status_missing을_빼고_나머지_필터를_적용한다() throws Exception {
    Long r3 = roaster("카운트 로스터 3");
    bean(r3, "A", null, false, null);
    Long b = bean(r3, "B").getId();
    Long c = bean(r3, "C").getId();
    bean(roaster("카운트 로스터 5"), "E", null, false, null);
    sql("update bean_products set verified = true where id in (:b, :c)", "b", b, "c", c);
    sql("update bean_products set hidden = true where id = :c", "c", c);

    list("?roasterId=" + r3 + "&status=VERIFIED&missing=true")
        .andExpect(jsonPath("$.counts.all").value(3))
        .andExpect(jsonPath("$.counts.needsReview").value(1))
        .andExpect(jsonPath("$.counts.verified").value(1))
        .andExpect(jsonPath("$.counts.hidden").value(1))
        .andExpect(jsonPath("$.counts.missing").value(1))
        .andExpect(jsonPath("$.counts.missingBy.roastLevel").value(1));
  }

  @Test
  @DisplayName("AC-ADMINBEAN-07 · 수정일 내림차순 20개")
  void 수정일_내림차순_20개() throws Exception {
    Long r = roaster("수정일 로스터");
    List<Long> ids = new ArrayList<>();
    for (int i = 0; i < 25; i++) {
      ids.add(bean(r, "원두 " + i).getId());
    }
    for (int i = 0; i < 25; i++) {
      sql(
          "update bean_products set updated_at = timestamptz '2026-11-01T00:00:00Z' + make_interval(mins => :m) where id = :id",
          "m",
          i,
          "id",
          ids.get(i));
    }
    // 같은 수정일이면 id 큰 것이 앞
    sql(
        "update bean_products set updated_at = timestamptz '2026-11-01T00:24:00Z' where id = :id",
        "id",
        ids.get(23));

    list("")
        .andExpect(jsonPath("$.content", hasSize(20)))
        .andExpect(jsonPath("$.totalElements").value(25))
        .andExpect(jsonPath("$.content[0].id").value(ids.get(24)))
        .andExpect(jsonPath("$.content[1].id").value(ids.get(23)));
  }

  @Test
  @DisplayName("AC-ADMINBEAN-08 · 상세에 산지 이름 · 만든 사람 · 같은 이름 수가 온다")
  void 상세에_산지_이름_만든_사람_같은_이름_수가_온다() throws Exception {
    Long owner = userRepository.save(User.create(null, "원두러버", null)).getId();
    BeanProduct mine =
        BeanProduct.createByUser(
            roaster("내 로스터"),
            "하늘 블렌드",
            BeanMix.BLEND,
            RoastLevel.MEDIUM,
            null,
            null,
            false,
            null,
            null,
            owner);
    mine.attachOrigins(
        new ArrayList<>(
            List.of(
                BeanOrigin.of(
                    "브라질", null, null, null, null, varietyId, processId, new BigDecimal("50.0")),
                BeanOrigin.of(
                    "콜롬비아", null, null, null, null, null, null, new BigDecimal("50.0")))));
    Long id = beanProductRepository.save(mine).getId();
    bean(roaster("남의 로스터"), "하늘 블렌드");

    list(get(BASE + "/" + id))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.source").value("USER"))
        .andExpect(jsonPath("$.creatorNickname").value("원두러버"))
        .andExpect(jsonPath("$.origins[0].varietyName").value("에어룸 A"))
        .andExpect(jsonPath("$.origins[0].processName").value("Washed A"))
        .andExpect(jsonPath("$.origins[1].varietyName").doesNotExist())
        .andExpect(jsonPath("$.origins[1].processName").doesNotExist())
        .andExpect(jsonPath("$.sameNameCount").value(1))
        .andExpect(jsonPath("$.createdAt").exists());
  }

  @ParameterizedTest
  @CsvSource({"50,size=1,200", "51,size=1,400", "0,size=100,200", "0,size=0,400", "0,size=101,400"})
  @DisplayName("AC-ADMINBEAN-40 · q · size 경계")
  void q_size_경계(int qLength, String size, int expected) throws Exception {
    MockHttpServletRequestBuilder req = get(BASE + "?" + size);
    if (qLength > 0) {
      req = req.param("q", "가".repeat(qLength));
    }
    ResultActions result = list(req).andExpect(status().is(expected));
    if (expected == 400) {
      result.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }
  }

  @Test
  void 공백뿐인_q는_조건이_없다() throws Exception {
    bean(roaster("공백 로스터"), "아무 원두");
    list(get(BASE).param("q", "  ")).andExpect(status().isOk());
  }

  @Test
  @DisplayName("AC-ADMINBEAN-50 · 관리자가 아니면 막는다")
  void 관리자가_아니면_막는다() throws Exception {
    User user = userRepository.save(User.create(null, "사용자", null));
    String userToken = "Bearer " + tokenProvider.createAccessToken(user.getId(), user.getRole());
    for (String path : List.of(BASE, BASE + "/1")) {
      mockMvc.perform(get(path)).andExpect(status().isUnauthorized());
      mockMvc
          .perform(get(path).header(HttpHeaders.AUTHORIZATION, userToken))
          .andExpect(status().isForbidden());
    }
  }
}
