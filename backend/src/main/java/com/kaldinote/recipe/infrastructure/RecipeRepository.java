package com.kaldinote.recipe.infrastructure;

import com.kaldinote.recipe.domain.Recipe;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RecipeRepository extends JpaRepository<Recipe, Long> {

  Optional<Recipe> findByIdAndDeletedAtIsNull(Long id);

  long countByParentRecipeIdAndDeletedAtIsNull(Long parentRecipeId);

  /** 목록 한 페이지 안 레시피들의 savedCount(담아간 수)를 한 번에 조회한다 — 건마다 따로 세면 N+1이 된다. */
  @Query(
      value =
          "select r.parent_recipe_id as parentRecipeId, count(*) as cnt "
              + "from recipes r where r.parent_recipe_id in (:recipeIds) and r.deleted_at is null "
              + "group by r.parent_recipe_id",
      nativeQuery = true)
  List<SavedCountRow> countSavedForIds(@Param("recipeIds") List<Long> recipeIds);

  interface SavedCountRow {
    Long getParentRecipeId();

    long getCnt();
  }

  /**
   * 목록용 공개범위 판정.
   *
   * <p>단건 조회는 엔티티를 로드한 뒤 FollowService.isMutual로 자바에서 판정하지만, 목록은 전체를 메모리에 올릴 수 없다(그러면
   * totalElements와 페이지네이션이 성립하지 않는다). 상호 팔로우 판정을 exists 서브쿼리 두 개로 SQL에 내린다.
   *
   * <p>owner_user_id가 null인 CURATED 시드는 첫 조건과 FRIENDS 조건을 통과할 수 없고 PUBLIC으로만 들어온다.
   */
  @Query(
      value =
          """
          select r from Recipe r
          where r.deletedAt is null
            and (:ownerUserId is null or r.ownerUserId = :ownerUserId)
            and ( r.ownerUserId = :viewerId
               or r.visibility = com.kaldinote.recipe.domain.RecipeVisibility.PUBLIC
               or ( r.visibility = com.kaldinote.recipe.domain.RecipeVisibility.FRIENDS
                    and exists (select 1 from Follow f1
                                where f1.followerUserId = :viewerId
                                  and f1.followeeUserId = r.ownerUserId)
                    and exists (select 1 from Follow f2
                                where f2.followerUserId = r.ownerUserId
                                  and f2.followeeUserId = :viewerId) ) )
          """,
      countQuery =
          """
          select count(r) from Recipe r
          where r.deletedAt is null
            and (:ownerUserId is null or r.ownerUserId = :ownerUserId)
            and ( r.ownerUserId = :viewerId
               or r.visibility = com.kaldinote.recipe.domain.RecipeVisibility.PUBLIC
               or ( r.visibility = com.kaldinote.recipe.domain.RecipeVisibility.FRIENDS
                    and exists (select 1 from Follow f1
                                where f1.followerUserId = :viewerId
                                  and f1.followeeUserId = r.ownerUserId)
                    and exists (select 1 from Follow f2
                                where f2.followerUserId = r.ownerUserId
                                  and f2.followeeUserId = :viewerId) ) )
          """)
  Page<Recipe> findVisible(
      @Param("viewerId") Long viewerId, @Param("ownerUserId") Long ownerUserId, Pageable pageable);

  /**
   * 둘러보기(scope=PUBLIC) 검색. FRIENDS·PRIVATE는 절대 섞이지 않는다 — "공개 레시피 전체"이지 "볼 수 있는 것 전체"가
   * 아니다(AC-RECIPESBREWS-19a).
   *
   * <p>계산된 컬럼(담아간 수) 기준 정렬이 섞여 있어 JPA Specification으로는 ORDER BY에 상관 서브쿼리를 못 넣는다.
   * BrewLogRepository.countByKstDay와 같은 네이티브 + null-safe {@code (:param IS NULL OR ...)} 패턴을 쓴다.
   *
   * <p>정렬: sort=RECENT는 createdAt desc 단일 기준(AC-RECIPESBREWS-12, CURATED 우선순위 없음). 그 외(기본값
   * POPULAR)는 CURATED desc, savedCount desc, createdAt desc, id desc (AC-RECIPESBREWS-11).
   */
  @Query(
      value =
          """
          select r.* from recipes r
          left join brewers br on br.id = r.brewer_id
          where r.deleted_at is null
            and r.visibility = 'PUBLIC'
            and (cast(:q as text) is null
                 or r.title ilike concat('%', cast(:q as text), '%')
                 or br.name ilike concat('%', cast(:q as text), '%'))
            and (cast(:temp as text) is null or r.temperature_type = cast(:temp as text))
            and (cast(:roast as text[]) is null
                 or r.recommended_roast_level = any(cast(:roast as text[])))
            and (cast(:doseMin as numeric) is null or r.dose_g >= cast(:doseMin as numeric))
            and (cast(:doseMax as numeric) is null or r.dose_g <= cast(:doseMax as numeric))
            and (cast(:brewerIds as bigint[]) is null
                 or r.brewer_id = any(cast(:brewerIds as bigint[])))
          order by
            case when coalesce(cast(:sort as text), 'POPULAR') = 'POPULAR'
                      and r.source_type = 'CURATED' then 0 else 1 end,
            case when coalesce(cast(:sort as text), 'POPULAR') = 'POPULAR'
                 then (select count(*) from recipes c
                       where c.parent_recipe_id = r.id and c.deleted_at is null)
                 else 0 end desc,
            r.created_at desc,
            r.id desc
          """,
      countQuery =
          """
          select count(*) from recipes r
          left join brewers br on br.id = r.brewer_id
          where r.deleted_at is null
            and r.visibility = 'PUBLIC'
            and (cast(:q as text) is null
                 or r.title ilike concat('%', cast(:q as text), '%')
                 or br.name ilike concat('%', cast(:q as text), '%'))
            and (cast(:temp as text) is null or r.temperature_type = cast(:temp as text))
            and (cast(:roast as text[]) is null
                 or r.recommended_roast_level = any(cast(:roast as text[])))
            and (cast(:doseMin as numeric) is null or r.dose_g >= cast(:doseMin as numeric))
            and (cast(:doseMax as numeric) is null or r.dose_g <= cast(:doseMax as numeric))
            and (cast(:brewerIds as bigint[]) is null
                 or r.brewer_id = any(cast(:brewerIds as bigint[])))
          """,
      nativeQuery = true)
  Page<Recipe> searchPublic(
      @Param("q") String q,
      @Param("temp") String temp,
      @Param("roast") String[] roast,
      @Param("doseMin") BigDecimal doseMin,
      @Param("doseMax") BigDecimal doseMax,
      @Param("brewerIds") Long[] brewerIds,
      @Param("sort") String sort,
      Pageable pageable);
}
