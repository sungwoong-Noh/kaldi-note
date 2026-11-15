package com.kaldinote.catalog.presentation;

import com.kaldinote.catalog.application.BeanCatalogService;
import com.kaldinote.catalog.domain.RoastLevel;
import com.kaldinote.catalog.presentation.dto.BeanProductCreateRequest;
import com.kaldinote.catalog.presentation.dto.BeanProductResponse;
import com.kaldinote.catalog.presentation.dto.BeanProductSummaryResponse;
import com.kaldinote.common.response.PageParams;
import com.kaldinote.common.response.PageResponse;
import com.kaldinote.common.security.AuthenticatedUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/bean-products")
@RequiredArgsConstructor
@Tag(name = "원두 상품", description = "원두 상품 등록·조회")
public class BeanProductController {

  private static final int SIZE_MAX = 50;

  private final BeanCatalogService beanCatalogService;

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public BeanProductResponse create(
      @Valid @RequestBody BeanProductCreateRequest request, AuthenticatedUser user) {
    return beanCatalogService.createBeanProduct(user.id(), request);
  }

  @GetMapping
  @Operation(
      summary = "원두 검색",
      description = "숨긴 원두와 남이 만든 사용자 원두는 빠진다. 필터는 모두 AND, 이름 오름차순(같으면 id 오름차순).")
  public PageResponse<BeanProductSummaryResponse> search(
      @Parameter(description = "이름 또는 로스터 이름 부분 일치, 대소문자 무시. 앞뒤 공백 제외 50자 이하.")
          @RequestParam(required = false)
          String q,
      @Parameter(description = "그 로스터의 원두만.") @RequestParam(required = false) Long roasterId,
      @Parameter(description = "여러 개면 OR. 배전도가 없는 원두는 이 필터를 주면 빠진다.")
          @RequestParam(required = false)
          List<RoastLevel> roastLevel,
      @Parameter(description = "디카페인 여부.") @RequestParam(required = false) Boolean decaf,
      @Parameter(description = "산지 중 하나의 국가가 정확히 같은 원두만.") @RequestParam(required = false)
          String country,
      @Parameter(description = "0-based 페이지 번호. 음수면 400.", schema = @Schema(defaultValue = "0"))
          @RequestParam(required = false)
          Integer page,
      @Parameter(description = "1 이상 50 이하, 벗어나면 400.", schema = @Schema(defaultValue = "20"))
          @RequestParam(required = false)
          Integer size,
      AuthenticatedUser user) {
    return beanCatalogService.searchBeanProducts(
        user.id(), q, roasterId, roastLevel, decaf, country, PageParams.of(page, size, SIZE_MAX));
  }

  @GetMapping("/{id}")
  public BeanProductResponse get(@PathVariable Long id) {
    return beanCatalogService.getBeanProduct(id);
  }
}
