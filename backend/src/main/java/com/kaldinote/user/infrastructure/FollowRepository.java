package com.kaldinote.user.infrastructure;

import com.kaldinote.user.domain.Follow;
import com.kaldinote.user.domain.FollowId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface FollowRepository extends JpaRepository<Follow, FollowId> {

  /** 양방향 팔로우가 모두 존재할 때만 true. FRIENDS 공개범위 판정에 쓴다. */
  @Query(
      """
      select count(f) = 2 from Follow f
      where (f.followerUserId = :a and f.followeeUserId = :b)
         or (f.followerUserId = :b and f.followeeUserId = :a)
      """)
  boolean existsMutualFollow(@Param("a") Long a, @Param("b") Long b);
}
