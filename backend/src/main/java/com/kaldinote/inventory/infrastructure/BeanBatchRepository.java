package com.kaldinote.inventory.infrastructure;

import com.kaldinote.inventory.domain.BeanBatch;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BeanBatchRepository extends JpaRepository<BeanBatch, Long> {
  Optional<BeanBatch> findByIdAndDeletedAtIsNull(Long id);

  List<BeanBatch> findAllByUserIdAndDeletedAtIsNull(Long userId);
}
