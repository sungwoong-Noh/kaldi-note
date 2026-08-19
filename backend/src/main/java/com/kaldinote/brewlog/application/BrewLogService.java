package com.kaldinote.brewlog.application;

import com.kaldinote.brewlog.domain.BrewLog;
import com.kaldinote.brewlog.domain.BrewLogPatch;
import com.kaldinote.brewlog.domain.BrewLogVisibility;
import com.kaldinote.brewlog.infrastructure.BrewLogRepository;
import com.kaldinote.brewlog.presentation.dto.BrewLogCreateRequest;
import com.kaldinote.brewlog.presentation.dto.BrewLogPatchRequest;
import com.kaldinote.brewlog.presentation.dto.BrewLogResponse;
import com.kaldinote.brewlog.presentation.dto.BrewLogSummaryResponse;
import com.kaldinote.common.error.BusinessException;
import com.kaldinote.common.error.ErrorCode;
import com.kaldinote.common.response.PageParams;
import com.kaldinote.common.response.PageResponse;
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
import com.kaldinote.user.application.FollowService;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class BrewLogService {

  /** 평가는 ½점 단위 버튼으로만 매긴다. 범위는 DTO가 막고, 배수 여부는 Bean Validation으로 표현할 수 없어 여기서 검사한다. */
  private static final BigDecimal RATING_STEP = new BigDecimal("0.5");

  private static final Sort LIST_SORT = Sort.by(Sort.Order.desc("brewedAt"), Sort.Order.desc("id"));

  private final BrewLogRepository brewLogRepository;
  private final RecipeRepository recipeRepository;
  private final BeanBatchRepository beanBatchRepository;
  private final UserGrinderRepository userGrinderRepository;
  private final GrinderModelRepository grinderModelRepository;
  private final FollowService followService;
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
            request.visibility(),
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

  public BrewLogResponse get(Long userId, Long brewLogId) {
    BrewLog log = findViewable(userId, brewLogId);
    return BrewLogResponse.from(log, analyze(log));
  }

  /**
   * 볼 수 있는 브루잉 로그 목록. 정렬은 brewedAt 내림차순이다 — 어제 내린 것을 오늘 입력해도 시간순이 맞게 들어간다. createdAt으로 정렬하면 과거 기록을
   * 몰아 입력할 때 순서가 엉킨다.
   */
  public PageResponse<BrewLogSummaryResponse> list(
      Long viewerId, Long recipeId, Long userId, Long beanBatchId, PageParams params) {
    return PageResponse.from(
        brewLogRepository.findVisible(
            viewerId, recipeId, userId, beanBatchId, params.toPageable(LIST_SORT)),
        log -> BrewLogSummaryResponse.from(log, analyze(log)));
  }

  /** EY·SCA는 DB에 없다. 저장된 실측값으로 조회할 때마다 계산한다. */
  private ExtractionAnalysis analyze(BrewLog log) {
    return extractionAnalyzer.analyze(
        new BrewMeasurement(
            log.getActualDoseG(),
            log.getActualWaterG(),
            log.getBeverageWeightG(),
            log.getTdsPercent()));
  }

  /**
   * 부분 수정. 실측값이 바뀌면 파생 값을 다시 계산해 저장한다.
   *
   * <p>EY·SCA는 여기서 다루지 않는다. DB에 없고 조회할 때마다 계산하므로 실측값만 고치면 자동으로 따라온다. 실제로 다시 저장해야 하는 것은 DB 컬럼인
   * actualGrindMicronEstimated·daysOffRoast·degassingStatus뿐이다.
   */
  @Transactional
  public BrewLogResponse patch(Long userId, Long brewLogId, BrewLogPatchRequest request) {
    validateRatingStep(request.rating());
    BrewLog log = requireOwnedLog(userId, brewLogId);

    BigDecimal micron = recomputeMicron(userId, log, request);
    Integer daysOffRoast = null;
    String degassingStatus = null;
    if (request.brewedAt() != null) {
      // 재고가 이미 삭제됐으면 다시 셀 수 없다. 과거 기록을 보존하려고 기존 값을 그대로 둔다.
      BeanBatch batch =
          beanBatchRepository.findByIdAndDeletedAtIsNull(log.getBeanBatchId()).orElse(null);
      if (batch != null) {
        int recomputed = computeDaysOffRoast(request.brewedAt(), batch.getRoastedAt());
        daysOffRoast = recomputed;
        degassingStatus = DegassingStatus.of(recomputed).name();
      }
    }

    log.applyPatch(toDomainPatch(request), micron, daysOffRoast, degassingStatus);
    return BrewLogResponse.from(log, analyze(log));
  }

  /** 그라인더나 설정값이 바뀐 경우에만 다시 계산한다. 그대로면 null을 돌려 기존 값을 유지시킨다. */
  private BigDecimal recomputeMicron(Long userId, BrewLog log, BrewLogPatchRequest request) {
    if (request.userGrinderId() == null && request.actualGrindSettingValue() == null) {
      return null;
    }
    Long grinderId =
        request.userGrinderId() != null ? request.userGrinderId() : log.getUserGrinderId();
    BigDecimal setting =
        request.actualGrindSettingValue() != null
            ? request.actualGrindSettingValue()
            : log.getActualGrindSettingValue();

    UserGrinder userGrinder = requireOwnedUserGrinder(userId, grinderId);
    GrinderModel grinderModel =
        grinderModelRepository
            .findById(userGrinder.getGrinderModelId())
            .orElseThrow(
                () ->
                    new BusinessException(
                        ErrorCode.NOT_FOUND,
                        "그라인더 모델을 찾을 수 없습니다: " + userGrinder.getGrinderModelId()));
    return computeActualGrindMicronEstimated(grinderModel, setting);
  }

  private BrewLogPatch toDomainPatch(BrewLogPatchRequest r) {
    return new BrewLogPatch(
        r.brewedAt(),
        r.visibility(),
        r.actualDoseG(),
        r.actualWaterG(),
        r.actualWaterTempC(),
        r.actualTotalTimeSeconds(),
        r.actualDrawdownSeconds(),
        r.userGrinderId(),
        r.actualGrindSettingValue(),
        r.beverageWeightG(),
        r.tdsPercent(),
        r.rating(),
        r.acidity(),
        r.sweetness(),
        r.body(),
        r.bitterness(),
        r.aftertaste(),
        r.overallNote());
  }

  @Transactional
  public void delete(Long userId, Long brewLogId) {
    requireOwnedLog(userId, brewLogId).softDelete();
  }

  /** media 도메인이 업로드 권한을 확인할 때 쓴다. */
  public void requireOwned(Long userId, Long brewLogId) {
    requireOwnedLog(userId, brewLogId);
  }

  /** 소유자 전용 동작(수정·삭제)의 공통 조회. 검증 순서는 404 → 403이다. */
  private BrewLog requireOwnedLog(Long userId, Long brewLogId) {
    BrewLog log = findAlive(brewLogId);
    if (!log.isOwnedBy(userId)) {
      throw new BusinessException(ErrorCode.FORBIDDEN, "본인의 브루잉 로그만 접근할 수 있습니다.");
    }
    return log;
  }

  /** 소프트 삭제된 로그는 없는 것으로 취급한다. */
  private BrewLog findAlive(Long brewLogId) {
    return brewLogRepository
        .findByIdAndDeletedAtIsNull(brewLogId)
        .orElseThrow(
            () -> new BusinessException(ErrorCode.NOT_FOUND, "브루잉 로그를 찾을 수 없습니다: " + brewLogId));
  }

  /** media 도메인이 조회(첨부 목록) 권한을 확인할 때 쓴다. */
  public void requireViewable(Long userId, Long brewLogId) {
    findViewable(userId, brewLogId);
  }

  /** 판정 규칙은 RecipeService.findViewable과 같다. enum이 달라 공통 함수로 묶지 않는다. */
  private BrewLog findViewable(Long userId, Long brewLogId) {
    BrewLog log = findAlive(brewLogId);
    if (isViewable(userId, log)) {
      return log;
    }
    throw new BusinessException(ErrorCode.FORBIDDEN, "이 브루잉 로그를 볼 권한이 없습니다.");
  }

  private boolean isViewable(Long userId, BrewLog log) {
    if (log.isOwnedBy(userId)) {
      return true;
    }
    if (log.getVisibility() == BrewLogVisibility.PUBLIC) {
      return true;
    }
    return log.getVisibility() == BrewLogVisibility.FRIENDS
        && followService.isMutual(userId, log.getUserId());
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
