package com.kaldinote.media.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.kaldinote.AbstractIntegrationTest;
import com.kaldinote.media.domain.Attachment;
import com.kaldinote.media.domain.TargetType;
import com.kaldinote.user.domain.User;
import com.kaldinote.user.infrastructure.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class AttachmentRepositoryTest extends AbstractIntegrationTest {

  @Autowired private AttachmentRepository attachmentRepository;
  @Autowired private UserRepository userRepository;

  private Long ownerId() {
    return userRepository.save(User.create(null, "첨부테스터", null)).getId();
  }

  @Test
  void 저장하고_조회한다() {
    Long owner = ownerId();
    Attachment saved =
        attachmentRepository.save(
            Attachment.create(
                owner, TargetType.RECIPE, 1L, "k-" + owner, "image/jpeg", 100, 100, 1));

    Attachment found = attachmentRepository.findById(saved.getId()).orElseThrow();
    assertThat(found.getTargetType()).isEqualTo(TargetType.RECIPE);
    assertThat(found.getSortOrder()).isEqualTo(1);
  }

  @Test
  void objectKey는_유니크_제약이_있다() {
    Long owner = ownerId();
    String key = "dup-" + owner;
    attachmentRepository.save(
        Attachment.create(owner, TargetType.RECIPE, 1L, key, "image/jpeg", 100, 100, 1));
    attachmentRepository.flush();

    assertThatThrownBy(
            () -> {
              attachmentRepository.save(
                  Attachment.create(owner, TargetType.RECIPE, 2L, key, "image/jpeg", 100, 100, 1));
              attachmentRepository.flush();
            })
        .isInstanceOf(DataIntegrityViolationException.class);
  }

  @Test
  void countByTargetTypeAndTargetId는_대상별로_센다() {
    Long owner = ownerId();
    attachmentRepository.save(
        Attachment.create(owner, TargetType.RECIPE, 10L, "a-" + owner, "image/jpeg", 100, 100, 1));
    attachmentRepository.save(
        Attachment.create(owner, TargetType.RECIPE, 10L, "b-" + owner, "image/jpeg", 100, 100, 2));
    attachmentRepository.save(
        Attachment.create(owner, TargetType.RECIPE, 11L, "c-" + owner, "image/jpeg", 100, 100, 1));

    assertThat(attachmentRepository.countByTargetTypeAndTargetId(TargetType.RECIPE, 10L))
        .isEqualTo(2);
    assertThat(attachmentRepository.countByTargetTypeAndTargetId(TargetType.RECIPE, 11L))
        .isEqualTo(1);
  }

  @Test
  void findByTargetTypeAndTargetIdOrderBySortOrderAsc는_정렬순으로_돌려준다() {
    Long owner = ownerId();
    attachmentRepository.save(
        Attachment.create(owner, TargetType.RECIPE, 20L, "x-" + owner, "image/jpeg", 100, 100, 2));
    attachmentRepository.save(
        Attachment.create(owner, TargetType.RECIPE, 20L, "y-" + owner, "image/jpeg", 100, 100, 1));

    var found =
        attachmentRepository.findByTargetTypeAndTargetIdOrderBySortOrderAsc(TargetType.RECIPE, 20L);

    assertThat(found).hasSize(2);
    assertThat(found.get(0).getSortOrder()).isEqualTo(1);
    assertThat(found.get(1).getSortOrder()).isEqualTo(2);
  }

  @Test
  void existsByObjectKey는_존재_여부를_확인한다() {
    Long owner = ownerId();
    String key = "exists-" + owner;
    attachmentRepository.save(
        Attachment.create(owner, TargetType.RECIPE, 30L, key, "image/jpeg", 100, 100, 1));

    assertThat(attachmentRepository.existsByObjectKey(key)).isTrue();
    assertThat(attachmentRepository.existsByObjectKey("no-such-key")).isFalse();
  }
}
