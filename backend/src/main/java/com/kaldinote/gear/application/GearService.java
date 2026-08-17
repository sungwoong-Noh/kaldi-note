package com.kaldinote.gear.application;

import com.kaldinote.common.error.BusinessException;
import com.kaldinote.common.error.ErrorCode;
import com.kaldinote.gear.domain.UserGrinder;
import com.kaldinote.gear.infrastructure.BrewFilterRepository;
import com.kaldinote.gear.infrastructure.BrewerRepository;
import com.kaldinote.gear.infrastructure.GrinderModelRepository;
import com.kaldinote.gear.infrastructure.UserGrinderRepository;
import com.kaldinote.gear.presentation.dto.BrewFilterResponse;
import com.kaldinote.gear.presentation.dto.BrewerResponse;
import com.kaldinote.gear.presentation.dto.GrinderModelResponse;
import com.kaldinote.gear.presentation.dto.UserGrinderCreateRequest;
import com.kaldinote.gear.presentation.dto.UserGrinderResponse;
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
  private final UserGrinderRepository userGrinderRepository;

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

  @Transactional
  public UserGrinderResponse createUserGrinder(Long userId, UserGrinderCreateRequest request) {
    if (!grinderRepository.existsById(request.grinderModelId())) {
      throw new BusinessException(
          ErrorCode.NOT_FOUND, "그라인더를 찾을 수 없습니다: " + request.grinderModelId());
    }
    UserGrinder grinder = UserGrinder.of(userId, request.grinderModelId(), request.nickname());
    return UserGrinderResponse.from(userGrinderRepository.save(grinder));
  }
}
