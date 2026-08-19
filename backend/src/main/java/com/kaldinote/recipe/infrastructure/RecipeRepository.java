package com.kaldinote.recipe.infrastructure;

import com.kaldinote.recipe.domain.Recipe;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RecipeRepository extends JpaRepository<Recipe, Long> {

  Optional<Recipe> findByIdAndDeletedAtIsNull(Long id);

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
}
