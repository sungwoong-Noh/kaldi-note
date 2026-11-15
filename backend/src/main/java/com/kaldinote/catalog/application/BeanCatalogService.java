package com.kaldinote.catalog.application;

import com.kaldinote.catalog.domain.BeanMix;
import com.kaldinote.catalog.domain.BeanOrigin;
import com.kaldinote.catalog.domain.BeanProduct;
import com.kaldinote.catalog.domain.RoastLevel;
import com.kaldinote.catalog.domain.Roaster;
import com.kaldinote.catalog.infrastructure.BeanProductRepository;
import com.kaldinote.catalog.infrastructure.CoffeeProcessRepository;
import com.kaldinote.catalog.infrastructure.RoasterRepository;
import com.kaldinote.catalog.infrastructure.VarietyRepository;
import com.kaldinote.catalog.presentation.dto.BeanProductCreateRequest;
import com.kaldinote.catalog.presentation.dto.BeanProductResponse;
import com.kaldinote.catalog.presentation.dto.BeanProductSummaryResponse;
import com.kaldinote.catalog.presentation.dto.OriginRequest;
import com.kaldinote.catalog.presentation.dto.RoasterResponse;
import com.kaldinote.common.error.BusinessException;
import com.kaldinote.common.error.ErrorCode;
import com.kaldinote.common.response.PageParams;
import com.kaldinote.common.response.PageResponse;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Predicate;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class BeanCatalogService {

  private static final int Q_MAX = 50;

  private final RoasterRepository roasterRepository;
  private final BeanProductRepository beanProductRepository;
  private final VarietyRepository varietyRepository;
  private final CoffeeProcessRepository processRepository;

  public List<RoasterResponse> findAllRoasters() {
    return roasterRepository.findAllByOrderByNameAsc().stream().map(RoasterResponse::from).toList();
  }

  @Transactional
  public RoasterResponse createRoaster(String name, String country, String website, Long userId) {
    if (roasterRepository.findByName(name).isPresent()) {
      throw new BusinessException(ErrorCode.DUPLICATE_NAME);
    }
    Roaster saved = roasterRepository.save(Roaster.createByUser(name, country, website, userId));
    return RoasterResponse.from(saved);
  }

  public PageResponse<BeanProductSummaryResponse> searchBeanProducts(
      Long userId,
      String q,
      Long roasterId,
      List<RoastLevel> roastLevels,
      Boolean decaf,
      String country,
      PageParams params) {
    String keyword = q == null || q.isBlank() ? null : q.strip();
    if (keyword != null && keyword.length() > Q_MAX) {
      throw new BusinessException(
          ErrorCode.INVALID_REQUEST, "q는 %d자 이하여야 합니다: %d".formatted(Q_MAX, keyword.length()));
    }
    String[] roast =
        roastLevels == null || roastLevels.isEmpty()
            ? null
            : roastLevels.stream().map(RoastLevel::name).toArray(String[]::new);
    Page<BeanProduct> page =
        beanProductRepository.search(
            userId,
            keyword,
            roasterId,
            roast,
            decaf,
            country,
            params.toPageable(Sort.unsorted())); // 정렬은 네이티브 쿼리의 ORDER BY가 정한다
    // 로스터 이름은 한 번에 읽어 붙인다(N+1 금지)
    Map<Long, String> roasterNames =
        roasterRepository
            .findAllById(
                page.getContent().stream().map(BeanProduct::getRoasterId).distinct().toList())
            .stream()
            .collect(Collectors.toMap(Roaster::getId, Roaster::getName));
    return PageResponse.from(
        page, p -> BeanProductSummaryResponse.from(p, roasterNames.get(p.getRoasterId())));
  }

  public BeanProductResponse getBeanProduct(Long id) {
    return BeanProductResponse.from(findBeanProduct(id));
  }

  @Transactional
  public BeanProductResponse createBeanProduct(Long userId, BeanProductCreateRequest request) {
    if (!roasterRepository.existsById(request.roasterId())) {
      throw new BusinessException(ErrorCode.NOT_FOUND, "로스터를 찾을 수 없습니다: " + request.roasterId());
    }
    for (OriginRequest o : request.origins()) {
      requireExists(o.varietyId(), varietyRepository::existsById, "품종");
      requireExists(o.processId(), processRepository::existsById, "가공법");
    }
    if (beanProductRepository
        .findByRoasterIdAndName(request.roasterId(), request.name())
        .isPresent()) {
      throw new BusinessException(ErrorCode.DUPLICATE_NAME);
    }

    List<BeanOrigin> origins = buildOrigins(request.beanMix(), request.origins());

    BeanProduct product =
        BeanProduct.createByUser(
            request.roasterId(),
            request.name(),
            request.beanMix(),
            request.roastLevel(),
            request.roastLevelAgtron(),
            request.roastLevelCustom(),
            Boolean.TRUE.equals(request.decaf()),
            request.productUrl(),
            request.description(),
            userId);
    product.attachOrigins(origins);

    return BeanProductResponse.from(beanProductRepository.save(product));
  }

  private BeanProduct findBeanProduct(Long id) {
    return beanProductRepository
        .findById(id)
        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "원두 상품을 찾을 수 없습니다: " + id));
  }

  private void requireExists(Long id, Predicate<Long> existsById, String label) {
    if (id != null && !existsById.test(id)) {
      throw new BusinessException(ErrorCode.NOT_FOUND, label + "를 찾을 수 없습니다: " + id);
    }
  }

  private List<BeanOrigin> buildOrigins(BeanMix mix, List<OriginRequest> requests) {
    if (mix == BeanMix.SINGLE_ORIGIN && requests.size() != 1) {
      throw new BusinessException(ErrorCode.BEAN_MIX_ORIGIN_MISMATCH);
    }
    if (mix == BeanMix.BLEND && requests.size() <= 1) {
      throw new BusinessException(ErrorCode.BEAN_MIX_ORIGIN_MISMATCH);
    }

    List<BeanOrigin> origins = new ArrayList<>();
    if (mix == BeanMix.SINGLE_ORIGIN) {
      OriginRequest o = requests.get(0);
      origins.add(
          BeanOrigin.of(
              o.country(),
              o.region(),
              o.farm(),
              o.altitudeMinM(),
              o.altitudeMaxM(),
              o.varietyId(),
              o.processId(),
              new BigDecimal("100.0")));
      return origins;
    }

    BigDecimal sum = BigDecimal.ZERO;
    for (OriginRequest o : requests) {
      BigDecimal ratio = o.ratioPercent() == null ? BigDecimal.ZERO : o.ratioPercent();
      sum = sum.add(ratio);
      origins.add(
          BeanOrigin.of(
              o.country(),
              o.region(),
              o.farm(),
              o.altitudeMinM(),
              o.altitudeMaxM(),
              o.varietyId(),
              o.processId(),
              ratio));
    }
    if (sum.compareTo(new BigDecimal("100.0")) != 0) {
      throw new BusinessException(ErrorCode.BEAN_ORIGIN_RATIO_MISMATCH);
    }
    return origins;
  }
}
