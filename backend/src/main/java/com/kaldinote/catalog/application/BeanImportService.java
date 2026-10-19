package com.kaldinote.catalog.application;

import com.kaldinote.catalog.application.ImportResult.Outcome;
import com.kaldinote.catalog.application.ImportResult.Unmapped;
import com.kaldinote.catalog.domain.BeanMix;
import com.kaldinote.catalog.domain.BeanOrigin;
import com.kaldinote.catalog.domain.BeanProduct;
import com.kaldinote.catalog.domain.CoffeeProcess;
import com.kaldinote.catalog.domain.RoastLevel;
import com.kaldinote.catalog.domain.Roaster;
import com.kaldinote.catalog.domain.Variety;
import com.kaldinote.catalog.infrastructure.BeanProductRepository;
import com.kaldinote.catalog.infrastructure.CoffeeProcessRepository;
import com.kaldinote.catalog.infrastructure.RoasterRepository;
import com.kaldinote.catalog.infrastructure.VarietyRepository;
import com.kaldinote.crawler.domain.CrawledBean;
import com.kaldinote.crawler.domain.CrawledOrigin;
import com.kaldinote.crawler.domain.MasterNames;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 크롤러가 넘긴 원문(CrawledBean)을 표준값으로 바꿔 로스터·원두 상품·산지에 넣거나 갱신한다. 원문 → 표준값 매핑 규칙은 사이트가 늘어도 여기 한 곳에만 둔다.
 * 규칙 표는 docs/specs/2026-10-14-bean-crawler.md 「저장 규칙」.
 */
@Service
@RequiredArgsConstructor
public class BeanImportService {

  private static final Pattern ROAST = Pattern.compile("^(.*?)\\s*(?:#\\s*(\\d+(?:\\.\\d+)?))?$");
  private static final Pattern ALTITUDE_ONE = Pattern.compile("^(\\d+)\\s*m$");
  private static final Pattern ALTITUDE_RANGE = Pattern.compile("^(\\d+)\\s*[-–~]\\s*(\\d+)\\s*m$");
  private static final Map<String, RoastLevel> ROAST_WORDS =
      Map.of(
          "light", RoastLevel.LIGHT,
          "medium light", RoastLevel.MEDIUM_LIGHT,
          "medium", RoastLevel.MEDIUM,
          "medium dark", RoastLevel.MEDIUM_DARK,
          "dark", RoastLevel.DARK);
  private static final int NAME_MAX = 100;

  private final RoasterRepository roasterRepository;
  private final BeanProductRepository beanProductRepository;
  private final VarietyRepository varietyRepository;
  private final CoffeeProcessRepository processRepository;

  @Transactional(readOnly = true)
  public MasterNames masterNames() {
    return new MasterNames(
        names(varietyRepository.findAll(), Variety::getName, Variety::getNameKo),
        names(processRepository.findAll(), CoffeeProcess::getName, CoffeeProcess::getNameKo));
  }

  @Transactional
  public ImportResult importBean(CrawledBean bean) {
    boolean blend = isBlend(bean.name());
    if (bean.name().length() > NAME_MAX
        || (!blend && (bean.origins().isEmpty() || bean.origins().get(0).country() == null))) {
      return ImportResult.skipped("PARSE_FAILED");
    }

    Roaster roaster =
        roasterRepository
            .findByName(bean.roasterName())
            .orElseGet(() -> roasterRepository.save(Roaster.createBySystem(bean.roasterName())));
    var existing = beanProductRepository.findByRoasterIdAndName(roaster.getId(), bean.name());
    if (existing.isPresent() && !existing.get().isCrawled()) {
      return ImportResult.skipped("USER_OWNED");
    }

    List<Unmapped> unmapped = new ArrayList<>();
    RoastLevel roastLevel = null;
    Short agtron = null;
    if (bean.roastLevelRaw() != null) {
      Matcher m = ROAST.matcher(bean.roastLevelRaw().strip());
      m.matches(); // 패턴이 모든 문자열과 맞는다
      roastLevel = ROAST_WORDS.get(m.group(1).toLowerCase(Locale.ROOT).replaceAll("\\s+", " "));
      // roast_level_agtron은 SMALLINT — 소수(#74.6)는 정수로 반올림한다(AC-CRAWL-46)
      agtron =
          m.group(2) == null
              ? null
              : new BigDecimal(m.group(2)).setScale(0, RoundingMode.HALF_UP).shortValueExact();
      if (roastLevel == null) {
        unmapped.add(new Unmapped("roastLevel", bean.roastLevelRaw()));
      }
    }

    BeanMix mix = blend ? BeanMix.BLEND : BeanMix.SINGLE_ORIGIN;
    List<BeanOrigin> origins = blend ? List.of() : List.of(origin(bean.origins().get(0), unmapped));

    BeanProduct product;
    Outcome outcome;
    if (existing.isPresent()) {
      product = existing.get();
      product.updateFromCrawl(mix, roastLevel, agtron, bean.productUrl(), bean.cupNotes());
      outcome = Outcome.UPDATED;
    } else {
      product =
          BeanProduct.createByCrawler(
              roaster.getId(),
              bean.name(),
              mix,
              roastLevel,
              agtron,
              bean.productUrl(),
              bean.cupNotes());
      outcome = Outcome.CREATED;
    }
    product.attachOrigins(new ArrayList<>(origins));
    beanProductRepository.save(product);
    return new ImportResult(outcome, null, unmapped);
  }

  private BeanOrigin origin(CrawledOrigin o, List<Unmapped> unmapped) {
    Long varietyId =
        lookup(
            o.varietyRaw(),
            varietyRepository.findAll(),
            Variety::getId,
            Variety::getName,
            Variety::getNameKo);
    if (o.varietyRaw() != null && varietyId == null) {
      unmapped.add(new Unmapped("variety", o.varietyRaw()));
    }
    Long processId =
        lookup(
            o.processRaw(),
            processRepository.findAll(),
            CoffeeProcess::getId,
            CoffeeProcess::getName,
            CoffeeProcess::getNameKo);
    if (o.processRaw() != null && processId == null) {
      unmapped.add(new Unmapped("process", o.processRaw()));
    }
    Short[] altitude = altitude(o.altitudeRaw());
    return BeanOrigin.of(
        o.country(),
        o.region(),
        o.farm(),
        altitude[0],
        altitude[1],
        varietyId,
        processId,
        new BigDecimal("100.0"));
  }

  static boolean isBlend(String name) {
    return name.contains("블렌드") || name.toLowerCase(Locale.ROOT).contains("blend");
  }

  /** {@code 2,200m} → [2200, 2200], {@code 1,900-2,100m} → [1900, 2100], 그 외 → [null, null]. */
  static Short[] altitude(String raw) {
    if (raw == null) {
      return new Short[] {null, null};
    }
    String s = raw.replace(",", "").strip();
    Matcher one = ALTITUDE_ONE.matcher(s);
    if (one.matches()) {
      Short v = Short.valueOf(one.group(1));
      return new Short[] {v, v};
    }
    Matcher range = ALTITUDE_RANGE.matcher(s);
    if (range.matches()) {
      return new Short[] {Short.valueOf(range.group(1)), Short.valueOf(range.group(2))};
    }
    return new Short[] {null, null};
  }

  private static <T> Long lookup(
      String raw,
      List<T> all,
      Function<T, Long> id,
      Function<T, String> name,
      Function<T, String> nameKo) {
    if (raw == null) {
      return null;
    }
    String key = raw.strip();
    return all.stream()
        .filter(t -> key.equalsIgnoreCase(name.apply(t)) || key.equalsIgnoreCase(nameKo.apply(t)))
        .map(id)
        .findFirst()
        .orElse(null);
  }

  private static <T> List<String> names(
      List<T> all, Function<T, String> name, Function<T, String> nameKo) {
    return all.stream()
        .flatMap(t -> Stream.of(name.apply(t), nameKo.apply(t)))
        .filter(n -> n != null)
        .toList();
  }
}
