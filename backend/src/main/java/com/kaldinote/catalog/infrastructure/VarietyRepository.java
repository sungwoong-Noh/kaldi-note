package com.kaldinote.catalog.infrastructure;

import com.kaldinote.catalog.domain.Variety;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface VarietyRepository extends JpaRepository<Variety, Long> {

  Optional<Variety> findByName(String name);

  List<Variety> findAllByOrderByNameAsc();
}
