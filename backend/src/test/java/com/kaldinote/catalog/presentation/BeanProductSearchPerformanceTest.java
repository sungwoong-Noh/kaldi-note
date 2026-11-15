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
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class BeanProductSearchPerformanceTest extends AbstractIntegrationTest {

  private static final String[] COUNTRIES = {"에티오피아", "콜롬비아", "케냐", "브라질", "과테말라"};
  private static final RoastLevel[] ROASTS = RoastLevel.values();

  @Autowired private JwtTokenProvider tokenProvider;
  @Autowired private UserRepository userRepository;
  @Autowired private RoasterRepository roasterRepository;
  @Autowired private BeanProductRepository beanProductRepository;
  @PersistenceContext private EntityManager entityManager;

  @Test
  @DisplayName("AC-BEANDETAIL-60 · 검색은 1,000건에서 p95 300ms 이하")
  void 검색은_1000건에서_p95_300ms_이하다() throws Exception {
    User user = userRepository.save(User.create(null, "성능", null));
    String token = "Bearer " + tokenProvider.createAccessToken(user.getId(), user.getRole());
    List<Long> roasters = new ArrayList<>();
    for (int i = 0; i < 20; i++) {
      roasters.add(roasterRepository.save(Roaster.createBySystem("성능 로스터 " + i)).getId());
    }
    List<BeanProduct> beans = new ArrayList<>();
    for (int i = 0; i < 1000; i++) {
      int originCount = i % 3 + 1; // 산지 1~3행
      BeanProduct p =
          BeanProduct.createByCrawler(
              roasters.get(i % roasters.size()),
              COUNTRIES[i % COUNTRIES.length] + " 원두 " + i,
              originCount > 1 ? BeanMix.BLEND : BeanMix.SINGLE_ORIGIN,
              ROASTS[i % ROASTS.length],
              null,
              null,
              null);
      List<BeanOrigin> origins = new ArrayList<>();
      for (int o = 0; o < originCount; o++) {
        origins.add(
            BeanOrigin.of(
                COUNTRIES[(i + o) % COUNTRIES.length],
                null,
                null,
                null,
                null,
                null,
                null,
                new BigDecimal("100.0")));
      }
      p.attachOrigins(origins);
      beans.add(p);
    }
    beanProductRepository.saveAll(beans);
    entityManager.flush();
    entityManager.clear();

    long[] millis = new long[100];
    for (int i = -10; i < 100; i++) {
      entityManager.clear(); // 1차 캐시가 산지 로딩을 가리지 않게
      long start = System.nanoTime();
      mockMvc
          .perform(
              get("/api/v1/bean-products")
                  .param("q", "에티")
                  .param("roastLevel", "LIGHT")
                  .header(HttpHeaders.AUTHORIZATION, token))
          .andExpect(status().isOk());
      if (i >= 0) {
        millis[i] = (System.nanoTime() - start) / 1_000_000;
      }
    }
    Arrays.sort(millis);

    assertThat(millis[94]).as("p95(ms)").isLessThanOrEqualTo(300);
  }
}
