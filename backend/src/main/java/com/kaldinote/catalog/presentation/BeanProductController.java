package com.kaldinote.catalog.presentation;

import com.kaldinote.catalog.application.BeanCatalogService;
import com.kaldinote.catalog.presentation.dto.BeanProductCreateRequest;
import com.kaldinote.catalog.presentation.dto.BeanProductResponse;
import com.kaldinote.common.security.AuthenticatedUser;
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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/bean-products")
@RequiredArgsConstructor
@Tag(name = "원두 상품", description = "원두 상품 등록·조회")
public class BeanProductController {

  private final BeanCatalogService beanCatalogService;

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public BeanProductResponse create(
      @Valid @RequestBody BeanProductCreateRequest request, AuthenticatedUser user) {
    return beanCatalogService.createBeanProduct(user.id(), request);
  }

  @GetMapping
  public List<BeanProductResponse> list() {
    return beanCatalogService.findAllBeanProducts();
  }

  @GetMapping("/{id}")
  public BeanProductResponse get(@PathVariable Long id) {
    return beanCatalogService.getBeanProduct(id);
  }
}
