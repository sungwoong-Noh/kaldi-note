package com.kaldinote.gear.application;

import com.kaldinote.common.error.BusinessException;
import com.kaldinote.common.error.ErrorCode;
import com.kaldinote.gear.domain.GrinderModel;
import com.kaldinote.gear.infrastructure.GrinderModelRepository;
import com.kaldinote.gear.presentation.dto.GrindConversionRequest;
import com.kaldinote.grind.domain.GrindConversion;
import com.kaldinote.grind.domain.GrindConverter;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class GrindConversionService {

  private final GrinderModelRepository grinderRepository;
  private final GrindConverter converter = new GrindConverter();

  public GrindConversion convert(GrindConversionRequest request) {
    // 검증 순서: 404(그라인더 없음) → 422(환산 불가) → 400(범위 밖).
    // 환산 자체가 불가능하면 설정값의 유효성을 논할 의미가 없다.
    GrinderModel source = find(request.sourceGrinderModelId());
    GrinderModel target = find(request.targetGrinderModelId());

    // 도메인 예외를 잡지 않는다. GlobalExceptionHandler가 변환한다.
    //   GrindNotConvertibleException     → 422 GRIND_NOT_CONVERTIBLE
    //   GrindSettingOutOfRangeException  → 400 GRIND_SETTING_OUT_OF_RANGE
    return converter.convert(source.toGrindSpec(), request.sourceSetting(), target.toGrindSpec());
  }

  private GrinderModel find(Long id) {
    return grinderRepository
        .findById(id)
        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "그라인더를 찾을 수 없습니다: " + id));
  }
}
