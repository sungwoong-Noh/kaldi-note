package com.kaldinote.recipe.application;

import com.kaldinote.brewlog.infrastructure.BrewLogRepository;
import com.kaldinote.common.error.BusinessException;
import com.kaldinote.common.error.ErrorCode;
import com.kaldinote.common.response.PageParams;
import com.kaldinote.common.response.PageResponse;
import com.kaldinote.gear.domain.Brewer;
import com.kaldinote.gear.domain.GrinderModel;
import com.kaldinote.gear.infrastructure.BrewerRepository;
import com.kaldinote.gear.infrastructure.GrinderModelRepository;
import com.kaldinote.grind.domain.GrindConverter;
import com.kaldinote.grind.domain.GrindSpec;
import com.kaldinote.recipe.domain.DripperFilter;
import com.kaldinote.recipe.domain.GrindSettingUnit;
import com.kaldinote.recipe.domain.Recipe;
import com.kaldinote.recipe.domain.RecipeRoastLevel;
import com.kaldinote.recipe.domain.RecipeSearchOwner;
import com.kaldinote.recipe.domain.RecipeSearchScope;
import com.kaldinote.recipe.domain.RecipeSearchSort;
import com.kaldinote.recipe.domain.RecipeSourceType;
import com.kaldinote.recipe.domain.RecipeStep;
import com.kaldinote.recipe.domain.RecipeTemperatureType;
import com.kaldinote.recipe.domain.RecipeVisibility;
import com.kaldinote.recipe.domain.StepType;
import com.kaldinote.recipe.infrastructure.RecipeRepository;
import com.kaldinote.recipe.infrastructure.RecipeStepRepository;
import com.kaldinote.recipe.presentation.dto.CreateRecipeRequest;
import com.kaldinote.recipe.presentation.dto.ForkRequest;
import com.kaldinote.recipe.presentation.dto.RecipeResponse;
import com.kaldinote.recipe.presentation.dto.RecipeSummaryResponse;
import com.kaldinote.recipe.presentation.dto.StepRequest;
import com.kaldinote.recipe.presentation.dto.UpdateRecipeRequest;
import com.kaldinote.user.application.FollowService;
import com.kaldinote.user.application.UserService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class RecipeService {

  private static final BigDecimal MICRON_MIN = new BigDecimal("100");
  private static final BigDecimal MICRON_MAX = new BigDecimal("2000");

  private static final Sort LIST_SORT =
      Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"));

  private final RecipeRepository recipeRepository;
  private final RecipeStepRepository recipeStepRepository;
  private final GrinderModelRepository grinderRepository;
  private final BrewerRepository brewerRepository;
  private final BrewLogRepository brewLogRepository;
  private final FollowService followService;
  private final UserService userService;
  private final GrindConverter grindConverter = new GrindConverter();

  @Transactional
  public RecipeResponse create(Long userId, CreateRecipeRequest request) {
    if (request.sourceType() != null && request.sourceType() != RecipeSourceType.USER) {
      throw new BusinessException(ErrorCode.FORBIDDEN, "일반 API로는 CURATED 레시피를 만들 수 없습니다.");
    }
    requireExists(request.brewerId(), brewerRepository::existsById, "브루어");

    BigDecimal micron =
        computeGrindMicronEstimated(
            request.grindSettingUnit(), request.grindSettingValue(), request.grinderModelId());

    List<RecipeStep> steps = buildSteps(request.steps(), request.waterG());

    Recipe recipe =
        Recipe.create(
            userId,
            request.title(),
            request.description(),
            request.visibility() == null ? RecipeVisibility.PRIVATE : request.visibility(),
            request.doseG(),
            request.waterG(),
            request.waterTempC(),
            request.totalTimeSeconds(),
            request.brewerId(),
            request.filterId(),
            request.grinderModelId(),
            request.grindSettingValue(),
            request.grindSettingUnit(),
            micron,
            request.temperatureType() == null
                ? RecipeTemperatureType.HOT
                : request.temperatureType(),
            request.recommendedRoastLevel() == null
                ? RecipeRoastLevel.MEDIUM
                : request.recommendedRoastLevel());
    recipe.replaceSteps(steps);

    return RecipeResponse.from(recipeRepository.save(recipe), 0L, 0L);
  }

  public RecipeResponse get(Long userId, Long recipeId) {
    return withCounts(findViewable(userId, recipeId));
  }

  /** 새로 저장된 레시피(레시피 자체·포크본)는 포크·브루 실적이 있을 수 없으므로 0을 하드코딩한 from()과 달리, 기존 레시피는 실제 집계가 필요하다. */
  private RecipeResponse withCounts(Recipe recipe) {
    long savedCount = recipeRepository.countByParentRecipeIdAndDeletedAtIsNull(recipe.getId());
    long brewCount = brewLogRepository.countByRecipeIdAndDeletedAtIsNull(recipe.getId());
    return RecipeResponse.from(recipe, savedCount, brewCount);
  }

  /**
   * 볼 수 있는 레시피 목록. 정렬은 서버가 고정한다(sort 파라미터를 열지 않는다).
   *
   * <p>createdAt만으로 정렬하면 같은 시각에 만들어진 두 건의 순서를 PostgreSQL이 보장하지 않아 페이지를 넘길 때 중복·누락이 생긴다. id를 2차 기준으로
   * 둔다.
   */
  public PageResponse<RecipeSummaryResponse> list(
      Long viewerId, Long ownerUserId, PageParams params) {
    var page = recipeRepository.findVisible(viewerId, ownerUserId, params.toPageable(LIST_SORT));
    return toSummaryPage(page);
  }

  /** RecipeSummaryResponse 배치 조회 3종(savedCount·authorDisplayName·brewCount)을 페이지 하나에 적용한다. */
  private PageResponse<RecipeSummaryResponse> toSummaryPage(Page<Recipe> page) {
    List<Recipe> recipes = page.getContent();
    Map<Long, Long> savedCounts = savedCountsFor(recipes);
    Map<Long, Long> brewCounts = brewCountsFor(recipes);
    Map<Long, String> authorDisplayNames = authorDisplayNamesFor(recipes);
    return PageResponse.from(
        page,
        r ->
            RecipeSummaryResponse.from(
                r,
                savedCounts.getOrDefault(r.getId(), 0L),
                authorDisplayNames.get(r.getId()),
                brewCounts.getOrDefault(r.getId(), 0L)));
  }

  /** 페이지 안 레시피들의 savedCount를 한 번에 조회한다. 빈 목록이면 쿼리를 아예 안 부른다. */
  private Map<Long, Long> savedCountsFor(List<Recipe> recipes) {
    if (recipes.isEmpty()) {
      return Map.of();
    }
    List<Long> ids = recipes.stream().map(Recipe::getId).toList();
    Map<Long, Long> counts = new HashMap<>();
    for (RecipeRepository.SavedCountRow row : recipeRepository.countSavedForIds(ids)) {
      counts.put(row.getParentRecipeId(), row.getCnt());
    }
    return counts;
  }

  /** 페이지 안 레시피들의 brewCount를 한 번에 조회한다. */
  private Map<Long, Long> brewCountsFor(List<Recipe> recipes) {
    if (recipes.isEmpty()) {
      return Map.of();
    }
    List<Long> ids = recipes.stream().map(Recipe::getId).toList();
    Map<Long, Long> counts = new HashMap<>();
    for (BrewLogRepository.BrewCountRow row : brewLogRepository.countBrewsForIds(ids)) {
      counts.put(row.getRecipeId(), row.getCnt());
    }
    return counts;
  }

  /**
   * 페이지 안 레시피들의 authorDisplayName을 채운다. CURATED는 authorName을 그대로 쓰고(배치 불필요), USER 소유는 ownerUserId
   * 목록을 한 번에 조회해 닉네임을 채운다. ownerUserId가 null(유기물)이면 authorName으로 대체한다.
   */
  private Map<Long, String> authorDisplayNamesFor(List<Recipe> recipes) {
    List<Long> ownerIds =
        recipes.stream()
            .filter(r -> r.getSourceType() != RecipeSourceType.CURATED)
            .map(Recipe::getOwnerUserId)
            .filter(java.util.Objects::nonNull)
            .toList();
    Map<Long, String> nicknames = userService.nicknamesByIds(ownerIds);

    Map<Long, String> result = new HashMap<>();
    for (Recipe r : recipes) {
      if (r.getSourceType() == RecipeSourceType.CURATED || r.getOwnerUserId() == null) {
        result.put(r.getId(), r.getAuthorName());
      } else {
        result.put(r.getId(), nicknames.get(r.getOwnerUserId()));
      }
    }
    return result;
  }

  /**
   * 검색·필터·정렬·범위(내 서랍/둘러보기).
   *
   * <p>doseMin이 doseMax보다 크면(둘 다 있을 때) 400이다(AC-RECIPESBREWS-41).
   *
   * <p>scope=DRAWER에서는 ownerUserId·sort를 무시하고 항상 호출자 본인 기준·createdAt desc, id desc로
   * 고정한다(AC-RECIPESBREWS-13·17). scope·ownerUserId가 둘 다 생략되면 이것도 DRAWER로 취급한다(AC-RECIPESBREWS-19) —
   * 다만 scope는 생략하고 ownerUserId만 준 옛 방식 호출(AC-LIST-16·33)은 하위 호환을 위해 기존 list()로 그대로 처리한다.
   */
  public PageResponse<RecipeSummaryResponse> search(
      Long userId,
      Long ownerUserId,
      RecipeSearchScope scope,
      String q,
      RecipeTemperatureType temp,
      List<RecipeRoastLevel> roast,
      BigDecimal doseMin,
      BigDecimal doseMax,
      List<DripperFilter> dripper,
      RecipeSearchOwner owner,
      RecipeSearchSort sort,
      PageParams params) {
    if (doseMin != null && doseMax != null && doseMin.compareTo(doseMax) > 0) {
      throw new BusinessException(
          ErrorCode.INVALID_REQUEST, "doseMin은 doseMax보다 클 수 없습니다: " + doseMin + " > " + doseMax);
    }

    if (scope == RecipeSearchScope.PUBLIC) {
      Page<Recipe> page =
          recipeRepository.searchPublic(
              q,
              temp == null ? null : temp.name(),
              toArray(roast),
              doseMin,
              doseMax,
              resolveBrewerIds(dripper),
              sort == null ? null : sort.name(),
              params.toPageable(Sort.unsorted())); // 정렬은 네이티브 쿼리의 ORDER BY가 이미 정한다
      return toSummaryPage(page);
    }

    if (scope == null && ownerUserId != null) {
      return list(userId, ownerUserId, params);
    }

    Page<Recipe> page =
        recipeRepository.searchDrawer(
            userId,
            owner == null || owner == RecipeSearchOwner.ALL ? null : owner.name(),
            params.toPageable(Sort.unsorted())); // 정렬은 네이티브 쿼리의 ORDER BY가 이미 정한다
    return toSummaryPage(page);
  }

  private String[] toArray(List<RecipeRoastLevel> roast) {
    if (roast == null || roast.isEmpty()) {
      return null;
    }
    return roast.stream().map(Enum::name).toArray(String[]::new);
  }

  /**
   * 기구(dripper) 필터를 실제 브루어 id 목록으로 바꾼다. "V60"은 브랜드가 아니라 Hario의 제품 라인명이라 이름으로 찾고, 나머지는 브랜드로
   * 찾는다(AC-RECIPESBREWS-08·09·10).
   */
  private Long[] resolveBrewerIds(List<DripperFilter> dripper) {
    if (dripper == null || dripper.isEmpty()) {
      return null;
    }
    return dripper.stream()
        .flatMap(
            d ->
                switch (d) {
                  case V60 -> brewerRepository.findByNameStartingWithIgnoreCase("V60").stream();
                  case KALITA -> brewerRepository.findByBrandIgnoreCase("Kalita").stream();
                  case ORIGAMI -> brewerRepository.findByBrandIgnoreCase("Origami").stream();
                  case CLEVER -> brewerRepository.findByBrandIgnoreCase("Clever").stream();
                })
        .map(Brewer::getId)
        .toArray(Long[]::new);
  }

  /**
   * 포크(담기). 인가는 조회 인가와 동일하다(findViewable 재사용) — 스펙이 "볼 수 있으면 포크 가능"으로 정의했다. 원본과 스텝을 깊은 복사하므로 이후 원본이
   * 수정·삭제돼도 포크본은 변하지 않는다.
   *
   * <p>바디로 넘긴 필드는 그 값으로, 생략한 필드는 원본 값으로 덮어쓴다(AC-RECIPESBREWS-30~32). request가 null(바디 없음)이면 원본
   * 그대로다. parentRecipeId·sourceAuthorName은 바디와 무관하게 forkFrom이 이미 정한 값을 유지한다(AC-RECIPESBREWS-33).
   */
  @Transactional
  public RecipeResponse fork(Long userId, Long recipeId, ForkRequest request) {
    Recipe original = findViewable(userId, recipeId);
    Recipe fork = Recipe.forkFrom(original, userId, sourceAuthorNameOf(original));
    List<RecipeStep> copiedSteps = original.getSteps().stream().map(RecipeStep::copyOf).toList();
    fork.replaceSteps(copiedSteps);

    if (request != null) {
      requireExists(request.brewerId(), brewerRepository::existsById, "브루어");
      Long grinderModelId = firstNonNull(request.grinderModelId(), original.getGrinderModelId());
      GrindSettingUnit grindSettingUnit =
          firstNonNull(request.grindSettingUnit(), original.getGrindSettingUnit());
      BigDecimal grindSettingValue =
          firstNonNull(request.grindSettingValue(), original.getGrindSettingValue());
      BigDecimal micron =
          computeGrindMicronEstimated(grindSettingUnit, grindSettingValue, grinderModelId);

      fork.applyForkOverrides(
          firstNonNull(request.title(), original.getTitle()),
          firstNonNull(request.description(), original.getDescription()),
          firstNonNull(request.doseG(), original.getDoseG()),
          firstNonNull(request.waterG(), original.getWaterG()),
          firstNonNull(request.waterTempC(), original.getWaterTempC()),
          firstNonNull(request.totalTimeSeconds(), original.getTotalTimeSeconds()),
          firstNonNull(request.brewerId(), original.getBrewerId()),
          firstNonNull(request.filterId(), original.getFilterId()),
          grinderModelId,
          grindSettingValue,
          grindSettingUnit,
          micron,
          firstNonNull(request.temperatureType(), original.getTemperatureType()),
          firstNonNull(request.recommendedRoastLevel(), original.getRecommendedRoastLevel()));
    }

    return RecipeResponse.from(recipeRepository.save(fork), 0L, 0L);
  }

  private <T> T firstNonNull(T override, T original) {
    return override != null ? override : original;
  }

  /**
   * 포크 시점에 고정할 출처 표기. CURATED는 authorName을 그대로 쓴다. USER는 소유자 닉네임을 조회하되, 탈퇴 등으로 owner_user_id가 이미
   * null인 유기 레시피(orphan)는 조회할 대상이 없으므로 null로 둔다.
   */
  private String sourceAuthorNameOf(Recipe recipe) {
    if (recipe.getSourceType() == RecipeSourceType.CURATED) {
      return recipe.getAuthorName();
    }
    if (recipe.getOwnerUserId() == null) {
      return null;
    }
    return userService.profile(recipe.getOwnerUserId()).nickname();
  }

  /** media 도메인이 업로드 권한을 확인할 때 쓴다. 엔티티를 밖으로 내보내지 않는다(도메인 간 ID 참조 원칙). */
  public void requireOwned(Long userId, Long recipeId) {
    findOwned(userId, recipeId);
  }

  /**
   * media 도메인이 조회(첨부 목록) 권한을 확인할 때, brewlog 도메인이 브루잉 시점 레시피를 가져올 때 쓴다. 반환형이 Recipe인 이유는
   * BrewLogService가 recipeSnapshot을 만들려면 레시피 값 전체가 필요하기 때문이다(ID만으로는 부족하다).
   */
  public Recipe requireViewable(Long userId, Long recipeId) {
    return findViewable(userId, recipeId);
  }

  /**
   * 브루 스냅샷에 쓸 표시용 작성자명. 포크본은 담기(fork) 시점에 sourceAuthorName이 이미 고정돼 있으므로 그 값을 그대로 쓰고, 그렇지 않은(포크되지
   * 않은) 레시피는 지금 시점 기준으로 다시 계산한다.
   */
  public String authorNameFor(Recipe recipe) {
    return recipe.getSourceAuthorName() != null
        ? recipe.getSourceAuthorName()
        : sourceAuthorNameOf(recipe);
  }

  /**
   * 조회 인가. 스펙의 판정 순서를 그대로 따른다: 소유자 → PUBLIC → FRIENDS+상호팔로우 → 403.
   *
   * <p>쓰기(update/delete)는 findOwned를 계속 쓴다. 여기서 갈라놓지 않으면 PUBLIC 레시피를 남이 수정할 수 있게 된다(AC-VIS-14·15).
   */
  private Recipe findViewable(Long userId, Long recipeId) {
    Recipe recipe =
        recipeRepository
            .findByIdAndDeletedAtIsNull(recipeId)
            .orElseThrow(
                () -> new BusinessException(ErrorCode.NOT_FOUND, "레시피를 찾을 수 없습니다: " + recipeId));
    if (isViewable(userId, recipe)) {
      return recipe;
    }
    throw new BusinessException(ErrorCode.FORBIDDEN, "이 레시피를 볼 권한이 없습니다.");
  }

  private boolean isViewable(Long userId, Recipe recipe) {
    if (recipe.isOwnedBy(userId)) {
      return true;
    }
    if (recipe.getVisibility() == RecipeVisibility.PUBLIC) {
      return true;
    }
    return recipe.getVisibility() == RecipeVisibility.FRIENDS
        && followService.isMutual(userId, recipe.getOwnerUserId());
  }

  @Transactional
  public RecipeResponse update(Long userId, Long recipeId, UpdateRecipeRequest request) {
    Recipe recipe = findOwned(userId, recipeId);
    // 카운트 조회를 스텝 교체보다 먼저 한다 — 이후에 두면 count 쿼리의 자동 flush가 deleteAllByRecipe
    // 이후 아직 flush되지 않은 새 스텝 insert를 끌어올려, Hibernate가 insert를 delete보다 먼저
    // 실행하려다 uq_recipe_steps_order 위반을 낸다.
    long savedCount = recipeRepository.countByParentRecipeIdAndDeletedAtIsNull(recipe.getId());
    long brewCount = brewLogRepository.countByRecipeIdAndDeletedAtIsNull(recipe.getId());

    requireExists(request.brewerId(), brewerRepository::existsById, "브루어");

    BigDecimal micron =
        computeGrindMicronEstimated(
            request.grindSettingUnit(), request.grindSettingValue(), request.grinderModelId());
    List<RecipeStep> steps = buildSteps(request.steps(), request.waterG());

    recipe.applyUpdate(
        request.title(),
        request.description(),
        request.visibility() == null ? RecipeVisibility.PRIVATE : request.visibility(),
        request.doseG(),
        request.waterG(),
        request.waterTempC(),
        request.totalTimeSeconds(),
        request.brewerId(),
        request.filterId(),
        request.grinderModelId(),
        request.grindSettingValue(),
        request.grindSettingUnit(),
        micron,
        request.temperatureType() == null ? RecipeTemperatureType.HOT : request.temperatureType(),
        request.recommendedRoastLevel() == null
            ? RecipeRoastLevel.MEDIUM
            : request.recommendedRoastLevel());

    // UNIQUE(recipe_id, step_order) 위반을 피하려면 기존 스텝을 지우고 flush한 뒤 새로 넣는다.
    // clear()+addAll()만 하면 Hibernate가 insert를 delete보다 먼저 실행해 유니크 제약에 걸린다.
    recipeStepRepository.deleteAllByRecipe(recipe);
    recipeStepRepository.flush();
    recipe.getSteps().clear();
    recipe.replaceSteps(steps);

    return RecipeResponse.from(recipe, savedCount, brewCount);
  }

  @Transactional
  public void delete(Long userId, Long recipeId) {
    Recipe recipe = findOwned(userId, recipeId);
    recipe.softDelete();
  }

  private Recipe findOwned(Long userId, Long recipeId) {
    Recipe recipe =
        recipeRepository
            .findByIdAndDeletedAtIsNull(recipeId)
            .orElseThrow(
                () -> new BusinessException(ErrorCode.NOT_FOUND, "레시피를 찾을 수 없습니다: " + recipeId));
    if (!recipe.isOwnedBy(userId)) {
      throw new BusinessException(ErrorCode.FORBIDDEN, "본인의 레시피만 접근할 수 있습니다.");
    }
    return recipe;
  }

  private BigDecimal computeGrindMicronEstimated(
      GrindSettingUnit unit, BigDecimal value, Long grinderModelId) {
    if (unit == null) {
      return null;
    }
    if (value == null) {
      throw new BusinessException(
          ErrorCode.INVALID_REQUEST, "grindSettingUnit이 있으면 grindSettingValue가 필요합니다.");
    }
    if (unit == GrindSettingUnit.MICRON) {
      if (value.compareTo(MICRON_MIN) < 0 || value.compareTo(MICRON_MAX) > 0) {
        throw new BusinessException(ErrorCode.INVALID_REQUEST, "MICRON 설정값은 100~2000 사이여야 합니다.");
      }
      return value.setScale(0, RoundingMode.HALF_UP);
    }

    // CLICK / NUMBER
    if (grinderModelId == null) {
      throw new BusinessException(
          ErrorCode.INVALID_REQUEST, "grindSettingUnit이 CLICK/NUMBER이면 grinderModelId가 필요합니다.");
    }
    GrinderModel grinder =
        grinderRepository
            .findById(grinderModelId)
            .orElseThrow(
                () ->
                    new BusinessException(
                        ErrorCode.NOT_FOUND, "그라인더를 찾을 수 없습니다: " + grinderModelId));
    GrindSpec spec = grinder.toGrindSpec();
    if (!spec.convertible()) {
      return null; // 무단계 그라인더: 환산 불가 → 스냅샷 없이 성공 (AC-RECIPE-08)
    }
    return grindConverter.toMicron(spec, value); // 범위 밖이면 GrindSettingOutOfRangeException → 400
  }

  private void requireExists(Long id, java.util.function.Predicate<Long> existsById, String label) {
    if (id != null && !existsById.test(id)) {
      throw new BusinessException(ErrorCode.NOT_FOUND, label + "를 찾을 수 없습니다: " + id);
    }
  }

  private List<RecipeStep> buildSteps(List<StepRequest> stepRequests, BigDecimal totalWaterG) {
    List<RecipeStep> steps = new ArrayList<>();
    BigDecimal sum = BigDecimal.ZERO;

    for (int i = 0; i < stepRequests.size(); i++) {
      StepRequest s = stepRequests.get(i);
      validateStepWater(s);

      if (i > 0) {
        StepRequest prev = stepRequests.get(i - 1);
        int prevEnd = prev.startAtSeconds() + prev.durationSeconds();
        if (prevEnd > s.startAtSeconds()) {
          throw new BusinessException(ErrorCode.RECIPE_STEP_OVERLAP);
        }
      }

      if (s.waterG() != null) {
        sum = sum.add(s.waterG());
      }
      steps.add(
          RecipeStep.of(
              i + 1,
              s.stepType(),
              s.startAtSeconds(),
              s.durationSeconds(),
              s.waterG(),
              s.pourTechnique(),
              s.agitation(),
              s.note()));
    }

    if (!stepRequests.isEmpty() && sum.compareTo(totalWaterG) != 0) {
      throw new BusinessException(ErrorCode.RECIPE_STEP_WATER_MISMATCH);
    }
    return steps;
  }

  private void validateStepWater(StepRequest s) {
    boolean pours = s.stepType() == StepType.BLOOM || s.stepType() == StepType.POUR;
    boolean hasPositiveWater = s.waterG() != null && s.waterG().compareTo(BigDecimal.ZERO) > 0;
    if (pours && !hasPositiveWater) {
      throw new BusinessException(ErrorCode.RECIPE_STEP_WATER_INVALID, "붓는 스텝은 물량이 0보다 커야 합니다.");
    }
    if (!pours && hasPositiveWater) {
      throw new BusinessException(ErrorCode.RECIPE_STEP_WATER_INVALID, "붓지 않는 스텝에는 물량을 넣을 수 없습니다.");
    }
  }
}
