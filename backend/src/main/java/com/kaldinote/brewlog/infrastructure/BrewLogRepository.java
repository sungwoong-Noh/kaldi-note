package com.kaldinote.brewlog.infrastructure;

import com.kaldinote.brewlog.domain.BrewLog;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BrewLogRepository extends JpaRepository<BrewLog, Long> {

  Optional<BrewLog> findByIdAndDeletedAtIsNull(Long id);
}
