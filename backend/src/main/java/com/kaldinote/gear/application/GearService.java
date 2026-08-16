package com.kaldinote.gear.application;

import com.kaldinote.gear.infrastructure.BrewFilterRepository;
import com.kaldinote.gear.infrastructure.BrewerRepository;
import com.kaldinote.gear.infrastructure.GrinderModelRepository;
import com.kaldinote.gear.presentation.dto.BrewFilterResponse;
import com.kaldinote.gear.presentation.dto.BrewerResponse;
import com.kaldinote.gear.presentation.dto.GrinderModelResponse;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class GearService {

  private final GrinderModelRepository grinderRepository;
  private final BrewerRepository brewerRepository;
  private final BrewFilterRepository filterRepository;

  public List<GrinderModelResponse> findAllGrinders() {
    return grinderRepository.findAllByOrderByBrandAscNameAsc().stream()
        .map(GrinderModelResponse::from)
        .toList();
  }

  public List<BrewerResponse> findAllBrewers() {
    return brewerRepository.findAllByOrderByBrandAscNameAsc().stream()
        .map(BrewerResponse::from)
        .toList();
  }

  public List<BrewFilterResponse> findAllFilters() {
    return filterRepository.findAllByOrderByNameAsc().stream()
        .map(BrewFilterResponse::from)
        .toList();
  }
}
