package com.kaldinote.catalog.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import com.kaldinote.AbstractIntegrationTest;
import com.kaldinote.catalog.domain.ProcessCategory;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class CatalogSeedTest extends AbstractIntegrationTest {

  @Autowired private VarietyRepository varietyRepository;
  @Autowired private CoffeeProcessRepository processRepository;
  @Autowired private FlavorNoteRepository flavorNoteRepository;

  @Test
  void 시스템_품종이_시드된다() {
    assertThat(varietyRepository.count()).isGreaterThanOrEqualTo(15);
    assertThat(varietyRepository.findByName("Geisha")).isPresent();
  }

  @Test
  void 가공법은_카테고리로_묶인다() {
    assertThat(processRepository.findByCategory(ProcessCategory.HONEY)).hasSize(4);
    assertThat(processRepository.findByCategory(ProcessCategory.FERMENTED)).hasSize(5);
  }

  @Test
  void 플레이버노트는_9개_대분류를_가진다() {
    assertThat(flavorNoteRepository.findAllByParentIsNull()).hasSize(9);
  }

  @Test
  void 플레이버노트_하위_항목은_부모를_가리킨다() {
    var fruity = flavorNoteRepository.findByNameEnAndParentIsNull("Fruity").orElseThrow();

    assertThat(flavorNoteRepository.findAllByParent(fruity)).hasSize(4);
  }

  @Test
  void 시드_데이터는_전부_시스템_소유다() {
    assertThat(varietyRepository.findAll())
        .allMatch(v -> v.isSystem() && v.getCreatedByUserId() == null);
  }
}
