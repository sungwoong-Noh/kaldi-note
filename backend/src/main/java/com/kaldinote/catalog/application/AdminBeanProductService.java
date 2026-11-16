package com.kaldinote.catalog.application;

import com.kaldinote.catalog.domain.BeanOrigin;
import com.kaldinote.catalog.domain.BeanProduct;
import com.kaldinote.catalog.domain.CoffeeProcess;
import com.kaldinote.catalog.domain.Roaster;
import com.kaldinote.catalog.domain.Variety;
import com.kaldinote.catalog.infrastructure.BeanProductRepository;
import com.kaldinote.catalog.infrastructure.CoffeeProcessRepository;
import com.kaldinote.catalog.infrastructure.RoasterRepository;
import com.kaldinote.catalog.infrastructure.VarietyRepository;
import com.kaldinote.catalog.presentation.dto.AdminBeanProductDetailResponse;
import com.kaldinote.catalog.presentation.dto.AdminBeanProductPageResponse;
import com.kaldinote.catalog.presentation.dto.AdminBeanProductPageResponse.Counts;
import com.kaldinote.catalog.presentation.dto.AdminBeanProductPageResponse.MissingBy;
import com.kaldinote.catalog.presentation.dto.AdminBeanProductRowResponse;
import com.kaldinote.catalog.presentation.dto.BeanOriginResponse;
import com.kaldinote.common.error.BusinessException;
import com.kaldinote.common.error.ErrorCode;
import com.kaldinote.common.response.PageParams;
import com.kaldinote.user.domain.User;
import com.kaldinote.user.infrastructure.UserRepository;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 관리자 원두 메뉴 — 목록 · 상세. 목록은 id 페이지를 먼저 뽑고 산지 · 기록 수 · 로스터 · 닉네임 · 품종 · 가공을 각각 한 번씩 묶어 읽는다 (페이지 크기와
 * 쿼리 수가 무관하다 — AC-ADMINBEAN-60). 규칙은 docs/specs/2026-11-15-admin-beans.md.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminBeanProductService {

  public enum Status {
    NEEDS_REVIEW,
    VERIFIED,
    HIDDEN
  }

  public enum Source {
    CRAWLER,
    USER
  }

  private static final int Q_MAX = 50;

  private final BeanProductRepository beanProductRepository;
  private final RoasterRepository roasterRepository;
  private final VarietyRepository varietyRepository;
  private final CoffeeProcessRepository processRepository;
  private final UserRepository userRepository;

  public AdminBeanProductPageResponse list(
      String q,
      Status status,
      Source source,
      Boolean missing,
      Boolean decaf,
      Long roasterId,
      PageParams params) {
    String keyword = q == null || q.isBlank() ? null : q.strip();
    if (keyword != null && keyword.length() > Q_MAX) {
      throw new BusinessException(
          ErrorCode.INVALID_REQUEST, "q는 %d자 이하여야 합니다: %d".formatted(Q_MAX, keyword.length()));
    }
    String sourceName = source == null ? null : source.name();
    // `missing`·`decaf`는 true일 때만 좁힌다(false는 「조건 없음」).
    Boolean decafOnly = Boolean.TRUE.equals(decaf) ? Boolean.TRUE : null;
    Boolean missingOnly = Boolean.TRUE.equals(missing) ? Boolean.TRUE : null;

    Page<Long> ids =
        beanProductRepository.searchAdminIds(
            keyword,
            sourceName,
            decafOnly,
            roasterId,
            status == null ? null : status.name(),
            missingOnly,
            params.toPageable(Sort.unsorted())); // 정렬은 네이티브 쿼리의 ORDER BY
    var c = beanProductRepository.countAdmin(keyword, sourceName, decafOnly, roasterId);

    Map<Long, BeanProduct> byId =
        beanProductRepository.findAllWithOriginsByIdIn(ids.getContent()).stream()
            .collect(Collectors.toMap(BeanProduct::getId, Function.identity()));
    List<BeanProduct> products = ids.getContent().stream().map(byId::get).toList();
    Lookups lookups = lookups(products, true);

    return new AdminBeanProductPageResponse(
        products.stream().map(p -> row(p, lookups)).toList(),
        ids.getNumber(),
        ids.getSize(),
        ids.getTotalElements(),
        ids.getTotalPages(),
        ids.hasNext(),
        new Counts(
            c.getAllCount(),
            c.getNeedsReview(),
            c.getVerified(),
            c.getHidden(),
            c.getMissing(),
            new MissingBy(
                c.getMissingRoastLevel(),
                c.getMissingOrigin(),
                c.getMissingVariety(),
                c.getMissingProcess())));
  }

  public AdminBeanProductDetailResponse get(Long id) {
    BeanProduct p =
        beanProductRepository
            .findById(id)
            .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "원두를 찾을 수 없습니다: " + id));
    Lookups lookups = lookups(List.of(p), true);
    List<BeanOriginResponse> origins =
        BeanOriginResponse.listFrom(p.getOrigins(), lookups.varietyNames, lookups.processNames);
    return new AdminBeanProductDetailResponse(
        row(p, lookups),
        p.isDecaf(),
        p.getProductUrl(),
        p.getDescription(),
        origins,
        p.getCreatedAt(),
        beanProductRepository.countSameName(p.getId(), p.getName()));
  }

  private record Lookups(
      Map<Long, String> roasterNames,
      Map<Long, String> nicknames,
      Map<Long, Long> brewCounts,
      Map<Long, String> varietyNames,
      Map<Long, String> processNames) {}

  /** 한 페이지에 필요한 이름 · 기록 수를 종류마다 한 번씩 읽는다. */
  private Lookups lookups(List<BeanProduct> products, boolean withOriginNames) {
    List<Long> ids = products.stream().map(BeanProduct::getId).toList();
    Map<Long, Long> brewCounts =
        ids.isEmpty()
            ? Map.of()
            : beanProductRepository.countBrewsByBeanProduct(ids).stream()
                .collect(
                    Collectors.toMap(
                        r -> ((Number) r[0]).longValue(), r -> ((Number) r[1]).longValue()));
    List<BeanOrigin> origins =
        withOriginNames
            ? products.stream().flatMap(p -> p.getOrigins().stream()).toList()
            : List.of();
    return new Lookups(
        names(
            roasterRepository.findAllById(distinct(products, BeanProduct::getRoasterId)),
            Roaster::getId,
            Roaster::getName),
        names(
            userRepository.findAllById(distinct(products, BeanProduct::getCreatedByUserId)),
            User::getId,
            User::getNickname),
        brewCounts,
        names(
            varietyRepository.findAllById(distinct(origins, BeanOrigin::getVarietyId)),
            Variety::getId,
            v -> v.getNameKo() != null ? v.getNameKo() : v.getName()),
        names(
            processRepository.findAllById(distinct(origins, BeanOrigin::getProcessId)),
            CoffeeProcess::getId,
            c -> c.getNameKo() != null ? c.getNameKo() : c.getName()));
  }

  private static <T> List<Long> distinct(Collection<T> items, Function<T, Long> id) {
    return items.stream().map(id).filter(Objects::nonNull).distinct().toList();
  }

  private static <T> Map<Long, String> names(
      List<T> rows, Function<T, Long> id, Function<T, String> name) {
    return rows.stream()
        .filter(r -> name.apply(r) != null)
        .collect(Collectors.toMap(id, name, (a, b) -> a));
  }

  private static AdminBeanProductRowResponse row(BeanProduct p, Lookups l) {
    return new AdminBeanProductRowResponse(
        p.getId(),
        p.getName(),
        p.getRoasterId(),
        l.roasterNames.get(p.getRoasterId()),
        p.getBeanMix().name(),
        p.getRoastLevel() == null ? null : p.getRoastLevel().name(),
        p.getRoastLevelAgtron(),
        p.getRoastLevelCustom(),
        p.getOrigins().stream().map(BeanOrigin::getCountry).distinct().toList(),
        p.getOrigins().size(),
        p.isVerified(),
        p.isHidden(),
        p.isManuallyEdited(),
        p.isPromoted(),
        p.isCrawled() ? Source.CRAWLER.name() : Source.USER.name(),
        p.getCreatedByUserId() == null ? null : l.nicknames.get(p.getCreatedByUserId()),
        missing(p),
        l.brewCounts.getOrDefault(p.getId(), 0L),
        p.getUpdatedAt());
  }

  /** roastLevel → origin → variety → process. 산지가 0행이면 품종 · 가공은 넣지 않는다. */
  static List<String> missing(BeanProduct p) {
    List<String> out = new ArrayList<>();
    if (p.getRoastLevel() == null) {
      out.add("roastLevel");
    }
    if (p.getOrigins().isEmpty()) {
      out.add("origin");
      return out;
    }
    if (p.getOrigins().stream().anyMatch(o -> o.getVarietyId() == null)) {
      out.add("variety");
    }
    if (p.getOrigins().stream().anyMatch(o -> o.getProcessId() == null)) {
      out.add("process");
    }
    return out;
  }
}
