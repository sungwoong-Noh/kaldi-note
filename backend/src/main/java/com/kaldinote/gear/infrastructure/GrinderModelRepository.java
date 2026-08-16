package com.kaldinote.gear.infrastructure;

import com.kaldinote.gear.domain.GrinderModel;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GrinderModelRepository extends JpaRepository<GrinderModel, Long> {

  Optional<GrinderModel> findByBrandAndName(String brand, String name);

  List<GrinderModel> findAllByOrderByBrandAscNameAsc();
}
