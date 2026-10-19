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

class MomosSourceTest {

  private final MomosSource source = new MomosSource();

  @Test
  @DisplayName("AC-CRAWL-01 · 모모스 목록에서 상세 URL을 모은다")
  void 모모스_목록에서_상세_URL_21개를_모은다() {
    List<URI> urls = source.parseList(read("momos-list.html"));

    assertThat(urls).hasSize(21).doesNotHaveDuplicates();
    assertThat(urls)
        .allSatisfy(
            u ->
                assertThat(u.toString())
                    .startsWith("https://momos.co.kr/Product_CoffeeBeans/?idx="));
  }

  @Test
  @DisplayName("AC-CRAWL-02 · 모모스 상세에서 상품명을 분해한다")
  void 모모스_상세에서_상품명을_분해한다() {
    URI url = URI.create("https://momos.co.kr/Product_CoffeeBeans/?idx=4938");

    CrawledBean bean = source.parseDetail(url, read("momos-4938.html"), SEED_NAMES).orElseThrow();

    assertThat(bean.roasterName()).isEqualTo("모모스커피");
    assertThat(bean.name()).isEqualTo("원두 에콰도르 산 어거스틴 파카마라 내추럴");
    assertThat(bean.productUrl()).isEqualTo(url.toString());
    assertThat(bean.roastLevelRaw()).isNull();
    assertThat(bean.cupNotes()).isEqualTo("적포도, 블랙커런트, 건 무화과, 발효차, 와인같은");
    assertThat(bean.origins())
        .containsExactly(new CrawledOrigin("에콰도르", null, "산 어거스틴", null, "파카마라", "내추럴"));
  }

  @Test
  void 가공은_두_토큰을_먼저_찾는다() {
    assertThat(MomosSource.decompose("에티오피아 구지 무산소 내추럴", SEED_NAMES))
        .isEqualTo(new CrawledOrigin("에티오피아", null, "구지", null, null, "무산소 내추럴"));
  }
}
