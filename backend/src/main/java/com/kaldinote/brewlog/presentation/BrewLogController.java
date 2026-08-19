package com.kaldinote.brewlog.presentation;

import com.kaldinote.brewlog.application.BrewLogService;
import com.kaldinote.brewlog.presentation.dto.BrewLogCreateRequest;
import com.kaldinote.brewlog.presentation.dto.BrewLogPatchRequest;
import com.kaldinote.brewlog.presentation.dto.BrewLogResponse;
import com.kaldinote.brewlog.presentation.dto.BrewLogSummaryResponse;
import com.kaldinote.common.response.PageParams;
import com.kaldinote.common.response.PageResponse;
import com.kaldinote.common.security.AuthenticatedUser;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/brew-logs")
@RequiredArgsConstructor
@Tag(name = "브루잉 로그", description = "실측 기록과 EY/SCA 분석")
public class BrewLogController {

  private final BrewLogService brewLogService;

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public BrewLogResponse create(
      @Valid @RequestBody BrewLogCreateRequest request, AuthenticatedUser user) {
    return brewLogService.create(user.id(), request);
  }

  @GetMapping
  public PageResponse<BrewLogSummaryResponse> list(
      @RequestParam(required = false) Integer page,
      @RequestParam(required = false) Integer size,
      @RequestParam(required = false) Long recipeId,
      @RequestParam(required = false) Long userId,
      @RequestParam(required = false) Long beanBatchId,
      AuthenticatedUser user) {
    return brewLogService.list(user.id(), recipeId, userId, beanBatchId, PageParams.of(page, size));
  }

  @GetMapping("/{id}")
  public BrewLogResponse get(@PathVariable Long id, AuthenticatedUser user) {
    return brewLogService.get(user.id(), id);
  }

  @PatchMapping("/{id}")
  public BrewLogResponse patch(
      @PathVariable Long id,
      @Valid @RequestBody BrewLogPatchRequest request,
      AuthenticatedUser user) {
    return brewLogService.patch(user.id(), id, request);
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(@PathVariable Long id, AuthenticatedUser user) {
    brewLogService.delete(user.id(), id);
  }
}
