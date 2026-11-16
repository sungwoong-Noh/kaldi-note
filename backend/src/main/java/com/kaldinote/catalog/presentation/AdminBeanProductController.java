package com.kaldinote.catalog.presentation;

import com.kaldinote.catalog.application.AdminBeanProductService;
import com.kaldinote.catalog.application.AdminBeanProductService.Source;
import com.kaldinote.catalog.application.AdminBeanProductService.Status;
import com.kaldinote.catalog.presentation.dto.AdminBeanBulkRequest;
import com.kaldinote.catalog.presentation.dto.AdminBeanProductDetailResponse;
import com.kaldinote.catalog.presentation.dto.AdminBeanProductPageResponse;
import com.kaldinote.catalog.presentation.dto.AdminBeanProductUpdateRequest;
import com.kaldinote.common.response.PageParams;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 관리자 원두 메뉴. ADMIN 전용 — SecurityConfig의 /api/v1/admin/** 규칙. */
@RestController
@RequestMapping("/api/v1/admin/bean-products")
@RequiredArgsConstructor
@Tag(name = "관리자 · 원두", description = "수집된 원두의 빠진 정보 채우기 · 확인 · 숨김 · 올리기")
public class AdminBeanProductController {

  private final AdminBeanProductService service;

  @GetMapping
  @Operation(
      summary = "원두 목록 + 필터 pill 개수",
      description = "수정일 내림차순. counts는 status · missing을 빼고 나머지 필터를 적용해 센다.")
  public AdminBeanProductPageResponse list(
      @Parameter(description = "이름 또는 로스터 이름 부분 일치, 대소문자 무시. 앞뒤 공백 제외 50자 이하.")
          @RequestParam(required = false)
          String q,
      @RequestParam(required = false) Status status,
      @RequestParam(required = false) Source source,
      @Parameter(description = "true면 「정보 빠짐」만.") @RequestParam(required = false) Boolean missing,
      @Parameter(description = "true면 디카페인만.") @RequestParam(required = false) Boolean decaf,
      @RequestParam(required = false) Long roasterId,
      @RequestParam(required = false) Integer page,
      @Parameter(description = "1 이상 100 이하.") @RequestParam(required = false) Integer size) {
    return service.list(q, status, source, missing, decaf, roasterId, PageParams.of(page, size));
  }

  @PutMapping("/{id}")
  @Operation(
      summary = "원두 수정 — 전체 교체",
      description = "내용이 바뀌면 manuallyEdited=true(다음 수집이 구매 링크만 갱신). verified · hidden만 바뀌면 그대로.")
  public AdminBeanProductDetailResponse update(
      @PathVariable Long id, @Valid @RequestBody AdminBeanProductUpdateRequest request) {
    return service.update(id, request);
  }

  @PostMapping("/bulk")
  @Operation(summary = "일괄 확인 · 숨김 · 숨김 해제", description = "없는 id가 하나라도 있으면 404이고 아무것도 바뀌지 않는다.")
  public Map<String, Integer> bulk(@Valid @RequestBody AdminBeanBulkRequest request) {
    return Map.of("updated", service.bulk(request));
  }

  @PostMapping("/{id}/promote")
  @Operation(summary = "사용자 원두를 카탈로그로 올리기", description = "만든 사람은 그대로. 크롤러 원두는 400, 이미 올렸어도 200.")
  public AdminBeanProductDetailResponse promote(@PathVariable Long id) {
    return service.promote(id);
  }

  @GetMapping("/{id}")
  @Operation(summary = "원두 상세 — 산지 이름 · 만든 사람 · 같은 이름 수")
  public AdminBeanProductDetailResponse get(@PathVariable Long id) {
    return service.get(id);
  }
}
