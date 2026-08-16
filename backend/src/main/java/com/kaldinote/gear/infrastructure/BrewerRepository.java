package com.kaldinote.gear.infrastructure;

import com.kaldinote.gear.domain.Brewer;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BrewerRepository extends JpaRepository<Brewer, Long> {

  List<Brewer> findAllByOrderByBrandAscNameAsc();
}
