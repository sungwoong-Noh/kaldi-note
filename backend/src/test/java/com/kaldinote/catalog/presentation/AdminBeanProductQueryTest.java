package com.kaldinote.catalog.presentation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class AdminBeanProductQueryTest extends AbstractIntegrationTest {

  @Autowired private JwtTokenProvider tokenProvider;
  @Autowired private UserRepository userRepository;
  @Autowired private RoasterRepository roasterRepository;
  @Autowired private BeanProductRepository beanProductRepository;
  @PersistenceContext private EntityManager entityManager;

  @Test
  @DisplayName("AC-ADMINBEAN-60 · 목록 쿼리 수는 페이지 크기와 무관하다")
  void 목록_쿼리_수는_페이지_크기와_무관하다() throws Exception {
    User user = User.create(null, "관리자", null);
    user.promoteToAdmin();
    user = userRepository.save(user);
    String admin = "Bearer " + tokenProvider.createAccessToken(user.getId(), user.getRole());
    Long owner = userRepository.save(User.create(null, "만든 사람", null)).getId();
    List<Long> roasters = new ArrayList<>();
    for (int i = 0; i < 10; i++) {
      roasters.add(roasterRepository.save(Roaster.createBySystem("쿼리 로스터 " + i)).getId());
    }
    List<BeanProduct> beans = new ArrayList<>();
    for (int i = 0; i < 500; i++) {
      BeanProduct p =
          BeanProduct.createByUser(
              roasters.get(i % 10),
              "쿼리 원두 " + i,
              i % 3 == 0 ? BeanMix.SINGLE_ORIGIN : BeanMix.BLEND,
              RoastLevel.LIGHT,
              null,
              null,
              false,
              null,
              null,
              i % 4 == 0 ? owner : null);
      List<BeanOrigin> origins = new ArrayList<>();
      for (int o = 0; o <= i % 3; o++) {
        origins.add(
            BeanOrigin.of("나라 " + o, null, null, null, null, null, null, new BigDecimal("100.0")));
      }
      p.attachOrigins(origins);
      beans.add(p);
    }
    beanProductRepository.saveAll(beans);
    entityManager.flush();
    entityManager.clear();

    Statistics stats =
        entityManager.getEntityManagerFactory().unwrap(SessionFactory.class).getStatistics();
    stats.clear();
    mockMvc
        .perform(
            get("/api/v1/admin/bean-products?size=20").header(HttpHeaders.AUTHORIZATION, admin))
        .andExpect(status().isOk());
    long forTwenty = stats.getPrepareStatementCount();
    entityManager.clear();

    stats.clear();
    mockMvc
        .perform(
            get("/api/v1/admin/bean-products?size=100").header(HttpHeaders.AUTHORIZATION, admin))
        .andExpect(status().isOk());
    long forHundred = stats.getPrepareStatementCount();

    assertThat(forHundred).isEqualTo(forTwenty);
  }
}
