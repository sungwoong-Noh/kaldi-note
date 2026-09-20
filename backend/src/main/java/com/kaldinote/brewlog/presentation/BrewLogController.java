package com.kaldinote.brewlog.presentation;

import com.kaldinote.brewlog.application.BrewLogService;
import com.kaldinote.brewlog.presentation.dto.BrewLogCalendarResponse;
import com.kaldinote.brewlog.presentation.dto.BrewLogCreateRequest;
import com.kaldinote.brewlog.presentation.dto.BrewLogPatchRequest;
import com.kaldinote.brewlog.presentation.dto.BrewLogResponse;
import com.kaldinote.brewlog.presentation.dto.BrewLogSummaryResponse;
import com.kaldinote.common.error.BusinessException;
import com.kaldinote.common.error.ErrorCode;
import com.kaldinote.common.response.PageParams;
import com.kaldinote.common.response.PageResponse;
import com.kaldinote.common.security.AuthenticatedUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
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
  @Operation(
      summary = "볼 수 있는 브루잉 로그 목록",
      description =
          "공개범위 판정은 레시피 목록과 같다. brewedAt 내림차순(동점 시 id 내림차순). 필터 셋은 AND로 결합하며, 볼 수 없는 대상을 가리켜도 403이 아니라 빈 목록이다.")
  public PageResponse<BrewLogSummaryResponse> list(
      @Parameter(description = "0-based 페이지 번호. 음수면 400.", schema = @Schema(defaultValue = "0"))
          @RequestParam(required = false)
          Integer page,
      @Parameter(
              description = "페이지 크기. 1 이상 100 이하(양끝 포함), 벗어나면 400.",
              schema = @Schema(defaultValue = "20"))
          @RequestParam(required = false)
          Integer size,
      @Parameter(description = "그 레시피로 내린 기록만.") @RequestParam(required = false) Long recipeId,
      @Parameter(description = "그 사용자가 남긴 기록만.") @RequestParam(required = false) Long userId,
      @Parameter(description = "그 원두 봉지로 내린 기록만.") @RequestParam(required = false) Long beanBatchId,
      @Parameter(description = "YYYY-MM-DD. KST 기준 그 하루의 기록만.") @RequestParam(required = false)
          String date,
      AuthenticatedUser user) {
    return brewLogService.list(
        user.id(), recipeId, userId, beanBatchId, parseDate(date), PageParams.of(page, size));
  }

  /** {@code @DateTimeFormat}을 쓰지 않는다 — 그쪽은 타입 변환 실패가 다른 code로 나간다. */
  private LocalDate parseDate(String raw) {
    if (raw == null) {
      return null;
    }
    try {
      return LocalDate.parse(raw);
    } catch (DateTimeParseException e) {
      throw new BusinessException(ErrorCode.INVALID_REQUEST, "date는 YYYY-MM-DD 형식이어야 합니다: " + raw);
    }
  }

  @GetMapping("/calendar")
  @Operation(
      summary = "월별 기록일 집계",
      description = "KST 기준으로 그 달에 기록이 있는 날짜만 희소 배열로 준다. 공개범위 판정은 목록과 같다. 미래 달도 400이 아니라 빈 결과다.")
  public BrewLogCalendarResponse calendar(
      @Parameter(description = "누구의 달력인가. 생략하면 호출자 본인.") @RequestParam(required = false)
          Long userId,
      @Parameter(description = "YYYY-MM. KST 기준의 달.", required = true)
          @RequestParam(required = false)
          String month,
      AuthenticatedUser user) {
    return brewLogService.calendar(user.id(), userId, month);
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
