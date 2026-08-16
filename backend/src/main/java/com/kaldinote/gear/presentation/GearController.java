package com.kaldinote.gear.presentation;

import com.kaldinote.common.security.AuthenticatedUser;
import com.kaldinote.gear.application.GearService;
import com.kaldinote.gear.application.GrindConversionService;
import com.kaldinote.gear.presentation.dto.BrewFilterResponse;
import com.kaldinote.gear.presentation.dto.BrewerResponse;
import com.kaldinote.gear.presentation.dto.GrindConversionRequest;
import com.kaldinote.gear.presentation.dto.GrindConversionResponse;
import com.kaldinote.gear.presentation.dto.GrinderModelResponse;
import com.kaldinote.gear.presentation.dto.UserGrinderCreateRequest;
import com.kaldinote.gear.presentation.dto.UserGrinderResponse;
import io.swagger.v3.oas.annotations.Operation;
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
@RequestMapping("/api/v1/gear")
@RequiredArgsConstructor
@Tag(name = "장비", description = "그라인더·드리퍼·필터 조회와 분쇄도 환산")
public class GearController {

  private final GearService gearService;
  private final GrindConversionService conversionService;

  @GetMapping("/grinders")
  public List<GrinderModelResponse> grinders() {
    return gearService.findAllGrinders();
  }

  @GetMapping("/brewers")
  public List<BrewerResponse> brewers() {
    return gearService.findAllBrewers();
  }

  @GetMapping("/filters")
  public List<BrewFilterResponse> filters() {
    return gearService.findAllFilters();
  }

  @PostMapping("/grind-conversions")
  @Operation(
      summary = "분쇄도 환산",
      description =
          "버 형상·입도 분포가 달라 정확한 등가 변환은 불가능하다. 결과는 항상 추정치이며 " + "응답의 warning을 UI에 반드시 노출해야 한다.")
  public GrindConversionResponse convert(@Valid @RequestBody GrindConversionRequest request) {
    return GrindConversionResponse.from(conversionService.convert(request));
  }

  @PostMapping("/user-grinders")
  @ResponseStatus(HttpStatus.CREATED)
  @Operation(
      summary = "사용자 그라인더 등록",
      description = "보유한 그라인더를 등록한다. 브루잉 로그가 이 ID로 실제 사용 그라인더를 가리킨다.")
  public UserGrinderResponse createUserGrinder(
      @Valid @RequestBody UserGrinderCreateRequest request, AuthenticatedUser user) {
    return gearService.createUserGrinder(user.id(), request);
  }
}
