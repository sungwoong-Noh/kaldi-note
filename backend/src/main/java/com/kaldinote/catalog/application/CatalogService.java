package com.kaldinote.catalog.application;

import com.kaldinote.catalog.domain.FlavorNote;
import com.kaldinote.catalog.domain.ProcessCategory;
import com.kaldinote.catalog.domain.Variety;
import com.kaldinote.catalog.infrastructure.CoffeeProcessRepository;
import com.kaldinote.catalog.infrastructure.FlavorNoteRepository;
import com.kaldinote.catalog.infrastructure.VarietyRepository;
import com.kaldinote.catalog.presentation.dto.CoffeeProcessResponse;
import com.kaldinote.catalog.presentation.dto.FlavorNoteResponse;
import com.kaldinote.catalog.presentation.dto.VarietyResponse;
import com.kaldinote.common.error.BusinessException;
import com.kaldinote.common.error.ErrorCode;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CatalogService {

  private final VarietyRepository varietyRepository;
  private final CoffeeProcessRepository processRepository;
  private final FlavorNoteRepository flavorNoteRepository;

  public List<VarietyResponse> findAllVarieties() {
    return varietyRepository.findAllByOrderByNameAsc().stream().map(VarietyResponse::from).toList();
  }

  public Map<ProcessCategory, List<CoffeeProcessResponse>> findAllProcesses() {
    return processRepository.findAllByOrderByCategoryAscNameAsc().stream()
        .map(CoffeeProcessResponse::from)
        .collect(Collectors.groupingBy(p -> ProcessCategory.valueOf(p.category())));
  }

  public List<FlavorNoteResponse> findAllFlavorNotes() {
    return flavorNoteRepository.findAllByParentIsNull().stream().map(this::toResponse).toList();
  }

  private FlavorNoteResponse toResponse(FlavorNote note) {
    List<FlavorNoteResponse> children =
        flavorNoteRepository.findAllByParent(note).stream().map(this::toResponse).toList();
    return new FlavorNoteResponse(note.getId(), note.getNameEn(), note.getNameKo(), children);
  }

  @Transactional
  public VarietyResponse createVariety(String name, String nameKo, Long userId) {
    if (varietyRepository.findByName(name).isPresent()) {
      throw new BusinessException(ErrorCode.DUPLICATE_NAME);
    }
    Variety saved = varietyRepository.save(Variety.createByUser(name, nameKo, userId));
    return VarietyResponse.from(saved);
  }
}
