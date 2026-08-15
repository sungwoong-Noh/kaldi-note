package com.kaldinote.user.domain;

import com.kaldinote.common.entity.BaseTimeEntity;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "users")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class User extends BaseTimeEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  /** 카카오는 이메일 제공 동의가 선택이라 null일 수 있다. 식별자로 쓰지 않는다. */
  @Column(length = 255)
  private String email;

  @Column(nullable = false, length = 50)
  private String nickname;

  @Column(name = "profile_image_url", columnDefinition = "text")
  private String profileImageUrl;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20)
  private UserRole role;

  private User(String email, String nickname, String profileImageUrl) {
    this.email = email;
    this.nickname = nickname;
    this.profileImageUrl = profileImageUrl;
    this.role = UserRole.USER;
  }

  public static User create(String email, String nickname, String profileImageUrl) {
    return new User(email, nickname, profileImageUrl);
  }

  public void promoteToAdmin() {
    this.role = UserRole.ADMIN;
  }

  public void updateProfile(String nickname, String profileImageUrl) {
    this.nickname = nickname;
    this.profileImageUrl = profileImageUrl;
  }
}
