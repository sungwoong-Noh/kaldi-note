package com.kaldinote.catalog.application;

import com.kaldinote.catalog.domain.BeanMix;
import com.kaldinote.catalog.domain.BeanOrigin;
import com.kaldinote.catalog.domain.BeanProduct;
import com.kaldinote.catalog.domain.Roaster;
import com.kaldinote.catalog.infrastructure.BeanProductRepository;
import com.kaldinote.catalog.infrastructure.RoasterRepository;
import com.kaldinote.catalog.presentation.dto.BeanProductCreateRequest;
import com.kaldinote.catalog.presentation.dto.BeanProductResponse;
import com.kaldinote.catalog.presentation.dto.OriginRequest;
import com.kaldinote.catalog.presentation.dto.RoasterResponse;
import com.kaldinote.common.error.BusinessException;
import com.kaldinote.common.error.ErrorCode;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class BeanCatalogService {

  private final RoasterRepository roasterRepository;
  private final BeanProductRepository beanProductRepository;

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

  public List<BeanProductResponse> findAllBeanProducts() {
    return beanProductRepository.findAllByOrderByNameAsc().stream()
        .map(BeanProductResponse::from)
        .toList();
  }

  public BeanProductResponse getBeanProduct(Long id) {
    return BeanProductResponse.from(findBeanProduct(id));
  }

  @Transactional
  public BeanProductResponse createBeanProduct(Long userId, BeanProductCreateRequest request) {
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

  private List<BeanOrigin> buildOrigins(BeanMix mix, List<OriginRequest> requests) {
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
              new java.math.BigDecimal("100.0")));
      return origins;
    }

    for (OriginRequest o : requests) {
      origins.add(
          BeanOrigin.of(
              o.country(),
              o.region(),
              o.farm(),
              o.altitudeMinM(),
              o.altitudeMaxM(),
              o.varietyId(),
              o.processId(),
              o.ratioPercent()));
    }
    return origins;
  }
}
