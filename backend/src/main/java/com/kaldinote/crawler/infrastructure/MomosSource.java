package com.kaldinote.crawler.infrastructure;

import com.kaldinote.crawler.domain.BeanSource;
import com.kaldinote.crawler.domain.CrawledBean;
import com.kaldinote.crawler.domain.CrawledOrigin;
import com.kaldinote.crawler.domain.MasterNames;
import java.net.URI;
import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * 모모스커피(imweb). 목록은 서버가 그린 {@code /Product_CoffeeBeans}의 {@code ?idx=} 링크, 상세는 JSON-LD Product의
 * name·description(컵노트). 배전도·고도는 텍스트로 없다.
 */
@Component
public class MomosSource implements BeanSource {

  private static final URI LIST_URL = URI.create("https://momos.co.kr/Product_CoffeeBeans");
  private static final String ROASTER = "모모스커피";
  private static final JsonMapper JSON = JsonMapper.builder().build();

  @Override
  public String key() {
    return "momos";
  }

  @Override
  public String name() {
    return ROASTER;
  }

  @Override
  public URI listUrl() {
    return LIST_URL;
  }

  @Override
  public List<URI> parseList(String body) {
    return Jsoup.parse(body, LIST_URL.toString())
        .select("a[href*=/Product_CoffeeBeans/?idx=]")
        .stream()
        .map(a -> a.absUrl("href"))
        .distinct()
        .map(URI::create)
        .toList();
  }

  @Override
  public Optional<CrawledBean> parseDetail(URI url, String body, MasterNames names) {
    Document doc = Jsoup.parse(body);
    for (Element script : doc.select("script[type=application/ld+json]")) {
      JsonNode node = JSON.readTree(script.data());
      if ("Product".equals(node.path("@type").asString(""))) {
        String name = node.path("name").asString("").strip();
        String cupNotes = blankToNull(node.path("description").asString(""));
        List<CrawledOrigin> origins =
            BlendNames.isBlend(name) ? List.of() : List.of(decompose(name, names));
        return Optional.of(new CrawledBean(ROASTER, name, url.toString(), null, cupNotes, origins));
      }
    }
    return Optional.empty();
  }

  /**
   * {@code 원두 에콰도르 산 어거스틴 파카마라 내추럴} → 국가 · 농장 · 품종 · 가공. 첫 토큰이 국가, 끝에서 가공(두 토큰 먼저), 그 앞 토큰이 품종이면
   * 품종, 남은 것이 농장.
   */
  static CrawledOrigin decompose(String name, MasterNames names) {
    String stripped = name.startsWith("원두 ") ? name.substring(3) : name;
    List<String> tokens = Arrays.asList(stripped.strip().split("\\s+"));
    String country = tokens.get(0);
    List<String> rest = tokens.subList(1, tokens.size());

    String process = null;
    for (int n = Math.min(2, rest.size()); n >= 1 && process == null; n--) {
      String tail = String.join(" ", rest.subList(rest.size() - n, rest.size()));
      if (containsIgnoreCase(names.processes(), tail)) {
        process = tail;
        rest = rest.subList(0, rest.size() - n);
      }
    }
    String variety = null;
    if (!rest.isEmpty() && containsIgnoreCase(names.varieties(), rest.get(rest.size() - 1))) {
      variety = rest.get(rest.size() - 1);
      rest = rest.subList(0, rest.size() - 1);
    }
    String farm = rest.isEmpty() ? null : String.join(" ", rest);
    return new CrawledOrigin(country, null, farm, null, variety, process);
  }

  private static boolean containsIgnoreCase(Collection<String> names, String value) {
    return names.stream().anyMatch(n -> n.equalsIgnoreCase(value));
  }

  private static String blankToNull(String s) {
    return s == null || s.isBlank() ? null : s.strip();
  }
}
