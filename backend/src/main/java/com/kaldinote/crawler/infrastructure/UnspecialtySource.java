package com.kaldinote.crawler.infrastructure;

import com.kaldinote.crawler.domain.BeanSource;
import com.kaldinote.crawler.domain.CrawledBean;
import com.kaldinote.crawler.domain.CrawledOrigin;
import com.kaldinote.crawler.domain.MasterNames;
import java.net.URI;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.parser.Parser;
import org.springframework.stereotype.Component;

/**
 * 언스페셜티 몰(Cafe24, 여러 로스터리). 카테고리 목록은 JS로 그려지므로 sitemap의 {@code /product/} URL을 쓴다. 상세의 {@code
 * dl.uns-detail__specs} 표에 「로스팅 포인트」가 없으면 원두가 아니다.
 */
@Component
public class UnspecialtySource implements BeanSource {

  private static final URI LIST_URL = URI.create("https://unspecialty.com/sitemap.xml");
  private static final String TITLE_SUFFIX = " - 언스페셜티 몰";
  private static final Pattern ROASTER = Pattern.compile("^\\[([^\\]]+)\\]");

  @Override
  public String key() {
    return "unspecialty";
  }

  @Override
  public String name() {
    return "언스페셜티 몰";
  }

  @Override
  public URI listUrl() {
    return LIST_URL;
  }

  @Override
  public List<URI> parseList(String body) {
    return Jsoup.parse(body, "", Parser.xmlParser()).select("loc").stream()
        .map(Element::text)
        .filter(u -> u.contains("/product/"))
        .distinct()
        .map(URI::create)
        .toList();
  }

  @Override
  public Optional<CrawledBean> parseDetail(URI url, String body, MasterNames names) {
    Document doc = Jsoup.parse(body);
    Map<String, String> specs = new HashMap<>();
    for (Element row : doc.select(".uns-detail__spec-row")) {
      specs.put(
          row.select(".uns-detail__spec-key").text().strip(),
          row.select(".uns-detail__spec-value").text().strip());
    }
    if (!specs.containsKey("로스팅 포인트")) {
      return Optional.empty();
    }

    String title = doc.select("meta[property=og:title]").attr("content").strip();
    String name =
        title.endsWith(TITLE_SUFFIX)
            ? title.substring(0, title.length() - TITLE_SUFFIX.length())
            : title;
    Matcher m = ROASTER.matcher(name);
    if (!m.find()) {
      throw new IllegalStateException("상품명에 [로스터]가 없다: " + name);
    }

    List<CrawledOrigin> origins =
        BlendNames.isBlend(name)
            ? List.of()
            : List.of(
                new CrawledOrigin(
                    spec(specs, "국가"),
                    spec(specs, "지역"),
                    spec(specs, "농장"),
                    spec(specs, "고도"),
                    spec(specs, "품종"),
                    spec(specs, "가공방식")));
    return Optional.of(
        new CrawledBean(
            m.group(1).strip(),
            name,
            url.toString(),
            spec(specs, "로스팅 포인트"),
            spec(specs, "컵노트"),
            origins));
  }

  private static String spec(Map<String, String> specs, String key) {
    String v = specs.get(key);
    return v == null || v.isBlank() ? null : v;
  }
}
