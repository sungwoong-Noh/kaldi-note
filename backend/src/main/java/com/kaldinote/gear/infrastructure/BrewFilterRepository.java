package com.kaldinote.gear.infrastructure;

import com.kaldinote.gear.domain.BrewFilter;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BrewFilterRepository extends JpaRepository<BrewFilter, Long> {

  List<BrewFilter> findAllByOrderByNameAsc();
}
