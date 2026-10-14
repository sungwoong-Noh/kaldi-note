package com.kaldinote.crawler.infrastructure;

import static com.kaldinote.crawler.infrastructure.CrawlerFixtures.SEED_NAMES;
import static com.kaldinote.crawler.infrastructure.CrawlerFixtures.read;
import static org.assertj.core.api.Assertions.assertThat;

import com.kaldinote.crawler.domain.CrawledBean;
import com.kaldinote.crawler.domain.CrawledOrigin;
import java.net.URI;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class UnspecialtySourceTest {

  private final UnspecialtySource source = new UnspecialtySource();

  @Test
  @DisplayName("AC-CRAWL-03 · 언스페셜티 sitemap에서 상품 URL을 모은다")
  void sitemap에서_상품_URL_132개를_모은다() {
    List<URI> urls = source.parseList(read("unspecialty-sitemap.xml"));

    assertThat(urls).hasSize(132);
    assertThat(urls).allSatisfy(u -> assertThat(u.toString()).contains("/product/"));
  }

  @Test
  @DisplayName("AC-CRAWL-04 · 언스페셜티 상세의 스펙 표를 읽는다")
  void 상세의_스펙_표를_읽는다() {
    URI url = URI.create("https://unspecialty.com/product/detail.html?product_no=920");

    CrawledBean bean =
        source.parseDetail(url, read("unspecialty-920.html"), SEED_NAMES).orElseThrow();

    assertThat(bean.roasterName()).isEqualTo("커피화 로스터스");
    assertThat(bean.name()).isEqualTo("[커피화 로스터스] 콜롬비아 나리뇨 벨라비스타 게이샤 맥주 효모 & 모스토 무산소 발효");
    assertThat(bean.roastLevelRaw()).isEqualTo("Light #92");
    assertThat(bean.cupNotes()).isEqualTo("로즈마리, 라벤더, 패션프루트, 오렌지 껍질, 스파이시, 라운드");
    assertThat(bean.origins())
        .containsExactly(
            new CrawledOrigin(
                "Colombia",
                "Buesaco, Narino",
                "Bellavista",
                "2,200m",
                "Geisha",
                "Beer Yeast & Mosto Anaerobic"));
  }

  @Test
  @DisplayName("AC-CRAWL-05 · 언스페셜티의 원두 아닌 상품은 결과가 없다")
  void 원두_아닌_상품은_결과가_없다() {
    URI url = URI.create("https://unspecialty.com/product/detail.html?product_no=211");

    assertThat(source.parseDetail(url, read("unspecialty-211.html"), SEED_NAMES)).isEmpty();
  }
}
