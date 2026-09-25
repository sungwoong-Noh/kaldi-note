package com.kaldinote.brewlog.infrastructure;

import com.kaldinote.brewlog.domain.BrewLog;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BrewLogRepository extends JpaRepository<BrewLog, Long> {

  Optional<BrewLog> findByIdAndDeletedAtIsNull(Long id);

  long countByRecipeIdAndDeletedAtIsNull(Long recipeId);

  /** 잔 통계 — 이번 달(KST) 건수(AC-RECIPESBREWS-21). */
  @Query(
      value =
          "select count(*) from brew_logs "
              + "where user_id = :userId and deleted_at is null "
              + "and brewed_at >= :startInclusive and brewed_at < :endExclusive",
      nativeQuery = true)
  long countThisMonth(
      @Param("userId") Long userId,
      @Param("startInclusive") Instant startInclusive,
      @Param("endExclusive") Instant endExclusive);

  /** 잔 통계 — 평균 별점. rating이 null인 로그는 avg()가 자동으로 제외한다(AC-RECIPESBREWS-23). 로그가 0건이면 null이다. */
  @Query(
      value = "select avg(rating) from brew_logs where user_id = :userId and deleted_at is null",
      nativeQuery = true)
  BigDecimal averageRating(@Param("userId") Long userId);

  /**
   * 잔 통계 — actualDoseG의 최빈값. 동점이면 가장 최근 brewedAt인 값을 돌려준다(AC-RECIPESBREWS-25). PostgreSQL의 {@code
   * mode() within group}은 동점 처리를 해 주지 않아 직접 집계한다.
   */
  @Query(
      value =
          "select actual_dose_g from brew_logs where user_id = :userId and deleted_at is null "
              + "group by actual_dose_g order by count(*) desc, max(brewed_at) desc limit 1",
      nativeQuery = true)
  BigDecimal favoriteDoseG(@Param("userId") Long userId);

  /**
   * 잔 통계 — 전체 기간 최다 브루 레시피 id. 동점이면 가장 최근 brewedAt인 레시피다(AC-RECIPESBREWS-27). recipeId가 null인
   * 로그(원본이 지워진 스냅샷 전용 잔)는 집계에서 뺀다.
   */
  @Query(
      value =
          "select recipe_id from brew_logs "
              + "where user_id = :userId and deleted_at is null and recipe_id is not null "
              + "group by recipe_id order by count(*) desc, max(brewed_at) desc limit 1",
      nativeQuery = true)
  Long favoriteRecipeId(@Param("userId") Long userId);

  /**
   * 목록용 공개범위 판정. RecipeRepository.findVisible과 같은 구조다. 소유자 컬럼 이름과 enum 타입만 다르다.
   *
   * <p>필터 셋은 AND로 결합한다. 존재하지 않거나 볼 수 없는 대상을 가리켜도 404·403이 아니라 빈 결과가 나온다 — id를 바꿔가며 타인의 비공개 데이터 존재
   * 여부를 알아내는 것을 막는다.
   *
   * <p><b>★ {@link #countByKstDay}·{@link #findVisibleForPrimaryRecipe}의 where 절과 문자 그대로 같아야
   * 한다.</b> 한쪽만 고치면 「목록에는 보이는데 달력에는 점이 없다」가 된다.
   *
   * <p><b>{@code startInclusive}·{@code endExclusive}는 null을 받지 않는다.</b> JPQL에서 온전히 IS NULL로만 쓰이는
   * {@code Instant} 파라미터는 PostgreSQL이 바인드 타입을 추론하지 못해 "could not determine data type" 오류를 낸다({@code
   * recipeId} 같은 {@code Long}은 같은 자리에서 문제가 없었다 — Hibernate 7의 타입 추론이 기본 수치형과 시각형에서 다르게 동작한다). 날짜
   * 필터가 없을 때는 서비스가 시각 범위 전체를 덮는 값을 넘긴다.
   */
  @Query(
      value =
          """
          select b from BrewLog b
          where b.deletedAt is null
            and (:recipeId is null or b.recipeId = :recipeId)
            and (:userId is null or b.userId = :userId)
            and (:beanBatchId is null or b.beanBatchId = :beanBatchId)
            and b.brewedAt >= :startInclusive
            and b.brewedAt < :endExclusive
            and ( b.userId = :viewerId
               or b.visibility = com.kaldinote.brewlog.domain.BrewLogVisibility.PUBLIC
               or ( b.visibility = com.kaldinote.brewlog.domain.BrewLogVisibility.FRIENDS
                    and exists (select 1 from Follow f1
                                where f1.followerUserId = :viewerId
                                  and f1.followeeUserId = b.userId)
                    and exists (select 1 from Follow f2
                                where f2.followerUserId = b.userId
                                  and f2.followeeUserId = :viewerId) ) )
          """,
      countQuery =
          """
          select count(b) from BrewLog b
          where b.deletedAt is null
            and (:recipeId is null or b.recipeId = :recipeId)
            and (:userId is null or b.userId = :userId)
            and (:beanBatchId is null or b.beanBatchId = :beanBatchId)
            and b.brewedAt >= :startInclusive
            and b.brewedAt < :endExclusive
            and ( b.userId = :viewerId
               or b.visibility = com.kaldinote.brewlog.domain.BrewLogVisibility.PUBLIC
               or ( b.visibility = com.kaldinote.brewlog.domain.BrewLogVisibility.FRIENDS
                    and exists (select 1 from Follow f1
                                where f1.followerUserId = :viewerId
                                  and f1.followeeUserId = b.userId)
                    and exists (select 1 from Follow f2
                                where f2.followerUserId = b.userId
                                  and f2.followeeUserId = :viewerId) ) )
          """)
  Page<BrewLog> findVisible(
      @Param("viewerId") Long viewerId,
      @Param("recipeId") Long recipeId,
      @Param("userId") Long userId,
      @Param("beanBatchId") Long beanBatchId,
      @Param("startInclusive") Instant startInclusive,
      @Param("endExclusive") Instant endExclusive,
      Pageable pageable);

  /**
   * 달력 집계 — 날짜별 건수.
   *
   * <p><b>★ where 절이 {@link #findVisible} 과 문자 그대로 같아야 한다.</b> 한쪽만 고치면 「목록에는 보이는데 달력에는 점이 없다」가 된다.
   * 고칠 일이 생기면 두 쿼리를 함께 고친다.
   *
   * <p>KST 날짜로 묶는다 — {@code brewed_at}은 TIMESTAMPTZ(UTC)이고, 한국 시간 아침에 내린 기록은 UTC로 전날이다. JPQL에는 타임존
   * 변환 함수가 없어 네이티브 쿼리를 쓴다 — 테스트가 Testcontainers의 실제 PostgreSQL에서 돌므로 H2 호환을 고려할 필요가 없다.
   */
  @Query(
      value =
          """
          select cast((b.brewed_at at time zone 'Asia/Seoul') as date) as day, count(*) as cnt
          from brew_logs b
          where b.deleted_at is null
            and b.brewed_at >= :startInclusive
            and b.brewed_at < :endExclusive
            and (cast(:userId as bigint) is null or b.user_id = :userId)
            and ( b.user_id = :viewerId
               or b.visibility = 'PUBLIC'
               or ( b.visibility = 'FRIENDS'
                    and exists (select 1 from follows f1
                                where f1.follower_user_id = :viewerId
                                  and f1.followee_user_id = b.user_id)
                    and exists (select 1 from follows f2
                                where f2.follower_user_id = b.user_id
                                  and f2.followee_user_id = :viewerId) ) )
          group by day
          order by day asc
          """,
      nativeQuery = true)
  List<DayCountRow> countByKstDay(
      @Param("viewerId") Long viewerId,
      @Param("userId") Long userId,
      @Param("startInclusive") Instant startInclusive,
      @Param("endExclusive") Instant endExclusive);

  /**
   * 대표 레시피명을 고르기 위한 경량 프로젝션. {@code brewedAt} 내림차순으로 정렬만 서버가 하고, 날짜별 첫 항목(=그날 마지막 기록)은 자바가 고른다 —
   * JPQL은 윈도 함수를 지원하지 않는다.
   */
  @Query(
      """
      select b.brewedAt as brewedAt, b.recipeId as recipeId
      from BrewLog b
      where b.deletedAt is null
        and b.brewedAt >= :startInclusive
        and b.brewedAt < :endExclusive
        and (:userId is null or b.userId = :userId)
        and ( b.userId = :viewerId
           or b.visibility = com.kaldinote.brewlog.domain.BrewLogVisibility.PUBLIC
           or ( b.visibility = com.kaldinote.brewlog.domain.BrewLogVisibility.FRIENDS
                and exists (select 1 from Follow f1
                            where f1.followerUserId = :viewerId
                              and f1.followeeUserId = b.userId)
                and exists (select 1 from Follow f2
                            where f2.followerUserId = b.userId
                              and f2.followeeUserId = :viewerId) ) )
      order by b.brewedAt desc, b.id desc
      """)
  List<PrimaryRecipeRow> findVisibleForPrimaryRecipe(
      @Param("viewerId") Long viewerId,
      @Param("userId") Long userId,
      @Param("startInclusive") Instant startInclusive,
      @Param("endExclusive") Instant endExclusive);

  interface DayCountRow {
    LocalDate getDay();

    long getCnt();
  }

  interface PrimaryRecipeRow {
    Instant getBrewedAt();

    Long getRecipeId();
  }
}
