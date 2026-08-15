package com.kaldinote.user.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import com.kaldinote.AbstractIntegrationTest;
import com.kaldinote.user.domain.Follow;
import com.kaldinote.user.domain.User;
import com.kaldinote.user.domain.UserRole;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class UserRepositoryTest extends AbstractIntegrationTest {

  @Autowired private UserRepository userRepository;
  @Autowired private FollowRepository followRepository;

  @Test
  void 사용자를_저장하면_기본_역할은_USER다() {
    User saved = userRepository.save(User.create("a@example.com", "노스원", null));

    assertThat(saved.getId()).isNotNull();
    assertThat(saved.getRole()).isEqualTo(UserRole.USER);
    assertThat(saved.getCreatedAt()).isNotNull();
  }

  @Test
  void 이메일이_없어도_저장된다() {
    // 카카오는 이메일 제공 동의가 선택이라 null이 올 수 있다
    User saved = userRepository.save(User.create(null, "카카오유저", null));

    assertThat(saved.getId()).isNotNull();
    assertThat(saved.getEmail()).isNull();
  }

  @Test
  void 이메일이_없는_사용자는_여러_명_저장할_수_있다() {
    userRepository.save(User.create(null, "유저1", null));
    userRepository.save(User.create(null, "유저2", null));
    userRepository.flush();

    assertThat(userRepository.count()).isEqualTo(2);
  }

  @Test
  void 관리자로_승격할_수_있다() {
    User user = userRepository.save(User.create("admin@example.com", "관리자", null));

    user.promoteToAdmin();
    userRepository.flush();

    assertThat(userRepository.findById(user.getId()).orElseThrow().getRole())
        .isEqualTo(UserRole.ADMIN);
  }

  @Test
  void 서로_팔로우해야_상호_팔로우로_판정된다() {
    User a = userRepository.save(User.create("a2@example.com", "A", null));
    User b = userRepository.save(User.create("b2@example.com", "B", null));

    followRepository.save(Follow.of(a.getId(), b.getId()));
    followRepository.flush();
    assertThat(followRepository.existsMutualFollow(a.getId(), b.getId())).isFalse();

    followRepository.save(Follow.of(b.getId(), a.getId()));
    followRepository.flush();
    assertThat(followRepository.existsMutualFollow(a.getId(), b.getId())).isTrue();
  }
}
