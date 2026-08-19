package com.kaldinote.gear.application;

import com.kaldinote.common.error.BusinessException;
import com.kaldinote.common.error.ErrorCode;
import com.kaldinote.gear.domain.GrinderModel;
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
import java.util.Map;
import java.util.stream.Collectors;
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
    GrinderModel model =
        grinderRepository
            .findById(request.grinderModelId())
            .orElseThrow(
                () ->
                    new BusinessException(
                        ErrorCode.NOT_FOUND, "그라인더를 찾을 수 없습니다: " + request.grinderModelId()));
    UserGrinder grinder = UserGrinder.of(userId, request.grinderModelId(), request.nickname());
    return UserGrinderResponse.of(userGrinderRepository.save(grinder), model);
  }

  /**
   * 내가 등록한 그라인더 전부. 사람당 몇 개뿐이라 페이지 봉투 없이 배열을 그대로 돌려준다.
   *
   * <p>모델을 한 번에 모아 읽어 목록 크기와 무관하게 쿼리가 두 번이다.
   */
  public List<UserGrinderResponse> findMyGrinders(Long userId) {
    List<UserGrinder> grinders = userGrinderRepository.findAllByUserId(userId);
    Map<Long, GrinderModel> models =
        grinderRepository
            .findAllById(grinders.stream().map(UserGrinder::getGrinderModelId).toList())
            .stream()
            .collect(Collectors.toMap(GrinderModel::getId, model -> model));
    return grinders.stream()
        .map(g -> UserGrinderResponse.of(g, models.get(g.getGrinderModelId())))
        .toList();
  }
}
