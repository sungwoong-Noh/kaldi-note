package com.kaldinote.catalog.application;

import com.kaldinote.catalog.domain.Roaster;
import com.kaldinote.catalog.infrastructure.RoasterRepository;
import com.kaldinote.catalog.presentation.dto.RoasterResponse;
import com.kaldinote.common.error.BusinessException;
import com.kaldinote.common.error.ErrorCode;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class BeanCatalogService {

  private final RoasterRepository roasterRepository;

  public List<RoasterResponse> findAllRoasters() {
    return roasterRepository.findAllByOrderByNameAsc().stream().map(RoasterResponse::from).toList();
  }

  @Transactional
  public RoasterResponse createRoaster(String name, String country, String website, Long userId) {
    if (roasterRepository.findByName(name).isPresent()) {
      throw new BusinessException(ErrorCode.DUPLICATE_NAME);
    }
    Roaster saved = roasterRepository.save(Roaster.createByUser(name, country, website, userId));
    return RoasterResponse.from(saved);
  }
}
