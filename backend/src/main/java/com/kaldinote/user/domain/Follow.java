package com.kaldinote.user.domain;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 단방향 팔로우. FRIENDS 공개범위는 상호 팔로우일 때만 성립한다. */
@Entity
@Table(name = "follows")
@IdClass(FollowId.class)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Follow {

  @Id
  @Column(name = "follower_user_id")
  private Long followerUserId;

  @Id
  @Column(name = "followee_user_id")
  private Long followeeUserId;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  private Follow(Long followerUserId, Long followeeUserId) {
    if (followerUserId.equals(followeeUserId)) {
      throw new IllegalArgumentException("자기 자신을 팔로우할 수 없습니다");
    }
    this.followerUserId = followerUserId;
    this.followeeUserId = followeeUserId;
    this.createdAt = Instant.now();
  }

  public static Follow of(Long followerUserId, Long followeeUserId) {
    return new Follow(followerUserId, followeeUserId);
  }
}
