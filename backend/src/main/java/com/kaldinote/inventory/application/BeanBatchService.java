package com.kaldinote.inventory.application;

import com.kaldinote.catalog.infrastructure.BeanProductRepository;
import com.kaldinote.common.error.BusinessException;
import com.kaldinote.common.error.ErrorCode;
import com.kaldinote.inventory.domain.BeanBatch;
import com.kaldinote.inventory.infrastructure.BeanBatchRepository;
import com.kaldinote.inventory.presentation.dto.BeanBatchCreateRequest;
import com.kaldinote.inventory.presentation.dto.BeanBatchResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class BeanBatchService {

  private final BeanBatchRepository beanBatchRepository;
  private final BeanProductRepository beanProductRepository;

  @Transactional
  public BeanBatchResponse create(Long userId, BeanBatchCreateRequest request) {
    if (!beanProductRepository.existsById(request.beanProductId())) {
      throw new BusinessException(
          ErrorCode.NOT_FOUND, "원두 상품을 찾을 수 없습니다: " + request.beanProductId());
    }
    BeanBatch batch =
        BeanBatch.create(
            userId,
            request.beanProductId(),
            request.roastedAt(),
            request.purchasedAt(),
            request.weightG(),
            request.price(),
            request.memo());
    return BeanBatchResponse.from(beanBatchRepository.save(batch));
  }
}
