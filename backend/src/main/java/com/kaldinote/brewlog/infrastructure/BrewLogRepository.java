package com.kaldinote.brewlog.infrastructure;

import com.kaldinote.brewlog.domain.BrewLog;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BrewLogRepository extends JpaRepository<BrewLog, Long> {

  Optional<BrewLog> findByIdAndDeletedAtIsNull(Long id);

  /**
   * 목록용 공개범위 판정. RecipeRepository.findVisible과 같은 구조다. 소유자 컬럼 이름과 enum 타입만 다르다.
   *
   * <p>필터 셋은 AND로 결합한다. 존재하지 않거나 볼 수 없는 대상을 가리켜도 404·403이 아니라 빈 결과가 나온다 — id를 바꿔가며 타인의 비공개 데이터 존재
   * 여부를 알아내는 것을 막는다.
   */
  @Query(
      value =
          """
          select b from BrewLog b
          where b.deletedAt is null
            and (:recipeId is null or b.recipeId = :recipeId)
            and (:userId is null or b.userId = :userId)
            and (:beanBatchId is null or b.beanBatchId = :beanBatchId)
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
      Pageable pageable);
}
