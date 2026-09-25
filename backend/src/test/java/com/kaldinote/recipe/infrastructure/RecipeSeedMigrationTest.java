package com.kaldinote.recipe.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import com.kaldinote.AbstractIntegrationTest;
import com.kaldinote.gear.infrastructure.BrewerRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class RecipeSeedMigrationTest extends AbstractIntegrationTest {

  @Autowired private BrewerRepository brewerRepository;

  @Test
  @DisplayName("AC-RECIPESBREWS-10 · V16 시드로 brand=Clever 브루어가 존재한다")
  void Clever_브루어가_시드돼_있다() {
    assertThat(brewerRepository.findByBrandAndName("Clever", "Clever Dripper")).isPresent();
  }
}
