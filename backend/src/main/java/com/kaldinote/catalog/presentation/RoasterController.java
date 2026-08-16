package com.kaldinote.catalog.presentation;

import com.kaldinote.catalog.application.BeanCatalogService;
import com.kaldinote.catalog.presentation.dto.RoasterCreateRequest;
import com.kaldinote.catalog.presentation.dto.RoasterResponse;
import com.kaldinote.common.security.AuthenticatedUser;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/roasters")
@RequiredArgsConstructor
@Tag(name = "로스터", description = "로스터 등록·조회")
public class RoasterController {

  private final BeanCatalogService beanCatalogService;

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public RoasterResponse create(
      @Valid @RequestBody RoasterCreateRequest request, AuthenticatedUser user) {
    return beanCatalogService.createRoaster(
        request.name(), request.country(), request.website(), user.id());
  }

  @GetMapping
  public List<RoasterResponse> list() {
    return beanCatalogService.findAllRoasters();
  }
}
