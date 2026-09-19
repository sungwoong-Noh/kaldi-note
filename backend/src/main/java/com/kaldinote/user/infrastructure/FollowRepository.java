package com.kaldinote.user.infrastructure;

import com.kaldinote.user.domain.Follow;
import com.kaldinote.user.domain.FollowId;
import com.kaldinote.user.domain.User;
import java.util.List;
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

  boolean existsByFollowerUserIdAndFolloweeUserId(Long followerUserId, Long followeeUserId);

  void deleteByFollowerUserIdAndFolloweeUserId(Long followerUserId, Long followeeUserId);

  /**
   * 맞팔로우인 사용자를, 호출자가 볼 수 있는 그 사람 기록의 마지막 시각이 최근인 순으로.
   *
   * <p><b>left join인 이유:</b> 기록이 한 건도 없는 맞팔로우도 레일에 나타나야 한다(AC-HOMECAL-20). inner join이면 그 사람이 통째로
   * 빠진다.
   *
   * <p>정렬 3단: ①마지막 기록 내림차순 → ②무기록자는 뒤(nulls last) → ③닉네임 오름차순. ③이 없으면 PostgreSQL이 순서를 보장하지 않아 레일
   * 순서가 요청마다 달라진다(AC-HOMECAL-21).
   *
   * <p>{@code b.visibility}에 PRIVATE을 넣지 않는다 — 맞팔로우 사이에서 볼 수 있는 것은 PUBLIC과 FRIENDS뿐이다. 정렬 기준이 「볼 수
   * 있는 기록」이므로 상대의 PRIVATE 기록이 순서를 바꾸면 안 된다.
   */
  @Query(
      """
      select u
      from User u
        join Follow f1 on f1.followerUserId = :viewerId and f1.followeeUserId = u.id
        join Follow f2 on f2.followerUserId = u.id and f2.followeeUserId = :viewerId
        left join BrewLog b
          on b.userId = u.id
         and b.deletedAt is null
         and ( b.visibility = com.kaldinote.brewlog.domain.BrewLogVisibility.PUBLIC
            or b.visibility = com.kaldinote.brewlog.domain.BrewLogVisibility.FRIENDS )
      where u.id <> :viewerId
      group by u
      order by max(b.brewedAt) desc nulls last, u.nickname asc
      """)
  List<User> findMutualFollowsOrderedByLastBrew(@Param("viewerId") Long viewerId);
}
