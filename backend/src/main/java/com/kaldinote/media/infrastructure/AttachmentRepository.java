package com.kaldinote.media.infrastructure;

import com.kaldinote.media.domain.Attachment;
import com.kaldinote.media.domain.TargetType;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AttachmentRepository extends JpaRepository<Attachment, Long> {

  long countByTargetTypeAndTargetId(TargetType targetType, Long targetId);

  boolean existsByObjectKey(String objectKey);

  List<Attachment> findByTargetTypeAndTargetIdOrderBySortOrderAsc(
      TargetType targetType, Long targetId);
}
