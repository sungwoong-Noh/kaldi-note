package com.kaldinote.catalog.presentation;

import com.kaldinote.catalog.application.AdminBeanProductService;
import com.kaldinote.catalog.application.AdminBeanProductService.Source;
import com.kaldinote.catalog.application.AdminBeanProductService.Status;
import com.kaldinote.catalog.presentation.dto.AdminBeanProductDetailResponse;
import com.kaldinote.catalog.presentation.dto.AdminBeanProductPageResponse;
import com.kaldinote.common.response.PageParams;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
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

  @GetMapping("/{id}")
  @Operation(summary = "원두 상세 — 산지 이름 · 만든 사람 · 같은 이름 수")
  public AdminBeanProductDetailResponse get(@PathVariable Long id) {
    return service.get(id);
  }
}
