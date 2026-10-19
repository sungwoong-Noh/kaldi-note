package com.kaldinote.crawler.presentation;

import com.kaldinote.common.response.PageParams;
import com.kaldinote.common.response.PageResponse;
import com.kaldinote.common.security.AuthenticatedUser;
import com.kaldinote.crawler.application.CrawlRunResponse;
import com.kaldinote.crawler.application.CrawlRunService;
import com.kaldinote.crawler.application.CrawlSourceResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** 원두 크롤러 관리. ADMIN 전용 — SecurityConfig의 /api/v1/admin/** 규칙. 관리자 화면이 이 API를 그대로 쓴다. */
@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
@Tag(name = "관리자 · 원두 크롤러", description = "구매처별 원두 수집 실행과 기록")
public class CrawlAdminController {

  private final CrawlRunService crawlRunService;

  @GetMapping("/crawl-sources")
  @Operation(summary = "수집 대상 목록과 각자의 마지막 실행")
  public List<CrawlSourceResponse> sources() {
    return crawlRunService.sources();
  }

  @PostMapping("/crawl-sources/{key}/runs")
  @ResponseStatus(HttpStatus.ACCEPTED)
  @Operation(
      summary = "수집 시작",
      description = "비동기. 응답의 status는 항상 RUNNING이고, 진행은 GET /crawl-runs/{id}로 폴링한다.")
  public CrawlRunResponse start(@PathVariable String key, AuthenticatedUser user) {
    return crawlRunService.start(key, user.id());
  }

  @GetMapping("/crawl-runs")
  @Operation(summary = "실행 이력", description = "startedAt 내림차순.")
  public PageResponse<CrawlRunResponse> runs(
      @Parameter(description = "그 수집 대상의 실행만.") @RequestParam(required = false) String source,
      @Parameter(description = "0-based 페이지 번호. 음수면 400.", schema = @Schema(defaultValue = "0"))
          @RequestParam(required = false)
          Integer page,
      @Parameter(
              description = "페이지 크기. 1 이상 100 이하(양끝 포함), 벗어나면 400.",
              schema = @Schema(defaultValue = "20"))
          @RequestParam(required = false)
          Integer size) {
    return crawlRunService.runs(source, PageParams.of(page, size));
  }

  @GetMapping("/crawl-runs/{id}")
  @Operation(summary = "실행 상세 — 상태·생성/갱신 수·건너뛴 상품·매핑 못 한 원문")
  public CrawlRunResponse run(@PathVariable Long id) {
    return crawlRunService.run(id);
  }
}
