package com.kaldinote.gear.infrastructure;

import com.kaldinote.gear.domain.UserGrinder;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserGrinderRepository extends JpaRepository<UserGrinder, Long> {

  List<UserGrinder> findAllByUserId(Long userId);

  Optional<UserGrinder> findByUserIdAndIsDefaultTrue(Long userId);
}
