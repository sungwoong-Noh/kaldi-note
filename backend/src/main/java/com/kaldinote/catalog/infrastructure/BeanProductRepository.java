package com.kaldinote.catalog.infrastructure;

import com.kaldinote.catalog.domain.BeanProduct;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BeanProductRepository extends JpaRepository<BeanProduct, Long> {
  Optional<BeanProduct> findByRoasterIdAndName(Long roasterId, String name);

  List<BeanProduct> findAllByOrderByNameAsc();
}
