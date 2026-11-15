package com.kaldinote.catalog.presentation;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.kaldinote.AbstractIntegrationTest;
import com.kaldinote.auth.infrastructure.jwt.JwtTokenProvider;
import com.kaldinote.catalog.domain.BeanMix;
import com.kaldinote.catalog.domain.BeanOrigin;
import com.kaldinote.catalog.domain.BeanProduct;
import com.kaldinote.catalog.domain.RoastLevel;
import com.kaldinote.catalog.domain.Roaster;
import com.kaldinote.catalog.infrastructure.BeanProductRepository;
import com.kaldinote.catalog.infrastructure.RoasterRepository;
import com.kaldinote.user.domain.User;
import com.kaldinote.user.infrastructure.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

/** 원두 검색 API — docs/specs/2026-11-15-bean-detail.md 「검색」. */
@Transactional
class BeanProductControllerTest extends AbstractIntegrationTest {

  @Autowired private JwtTokenProvider tokenProvider;
  @Autowired private UserRepository userRepository;
  @Autowired private RoasterRepository roasterRepository;
  @Autowired private BeanProductRepository beanProductRepository;
  @PersistenceContext private EntityManager entityManager;

  private Long userId;
  private String token;

  private void login() {
    User user = userRepository.save(User.create(null, "검색자", null));
    userId = user.getId();
    token = "Bearer " + tokenProvider.createAccessToken(user.getId(), user.getRole());
  }

  private Long roaster(String name) {
    return roasterRepository.save(Roaster.createBySystem(name)).getId();
  }

  private BeanProduct bean(
      Long roasterId,
      String name,
      RoastLevel roast,
      boolean decaf,
      Long ownerId,
      String... countries) {
    BeanProduct p =
        BeanProduct.createByUser(
            roasterId,
            name,
            countries.length > 1 ? BeanMix.BLEND : BeanMix.SINGLE_ORIGIN,
            roast,
            null,
            null,
            decaf,
            null,
            null,
            ownerId);
    List<BeanOrigin> origins = new ArrayList<>();
    for (String c : countries) {
      origins.add(BeanOrigin.of(c, null, null, null, null, null, null, new BigDecimal("100.0")));
    }
    p.attachOrigins(origins);
    return beanProductRepository.save(p);
  }

  private BeanProduct bean(Long roasterId, String name) {
    return bean(roasterId, name, RoastLevel.LIGHT, false, null, "에티오피아");
  }

  private void hide(BeanProduct p) {
    entityManager.flush();
    entityManager
        .createNativeQuery("update bean_products set hidden = true where id = :id")
        .setParameter("id", p.getId())
        .executeUpdate();
    entityManager.clear();
  }

  private ResultActions search(String query) throws Exception {
    entityManager.flush();
    MockHttpServletRequestBuilder req =
        get("/api/v1/bean-products" + query).header(HttpHeaders.AUTHORIZATION, token);
    return mockMvc.perform(req);
  }

  @Test
  @DisplayName("AC-BEANDETAIL-04 · 이름 일부로 찾는다(대소문자 무시)")
  void 이름_일부로_찾는다() throws Exception {
    login();
    Long r = roaster("검색 로스터");
    bean(r, "에티오피아 구지 함벨라");
    bean(r, "Guji Uraga");
    bean(r, "케냐 키린야가 AA");

    search("?q=guji")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[*].name", contains("Guji Uraga")));
    search("?q=구지").andExpect(jsonPath("$.content[*].name", contains("에티오피아 구지 함벨라")));
  }

  @Test
  @DisplayName("AC-BEANDETAIL-05 · 로스터 이름으로도 찾는다")
  void 로스터_이름으로도_찾는다() throws Exception {
    login();
    Long sanchaek = roaster("산책 로스터스");
    bean(sanchaek, "원두 하나");
    bean(sanchaek, "원두 둘");
    bean(roaster("다른 로스터"), "원두 셋");

    search("?q=산책")
        .andExpect(jsonPath("$.content", hasSize(2)))
        .andExpect(jsonPath("$.content[*].roasterName", everyItem(is("산책 로스터스"))));
  }

  @Test
  @DisplayName("AC-BEANDETAIL-06 · 필터는 AND로 걸린다")
  void 필터는_AND로_걸린다() throws Exception {
    login();
    Long r3 = roaster("로스터 3");
    Long r4 = roaster("로스터 4");
    bean(r3, "A", RoastLevel.LIGHT, false, null, "에티오피아");
    bean(r3, "B", RoastLevel.MEDIUM, true, null, "콜롬비아");
    bean(r4, "C", RoastLevel.LIGHT, false, null, "에티오피아");

    search("?roasterId=" + r3 + "&roastLevel=LIGHT&roastLevel=MEDIUM")
        .andExpect(jsonPath("$.content[*].name", contains("A", "B")));
    search("?decaf=true").andExpect(jsonPath("$.content[*].name", contains("B")));
    search("?country=에티오피아&roasterId=" + r4)
        .andExpect(jsonPath("$.content[*].name", contains("C")));
  }

  @Test
  @DisplayName("AC-BEANDETAIL-07 · 이름순으로 페이지를 나눈다")
  void 이름순으로_페이지를_나눈다() throws Exception {
    login();
    Long r = roaster("페이지 로스터");
    // 24개 + 이름이 같은 「원두 01」 하나 = 25개. 같은 이름은 나중에 만든(id가 큰) 쪽이 뒤
    for (int i = 24; i >= 1; i--) {
      bean(r, "원두 %02d".formatted(i));
    }
    BeanProduct sameName = bean(roaster("페이지 로스터 2"), "원두 01");

    search("")
        .andExpect(jsonPath("$.size").value(20))
        .andExpect(jsonPath("$.totalElements").value(25))
        .andExpect(jsonPath("$.totalPages").value(2))
        .andExpect(jsonPath("$.content", hasSize(20)))
        .andExpect(jsonPath("$.content[0].name").value("원두 01"))
        .andExpect(jsonPath("$.content[1].id").value(sameName.getId()))
        .andExpect(jsonPath("$.content[19].name").value("원두 19"));
    search("?page=1")
        .andExpect(jsonPath("$.content", hasSize(5)))
        .andExpect(jsonPath("$.content[4].name").value("원두 24"));
  }

  @Test
  @DisplayName("AC-BEANDETAIL-08 · 숨긴 원두는 검색에 나오지 않는다")
  void 숨긴_원두는_검색에_나오지_않는다() throws Exception {
    login();
    Long r = roaster("숨김 로스터");
    bean(r, "에티오피아 구지 함벨라");
    hide(bean(r, "에티오피아 예가체프 (2025 수확)"));

    search("?q=에티오피아").andExpect(jsonPath("$.content[*].name", contains("에티오피아 구지 함벨라")));
  }

  @Test
  @DisplayName("AC-BEANDETAIL-09 · 남이 만든 사용자 원두는 검색에 나오지 않는다")
  void 남이_만든_사용자_원두는_검색에_나오지_않는다() throws Exception {
    login();
    Long other = userRepository.save(User.create(null, "남", null)).getId();
    Long r = roaster("하늘 로스터");
    bean(r, "하늘 커피 시즌");
    bean(r, "하늘 블렌드 A", RoastLevel.LIGHT, false, userId, "에티오피아");
    bean(r, "하늘 블렌드 B", RoastLevel.LIGHT, false, other, "에티오피아");

    search("?q=하늘").andExpect(jsonPath("$.content[*].name", contains("하늘 블렌드 A", "하늘 커피 시즌")));
  }

  @Test
  @DisplayName("AC-BEANDETAIL-10 · 결과 항목의 국가는 중복 없이 산지 순서다")
  void 결과_항목의_국가는_중복_없이_산지_순서다() throws Exception {
    login();
    Long r = roaster("국가 로스터");
    bean(r, "국가 블렌드", RoastLevel.LIGHT, false, null, "브라질", "콜롬비아", "브라질");
    bean(r, "국가 없음", RoastLevel.LIGHT, false, null);

    search("?q=국가")
        .andExpect(jsonPath("$.content[0].name").value("국가 블렌드"))
        .andExpect(jsonPath("$.content[0].countries", contains("브라질", "콜롬비아")))
        .andExpect(jsonPath("$.content[1].countries", hasSize(0)));
  }

  @Test
  @DisplayName("AC-BEANDETAIL-40 · 공백뿐인 q는 조건이 없다")
  void 공백뿐인_q는_조건이_없다() throws Exception {
    login();
    Long r = roaster("공백 로스터");
    bean(r, "하나");
    bean(r, "둘");
    bean(r, "셋");
    long all = beanProductRepository.count();

    mockMvc
        .perform(
            get("/api/v1/bean-products").param("q", "  ").header(HttpHeaders.AUTHORIZATION, token))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(all));
  }

  @Test
  @DisplayName("AC-BEANDETAIL-41 · q 길이 경계")
  void q_길이_경계() throws Exception {
    login();
    mockMvc
        .perform(
            get("/api/v1/bean-products")
                .param("q", " " + "가".repeat(50) + " ")
                .header(HttpHeaders.AUTHORIZATION, token))
        .andExpect(status().isOk());
    mockMvc
        .perform(
            get("/api/v1/bean-products")
                .param("q", "가".repeat(51))
                .header(HttpHeaders.AUTHORIZATION, token))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @ParameterizedTest
  @CsvSource({"size=1,200", "size=50,200", "size=0,400", "size=51,400", "page=-1,400"})
  @DisplayName("AC-BEANDETAIL-42 · size · page 경계")
  void size_page_경계(String param, int expected) throws Exception {
    login();
    ResultActions result = search("?" + param).andExpect(status().is(expected));
    if (expected == 400) {
      result.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }
  }

  @Test
  @DisplayName("AC-BEANDETAIL-43 · 배전도가 없는 원두는 배전도 필터에서 빠진다")
  void 배전도가_없는_원두는_배전도_필터에서_빠진다() throws Exception {
    login();
    Long r = roaster("배전도 로스터");
    bean(r, "배전도 A", RoastLevel.LIGHT, false, null, "에티오피아");
    bean(r, "배전도 B", null, false, null, "에티오피아");

    search("?q=배전도&roastLevel=LIGHT").andExpect(jsonPath("$.content[*].name", contains("배전도 A")));
    search("?q=배전도").andExpect(jsonPath("$.content[*].name", contains("배전도 A", "배전도 B")));
  }

  @Test
  @DisplayName("AC-BEANDETAIL-50 · 잘못된 배전도 값")
  void 잘못된_배전도_값() throws Exception {
    login();
    search("?roastLevel=LIGHTEST")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  @DisplayName("AC-BEANDETAIL-54 · 인증 없이 검색")
  void 인증_없이_검색() throws Exception {
    mockMvc
        .perform(get("/api/v1/bean-products").param("q", "구지"))
        // 보안 필터의 401은 본문이 없다(docs/specs/2026-09-05-http-error-contract.md)
        .andExpect(status().isUnauthorized());
  }
}
