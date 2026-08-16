package com.kaldinote.catalog.infrastructure;

import com.kaldinote.catalog.domain.FlavorNote;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FlavorNoteRepository extends JpaRepository<FlavorNote, Long> {

  List<FlavorNote> findAllByParentIsNull();

  List<FlavorNote> findAllByParent(FlavorNote parent);

  Optional<FlavorNote> findByNameEnAndParentIsNull(String nameEn);
}
