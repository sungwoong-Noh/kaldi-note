package com.kaldinote.catalog.presentation;

import com.kaldinote.catalog.application.CatalogService;
import com.kaldinote.catalog.domain.ProcessCategory;
import com.kaldinote.catalog.presentation.dto.CoffeeProcessResponse;
import com.kaldinote.catalog.presentation.dto.FlavorNoteResponse;
import com.kaldinote.catalog.presentation.dto.VarietyCreateRequest;
import com.kaldinote.catalog.presentation.dto.VarietyResponse;
import com.kaldinote.common.security.AuthenticatedUser;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/catalog")
@RequiredArgsConstructor
@Tag(name = "카탈로그", description = "품종·가공법·플레이버노트 마스터 조회")
public class CatalogController {

  private final CatalogService catalogService;

  @GetMapping("/varieties")
  public List<VarietyResponse> varieties() {
    return catalogService.findAllVarieties();
  }

  @PostMapping("/varieties")
  @ResponseStatus(HttpStatus.CREATED)
  public VarietyResponse createVariety(
      @Valid @RequestBody VarietyCreateRequest request, AuthenticatedUser user) {
    return catalogService.createVariety(request.name(), request.nameKo(), user.id());
  }

  @GetMapping("/processes")
  public Map<ProcessCategory, List<CoffeeProcessResponse>> processes() {
    return catalogService.findAllProcesses();
  }

  @GetMapping("/flavor-notes")
  public List<FlavorNoteResponse> flavorNotes() {
    return catalogService.findAllFlavorNotes();
  }
}
