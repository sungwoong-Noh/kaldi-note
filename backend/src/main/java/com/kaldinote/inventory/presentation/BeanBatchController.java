package com.kaldinote.inventory.presentation;

import com.kaldinote.common.security.AuthenticatedUser;
import com.kaldinote.inventory.application.BeanBatchService;
import com.kaldinote.inventory.presentation.dto.BeanBatchCreateRequest;
import com.kaldinote.inventory.presentation.dto.BeanBatchResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/bean-batches")
@RequiredArgsConstructor
@Tag(name = "원두 재고", description = "개인 원두 재고 등록·조회·수정·삭제")
public class BeanBatchController {

  private final BeanBatchService beanBatchService;

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public BeanBatchResponse create(
      @Valid @RequestBody BeanBatchCreateRequest request, AuthenticatedUser user) {
    return beanBatchService.create(user.id(), request);
  }
}
