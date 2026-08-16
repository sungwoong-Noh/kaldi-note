package com.kaldinote.catalog.infrastructure;

import com.kaldinote.catalog.domain.Roaster;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RoasterRepository extends JpaRepository<Roaster, Long> {
  Optional<Roaster> findByName(String name);

  List<Roaster> findAllByOrderByNameAsc();
}
