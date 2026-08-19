package com.kaldinote.brewlog.presentation;

import com.kaldinote.brewlog.application.BrewLogService;
import com.kaldinote.brewlog.presentation.dto.BrewLogCreateRequest;
import com.kaldinote.brewlog.presentation.dto.BrewLogResponse;
import com.kaldinote.common.security.AuthenticatedUser;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
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

  @GetMapping("/{id}")
  public BrewLogResponse get(@PathVariable Long id, AuthenticatedUser user) {
    return brewLogService.get(user.id(), id);
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(@PathVariable Long id, AuthenticatedUser user) {
    brewLogService.delete(user.id(), id);
  }
}
