package com.kaldinote.catalog.infrastructure;

import com.kaldinote.catalog.domain.CoffeeProcess;
import com.kaldinote.catalog.domain.ProcessCategory;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CoffeeProcessRepository extends JpaRepository<CoffeeProcess, Long> {

  List<CoffeeProcess> findByCategory(ProcessCategory category);

  List<CoffeeProcess> findAllByOrderByCategoryAscNameAsc();
}
