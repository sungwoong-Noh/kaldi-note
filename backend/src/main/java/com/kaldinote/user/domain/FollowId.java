package com.kaldinote.user.domain;

import java.io.Serializable;
import java.util.Objects;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class FollowId implements Serializable {

  private Long followerUserId;
  private Long followeeUserId;

  public FollowId(Long followerUserId, Long followeeUserId) {
    this.followerUserId = followerUserId;
    this.followeeUserId = followeeUserId;
  }

  @Override
  public boolean equals(Object o) {
    if (this == o) return true;
    if (!(o instanceof FollowId other)) return false;
    return Objects.equals(followerUserId, other.followerUserId)
        && Objects.equals(followeeUserId, other.followeeUserId);
  }

  @Override
  public int hashCode() {
    return Objects.hash(followerUserId, followeeUserId);
  }
}
