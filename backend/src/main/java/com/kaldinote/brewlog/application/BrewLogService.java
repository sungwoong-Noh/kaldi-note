package com.kaldinote.brewlog.application;

import com.kaldinote.brewlog.domain.BrewLog;
import com.kaldinote.brewlog.infrastructure.BrewLogRepository;
import com.kaldinote.brewlog.presentation.dto.BrewLogCreateRequest;
import com.kaldinote.brewlog.presentation.dto.BrewLogResponse;
import com.kaldinote.common.error.BusinessException;
import com.kaldinote.common.error.ErrorCode;
import com.kaldinote.extraction.domain.BrewMeasurement;
import com.kaldinote.extraction.domain.ExtractionAnalysis;
import com.kaldinote.extraction.domain.ExtractionAnalyzer;
import com.kaldinote.gear.domain.GrinderModel;
import com.kaldinote.gear.domain.UserGrinder;
import com.kaldinote.gear.infrastructure.GrinderModelRepository;
import com.kaldinote.gear.infrastructure.UserGrinderRepository;
import com.kaldinote.grind.domain.GrindConverter;
import com.kaldinote.grind.domain.GrindSpec;
import com.kaldinote.inventory.domain.BeanBatch;
import com.kaldinote.inventory.domain.DegassingStatus;
import com.kaldinote.inventory.infrastructure.BeanBatchRepository;
import com.kaldinote.recipe.domain.Recipe;
import com.kaldinote.recipe.infrastructure.RecipeRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class BrewLogService {

  /** 평가는 ½점 단위 버튼으로만 매긴다. 범위는 DTO가 막고, 배수 여부는 Bean Validation으로 표현할 수 없어 여기서 검사한다. */
  private static final BigDecimal RATING_STEP = new BigDecimal("0.5");

  private final BrewLogRepository brewLogRepository;
  private final RecipeRepository recipeRepository;
  private final BeanBatchRepository beanBatchRepository;
  private final UserGrinderRepository userGrinderRepository;
  private final GrinderModelRepository grinderModelRepository;
  private final GrindConverter grindConverter = new GrindConverter();
  private final ExtractionAnalyzer extractionAnalyzer = new ExtractionAnalyzer();

  @Transactional
  public BrewLogResponse create(Long userId, BrewLogCreateRequest request) {
    validateRatingStep(request.rating());

    Recipe recipe = requireOwnedRecipe(userId, request.recipeId());
    BeanBatch beanBatch = requireOwnedBeanBatch(userId, request.beanBatchId());
    UserGrinder userGrinder = requireOwnedUserGrinder(userId, request.userGrinderId());
    GrinderModel grinderModel =
        grinderModelRepository
            .findById(userGrinder.getGrinderModelId())
            .orElseThrow(
                () ->
                    new BusinessException(
                        ErrorCode.NOT_FOUND,
                        "그라인더 모델을 찾을 수 없습니다: " + userGrinder.getGrinderModelId()));

    BigDecimal micron =
        computeActualGrindMicronEstimated(grinderModel, request.actualGrindSettingValue());

    // 물리적으로 불가능한 측정값(음료 > 물, EY > 30%)은 여기서 걸러진다.
    ExtractionAnalysis analysis = analyze(request);

    int daysOffRoast = computeDaysOffRoast(request.brewedAt(), beanBatch.getRoastedAt());

    BrewLog log =
        BrewLog.create(
            userId,
            recipe.getId(),
            beanBatch.getId(),
            request.brewedAt(),
            request.actualDoseG(),
            request.actualWaterG(),
            request.actualWaterTempC(),
            request.actualTotalTimeSeconds(),
            request.actualDrawdownSeconds(),
            userGrinder.getId(),
            request.actualGrindSettingValue(),
            micron,
            request.beverageWeightG(),
            request.tdsPercent(),
            daysOffRoast,
            DegassingStatus.of(daysOffRoast).name(),
            request.rating(),
            request.acidity(),
            request.sweetness(),
            request.body(),
            request.bitterness(),
            request.aftertaste(),
            request.overallNote());

    return BrewLogResponse.from(brewLogRepository.save(log), analysis);
  }

  private void validateRatingStep(BigDecimal rating) {
    if (rating == null) {
      return;
    }
    if (rating.remainder(RATING_STEP).compareTo(BigDecimal.ZERO) != 0) {
      throw new BusinessException(ErrorCode.INVALID_REQUEST, "rating은 0.5 단위여야 합니다: " + rating);
    }
  }

  private ExtractionAnalysis analyze(BrewLogCreateRequest request) {
    return extractionAnalyzer.analyze(
        new BrewMeasurement(
            request.actualDoseG(),
            request.actualWaterG(),
            request.beverageWeightG(),
            request.tdsPercent()));
  }

  private Recipe requireOwnedRecipe(Long userId, Long recipeId) {
    Recipe recipe =
        recipeRepository
            .findByIdAndDeletedAtIsNull(recipeId)
            .orElseThrow(
                () -> new BusinessException(ErrorCode.NOT_FOUND, "레시피를 찾을 수 없습니다: " + recipeId));
    if (!recipe.isOwnedBy(userId)) {
      throw new BusinessException(ErrorCode.FORBIDDEN, "본인의 레시피만 브루잉 로그에 연결할 수 있습니다.");
    }
    return recipe;
  }

  private BeanBatch requireOwnedBeanBatch(Long userId, Long beanBatchId) {
    BeanBatch batch =
        beanBatchRepository
            .findByIdAndDeletedAtIsNull(beanBatchId)
            .orElseThrow(
                () -> new BusinessException(ErrorCode.NOT_FOUND, "재고를 찾을 수 없습니다: " + beanBatchId));
    if (!batch.isOwnedBy(userId)) {
      throw new BusinessException(ErrorCode.FORBIDDEN, "본인의 재고만 브루잉 로그에 연결할 수 있습니다.");
    }
    return batch;
  }

  private UserGrinder requireOwnedUserGrinder(Long userId, Long userGrinderId) {
    UserGrinder grinder =
        userGrinderRepository
            .findById(userGrinderId)
            .orElseThrow(
                () ->
                    new BusinessException(
                        ErrorCode.NOT_FOUND, "그라인더를 찾을 수 없습니다: " + userGrinderId));
    if (!grinder.isOwnedBy(userId)) {
      throw new BusinessException(ErrorCode.FORBIDDEN, "본인의 그라인더만 브루잉 로그에 연결할 수 있습니다.");
    }
    return grinder;
  }

  /** 무단계 그라인더는 환산할 수 없다. 기록 자체는 남길 수 있어야 하므로 추정치만 비운다. */
  private BigDecimal computeActualGrindMicronEstimated(
      GrinderModel grinder, BigDecimal settingValue) {
    GrindSpec spec = grinder.toGrindSpec();
    if (!spec.convertible()) {
      return null;
    }
    return grindConverter.toMicron(spec, settingValue);
  }

  /** 과거 기록이므로 오늘이 아니라 추출 시점을 기준으로 센다. 서버 타임존에 흔들리지 않도록 UTC로 고정한다. */
  private int computeDaysOffRoast(Instant brewedAt, LocalDate roastedAt) {
    LocalDate brewedDate = brewedAt.atZone(ZoneOffset.UTC).toLocalDate();
    return (int) ChronoUnit.DAYS.between(roastedAt, brewedDate);
  }
}
