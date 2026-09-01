package com.kaldinote.gear.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import com.kaldinote.AbstractIntegrationTest;
import com.kaldinote.gear.domain.GrinderModel;
import com.kaldinote.grind.domain.GrindConversion;
import com.kaldinote.grind.domain.GrindConverter;
import java.math.BigDecimal;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class GearSeedTest extends AbstractIntegrationTest {

  @Autowired private GrinderModelRepository grinderRepository;
  @Autowired private BrewerRepository brewerRepository;
  @Autowired private BrewFilterRepository filterRepository;

  private final GrindConverter converter = new GrindConverter();

  @Test
  void 시스템_그라인더가_시드된다() {
    assertThat(grinderRepository.count()).isGreaterThanOrEqualTo(10);
  }

  @Test
  void C40의_클릭당_마이크론은_30이다() {
    GrinderModel c40 = grinderRepository.findByBrandAndName("Comandante", "C40 MK4").orElseThrow();

    assertThat(c40.getMicronsPerClick()).isEqualByComparingTo("30.00");
    assertThat(c40.toGrindSpec().convertible()).isTrue();
  }

  @Test
  void 시드된_그라인더로_실제_환산이_동작한다() {
    GrinderModel c40 = grinderRepository.findByBrandAndName("Comandante", "C40 MK4").orElseThrow();
    GrinderModel kPlus = grinderRepository.findByBrandAndName("1Zpresso", "K-Plus").orElseThrow();

    GrindConversion result =
        converter.convert(c40.toGrindSpec(), new BigDecimal("22"), kPlus.toGrindSpec());

    assertThat(result.micron()).isEqualByComparingTo("660");
    assertThat(result.targetSetting()).isEqualByComparingTo("30.0");
    assertThat(result.estimated()).isTrue();
    assertThat(result.targetOutOfRange()).isFalse();
  }

  @Test
  void 시드된_그라인더의_범위가_GrindSpec으로_전달된다() {
    GrinderModel c40 = grinderRepository.findByBrandAndName("Comandante", "C40 MK4").orElseThrow();

    // 범위 검증이 순수 도메인에서 동작하려면 min·max가 함께 넘어와야 한다
    assertThat(c40.toGrindSpec().rangeChecked()).isTrue();
    assertThat(c40.toGrindSpec().maxSetting()).isEqualByComparingTo("50");
  }

  @Test
  void 클릭당_마이크론이_없는_그라인더는_환산_불가로_표시된다() {
    GrinderModel stepless = grinderRepository.findByBrandAndName("Wilfa", "Uniform").orElseThrow();

    assertThat(stepless.getMicronsPerClick()).isNull();
    assertThat(stepless.toGrindSpec().convertible()).isFalse();
  }

  @Test
  @DisplayName("AC-WEBSHELL-27 · E80 30스텝은 675마이크론이다")
  void 시드된_E80의_30스텝은_675마이크론이다() {
    GrinderModel e80 = grinderRepository.findByBrandAndName("Holzklotz", "E80").orElseThrow();

    assertThat(converter.toMicron(e80.toGrindSpec(), new BigDecimal("30")))
        .isEqualByComparingTo("675");
  }

  @Test
  @DisplayName("AC-WEBSHELL-31 · 반올림이 필요한 스텝도 제조사 표와 맞는다")
  void 시드된_E80의_25스텝은_563마이크론이다() {
    GrinderModel e80 = grinderRepository.findByBrandAndName("Holzklotz", "E80").orElseThrow();

    // 25 × 22.50 = 562.5 → 스케일 0 HALF_UP → 563
    assertThat(converter.toMicron(e80.toGrindSpec(), new BigDecimal("25")))
        .isEqualByComparingTo("563");
  }

  @Test
  void 드리퍼와_필터가_시드된다() {
    assertThat(brewerRepository.count()).isGreaterThanOrEqualTo(10);
    assertThat(filterRepository.count()).isGreaterThanOrEqualTo(8);
  }
}
