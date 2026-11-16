package com.kaldinote.catalog.presentation;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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
import org.springframework.http.MediaType;
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
    List<MockHttpServletRequestBuilder> paths =
        List.of(
            get(BASE),
            get(BASE + "/1"),
            put(BASE + "/1").contentType(MediaType.APPLICATION_JSON).content("{}"),
            post(BASE + "/bulk")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"ids\":[1],\"action\":\"HIDE\"}"),
            post(BASE + "/1/promote"));
    for (MockHttpServletRequestBuilder path : paths) {
      mockMvc.perform(path).andExpect(status().isUnauthorized());
    }
    for (MockHttpServletRequestBuilder path :
        List.of(
            get(BASE),
            get(BASE + "/1"),
            put(BASE + "/1").contentType(MediaType.APPLICATION_JSON).content("{}"),
            post(BASE + "/bulk")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"ids\":[1],\"action\":\"HIDE\"}"),
            post(BASE + "/1/promote"))) {
      mockMvc
          .perform(path.header(HttpHeaders.AUTHORIZATION, userToken))
          .andExpect(status().isForbidden());
    }
  }

  // ── 수정 — PUT /admin/bean-products/{id} (Task 4) ────────────────────────────

  /** 싱글 · 정보 완전한 요청 본문. 필요한 키만 바꿔 쓴다. */
  private String body(Long roasterId, String name, String overrides) {
    return """
        {"name":"%s","roasterId":%d,"beanMix":"SINGLE_ORIGIN","roastLevel":"LIGHT","decaf":false,
         "origins":[{"country":"에티오피아","varietyId":%d,"processId":%d}],
         "verified":false,"hidden":false%s}
        """
        .formatted(name, roasterId, varietyId, processId, overrides);
  }

  private String blend(Long roasterId, String name, String origins) {
    return """
        {"name":"%s","roasterId":%d,"beanMix":"BLEND","roastLevel":"LIGHT","decaf":false,
         "origins":%s,"verified":false,"hidden":false}
        """
        .formatted(name, roasterId, origins);
  }

  private ResultActions update(Long id, String json) throws Exception {
    entityManager.flush();
    entityManager.clear();
    return mockMvc.perform(
        put(BASE + "/" + id)
            .header(HttpHeaders.AUTHORIZATION, admin)
            .contentType(MediaType.APPLICATION_JSON)
            .content(json));
  }

  @Test
  @DisplayName("AC-ADMINBEAN-10 · 빠진 배전도를 채우면 수동 수정됨이 된다")
  void 빠진_배전도를_채우면_수동_수정됨이_된다() throws Exception {
    Long r = roaster("수정 로스터");
    Long id = bean(r, "원두 231", null, false, null).getId();

    update(id, body(r, "원두 231", ",\"roastLevelAgtron\":92"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.roastLevel").value("LIGHT"))
        .andExpect(jsonPath("$.roastLevelAgtron").value(92))
        .andExpect(jsonPath("$.manuallyEdited").value(true))
        .andExpect(jsonPath("$.verified").value(false));
  }

  @Test
  @DisplayName("AC-ADMINBEAN-11 · 상태만 바꾸면 수동 수정됨은 그대로다")
  void 상태만_바꾸면_수동_수정됨은_그대로다() throws Exception {
    Long r = roaster("상태만 로스터");
    Long id = bean(r, "원두 231").getId();

    update(id, body(r, "원두 231", "").replace("\"verified\":false", "\"verified\":true"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.verified").value(true))
        .andExpect(jsonPath("$.manuallyEdited").value(false));
  }

  private Long blendBean(Long roasterId, String name) {
    return beanProductRepository
        .save(
            BeanProduct.createByCrawler(
                roasterId, name, BeanMix.BLEND, RoastLevel.LIGHT, null, null, null))
        .getId();
  }

  @Test
  @DisplayName("AC-ADMINBEAN-12 · 블렌드는 산지 0행 · 비율 없음 · 합 100을 받는다")
  void 블렌드는_산지_0행_비율_없음_합_100을_받는다() throws Exception {
    Long r = roaster("블렌드 로스터");
    Long id = blendBean(r, "블렌드");

    update(id, blend(r, "블렌드", "[]")).andExpect(status().isOk());
    update(id, blend(r, "블렌드", "[{\"country\":\"브라질\"},{\"country\":\"콜롬비아\"}]"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.origins[0].ratioPercent").doesNotExist())
        .andExpect(jsonPath("$.origins[1].ratioPercent").doesNotExist());
    update(
            id,
            blend(
                r,
                "블렌드",
                "[{\"country\":\"브라질\",\"ratioPercent\":50.0},{\"country\":\"콜롬비아\",\"ratioPercent\":50.0}]"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.origins[0].ratioPercent").value(50.0))
        .andExpect(jsonPath("$.origins[1].ratioPercent").value(50.0));
  }

  @ParameterizedTest
  @CsvSource({"49.9,50.0,400", "50.1,50.0,400", "40.0,60.0,200"})
  @DisplayName("AC-ADMINBEAN-41 · 블렌드 비율 합 경계")
  void 블렌드_비율_합_경계(String a, String b, int expected) throws Exception {
    Long r = roaster("비율 로스터");
    Long id = blendBean(r, "비율 블렌드");
    ResultActions result =
        update(
                id,
                blend(
                    r,
                    "비율 블렌드",
                    "[{\"country\":\"브라질\",\"ratioPercent\":%s},{\"country\":\"콜롬비아\",\"ratioPercent\":%s}]"
                        .formatted(a, b)))
            .andExpect(status().is(expected));
    if (expected == 400) {
      result.andExpect(jsonPath("$.code").value("BEAN_ORIGIN_RATIO_MISMATCH"));
    }
  }

  @Test
  @DisplayName("AC-ADMINBEAN-54 · 블렌드 비율 일부만")
  void 블렌드_비율_일부만() throws Exception {
    Long r = roaster("일부 로스터");
    Long id = blendBean(r, "일부 블렌드");
    update(
            id,
            blend(
                r,
                "일부 블렌드",
                "[{\"country\":\"브라질\",\"ratioPercent\":60.0},{\"country\":\"콜롬비아\"}]"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("BEAN_ORIGIN_RATIO_MISMATCH"));
  }

  @Test
  @DisplayName("AC-ADMINBEAN-43 · 싱글 · 블렌드 산지 수 경계")
  void 싱글_블렌드_산지_수_경계() throws Exception {
    Long r = roaster("개수 로스터");
    Long single = bean(r, "싱글").getId();
    Long blendId = blendBean(r, "블렌드 하나");
    String two = "[{\"country\":\"브라질\"},{\"country\":\"콜롬비아\"}]";

    update(single, body(r, "싱글", "").replaceFirst("\"origins\":\\[[^\\]]*\\]", "\"origins\":[]"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("BEAN_MIX_ORIGIN_MISMATCH"));
    update(
            single,
            body(r, "싱글", "").replaceFirst("\"origins\":\\[[^\\]]*\\]", "\"origins\":" + two))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("BEAN_MIX_ORIGIN_MISMATCH"));
    update(blendId, blend(r, "블렌드 하나", "[{\"country\":\"브라질\"}]"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("BEAN_MIX_ORIGIN_MISMATCH"));
  }

  @Test
  @DisplayName("AC-ADMINBEAN-51 · 없는 대상은 404이고 일괄은 아무것도 바꾸지 않는다")
  void 없는_대상은_404다() throws Exception {
    Long r = roaster("없음 로스터");
    Long id = bean(r, "있는 원두").getId();

    list(get(BASE + "/999999"))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    update(999999L, body(r, "없는 원두", ""))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    update(id, body(999999L, "있는 원두", "")).andExpect(status().isNotFound());
    update(id, body(r, "있는 원두", "").replace("\"varietyId\":" + varietyId, "\"varietyId\":999999"))
        .andExpect(status().isNotFound());
    update(id, body(r, "있는 원두", "").replace("\"processId\":" + processId, "\"processId\":999999"))
        .andExpect(status().isNotFound());
  }

  @Test
  @DisplayName("AC-ADMINBEAN-52 · 같은 로스터의 같은 이름")
  void 같은_로스터의_같은_이름() throws Exception {
    Long r = roaster("이름 로스터");
    bean(r, "케냐 키리냐가");
    Long nyeri = bean(r, "케냐 니에리").getId();

    update(nyeri, body(r, "케냐 키리냐가", ""))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("DUPLICATE_NAME"));
  }

  @Test
  @DisplayName("AC-ADMINBEAN-53 · 다른 크롤러 원두의 구매 링크")
  void 다른_크롤러_원두의_구매_링크() throws Exception {
    Long r = roaster("링크 로스터");
    Long owner = userRepository.save(User.create(null, "링크 주인", null)).getId();
    Long ten = bean(r, "원두 10").getId();
    Long eleven = bean(r, "원두 11").getId();
    Long twelve = bean(r, "원두 12", RoastLevel.LIGHT, false, owner).getId();
    sql("update bean_products set product_url = 'https://u.example/10' where id = :id", "id", ten);
    sql(
        "update bean_products set product_url = 'https://u.example/11' where id = :id",
        "id",
        eleven);

    String url = ",\"productUrl\":\"https://u.example/10\"";
    update(eleven, body(r, "원두 11", url))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("BEAN_PRODUCT_URL_DUPLICATE"));
    update(twelve, body(r, "원두 12", url)).andExpect(status().isOk());
  }

  // ── 일괄 · 올리기 (Task 5) ────────────────────────────────────────────────

  private ResultActions bulk(String json) throws Exception {
    entityManager.flush();
    entityManager.clear();
    return mockMvc.perform(
        post(BASE + "/bulk")
            .header(HttpHeaders.AUTHORIZATION, admin)
            .contentType(MediaType.APPLICATION_JSON)
            .content(json));
  }

  private ResultActions promote(Long id) throws Exception {
    entityManager.flush();
    entityManager.clear();
    return mockMvc.perform(
        post(BASE + "/" + id + "/promote").header(HttpHeaders.AUTHORIZATION, admin));
  }

  @Test
  @DisplayName("AC-ADMINBEAN-13 · 일괄 확인 · 숨김 · 숨김 해제")
  void 일괄_확인_숨김_숨김_해제() throws Exception {
    Long r = roaster("일괄 로스터");
    Long one = bean(r, "일괄 1").getId();
    Long two = bean(r, "일괄 2").getId();
    Long three = bean(r, "일괄 3").getId();

    bulk("{\"ids\":[%d,%d,%d],\"action\":\"VERIFY\"}".formatted(one, two, three))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.updated").value(3));
    bulk("{\"ids\":[%d,%d],\"action\":\"HIDE\"}".formatted(one, two))
        .andExpect(jsonPath("$.updated").value(2));
    bulk("{\"ids\":[%d],\"action\":\"UNHIDE\"}".formatted(two))
        .andExpect(jsonPath("$.updated").value(1));

    entityManager.flush();
    entityManager.clear();
    BeanProduct p1 = beanProductRepository.findById(one).orElseThrow();
    org.assertj.core.api.Assertions.assertThat(p1.isHidden()).isTrue();
    org.assertj.core.api.Assertions.assertThat(p1.isVerified()).isTrue();
    org.assertj.core.api.Assertions.assertThat(
            beanProductRepository.findAllById(List.of(one, two, three)))
        .allSatisfy(p -> org.assertj.core.api.Assertions.assertThat(p.isManuallyEdited()).isFalse())
        .filteredOn(p -> !p.getId().equals(one))
        .allSatisfy(p -> org.assertj.core.api.Assertions.assertThat(p.isHidden()).isFalse());
  }

  @ParameterizedTest
  @CsvSource({"0,400", "1,200", "100,200", "101,400"})
  @DisplayName("AC-ADMINBEAN-42 · 일괄 ids 개수 경계")
  void 일괄_ids_개수_경계(int count, int expected) throws Exception {
    Long r = roaster("개수 경계 로스터");
    List<Long> ids = new ArrayList<>();
    for (int i = 0; i < Math.min(count, 100); i++) {
      ids.add(bean(r, "경계 " + i).getId());
    }
    if (count == 101) {
      ids.add(ids.get(0) + 100000); // 개수 검사가 먼저다 — 없는 id여도 400
    }
    String json =
        "{\"ids\":%s,\"action\":\"VERIFY\"}"
            .formatted(ids.stream().map(String::valueOf).toList().toString().replace(" ", ""));
    ResultActions result = bulk(json).andExpect(status().is(expected));
    if (expected == 400) {
      result.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }
  }

  @Test
  void 일괄에_없는_id가_있으면_404이고_아무것도_바꾸지_않는다() throws Exception {
    // AC-ADMINBEAN-51 ③ — 같은 AC의 일괄 경로
    Long one = bean(roaster("일괄 404 로스터"), "일괄 404").getId();

    bulk("{\"ids\":[%d,999999],\"action\":\"HIDE\"}".formatted(one))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    entityManager.flush();
    entityManager.clear();
    org.assertj.core.api.Assertions.assertThat(
            beanProductRepository.findById(one).orElseThrow().isHidden())
        .isFalse();
    promote(999999L).andExpect(status().isNotFound());
  }

  @Test
  @DisplayName("AC-ADMINBEAN-14 · 올린 원두는 다른 사용자 검색에도 나온다")
  void 올린_원두는_다른_사용자_검색에도_나온다() throws Exception {
    Long u1 = userRepository.save(User.create(null, "하나", null)).getId();
    User u2 = userRepository.save(User.create(null, "둘", null));
    String u2Token = "Bearer " + tokenProvider.createAccessToken(u2.getId(), u2.getRole());
    Long id = bean(roaster("올림 로스터"), "하늘 블렌드 A", RoastLevel.LIGHT, false, u1).getId();

    entityManager.flush();
    mockMvc
        .perform(
            get("/api/v1/bean-products")
                .param("q", "하늘")
                .header(HttpHeaders.AUTHORIZATION, u2Token))
        .andExpect(jsonPath("$.content[*].name", empty()));

    promote(id)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.promoted").value(true))
        .andExpect(jsonPath("$.source").value("USER"));

    mockMvc
        .perform(
            get("/api/v1/bean-products")
                .param("q", "하늘")
                .header(HttpHeaders.AUTHORIZATION, u2Token))
        .andExpect(jsonPath("$.content[*].name", contains("하늘 블렌드 A")));
  }

  @Test
  @DisplayName("AC-ADMINBEAN-15 · 올리기는 멱등이다")
  void 올리기는_멱등이다() throws Exception {
    Long owner = userRepository.save(User.create(null, "멱등", null)).getId();
    Long id = bean(roaster("멱등 로스터"), "멱등 원두", RoastLevel.LIGHT, false, owner).getId();

    promote(id).andExpect(status().isOk());
    promote(id).andExpect(status().isOk()).andExpect(jsonPath("$.promoted").value(true));
  }

  @Test
  @DisplayName("AC-ADMINBEAN-55 · 크롤러 원두는 올릴 수 없다")
  void 크롤러_원두는_올릴_수_없다() throws Exception {
    Long id = bean(roaster("크롤러 올림 로스터"), "크롤러 원두").getId();

    promote(id)
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }
}
