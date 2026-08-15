package com.kaldinote.grind.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

class GrindConverterTest {

  private final GrindConverter converter = new GrindConverter();

  /** Comandante C40: 30µm/click, 영점 0, 0~50 */
  private static final GrindSpec C40 = new GrindSpec(bd("30"), BigDecimal.ZERO, bd("0"), bd("50"));

  /** 1Zpresso K-Plus: 22µm/click, 영점 0, 0~90 */
  private static final GrindSpec K_PLUS =
      new GrindSpec(bd("22"), BigDecimal.ZERO, bd("0"), bd("90"));

  /** 무단계 그라인더 — 클릭당 마이크론을 알 수 없어 환산 불가 */
  private static final GrindSpec STEPLESS = new GrindSpec(null, BigDecimal.ZERO, bd("0"), bd("0"));

  private static BigDecimal bd(String v) {
    return new BigDecimal(v);
  }

  @Nested
  @DisplayName("마이크론 환산")
  class ToMicron {

    @Test
    @DisplayName("AC-GRIND-01 · 설정값을 마이크론으로 환산한다")
    void C40_22클릭은_660마이크론이다() {
      assertThat(converter.toMicron(C40, bd("22"))).isEqualByComparingTo("660");
    }

    @Test
    @DisplayName("AC-GRIND-02 · 영점 보정만큼 빼고 계산한다")
    void 영점_보정이_있으면_보정만큼_빼고_계산한다() {
      GrindSpec offsetGrinder = new GrindSpec(bd("30"), bd("3"), null, null);

      assertThat(converter.toMicron(offsetGrinder, bd("10"))).isEqualByComparingTo("210");
    }

    @Test
    @DisplayName("AC-GRIND-03 · 마이크론은 소수점 없이 반올림한다")
    void 마이크론은_소수점없이_반올림한다() {
      GrindSpec odd = new GrindSpec(bd("22.5"), BigDecimal.ZERO, null, null);

      // 7 × 22.5 = 157.5 → HALF_UP → 158
      assertThat(converter.toMicron(odd, bd("7"))).isEqualByComparingTo("158");
    }
  }

  @Nested
  @DisplayName("그라인더 간 환산")
  class Convert {

    @Test
    @DisplayName("AC-GRIND-04 · 그라인더 간 설정값을 환산한다")
    void C40_22클릭은_K_Plus_30클릭에_해당한다() {
      GrindConversion result = converter.convert(C40, bd("22"), K_PLUS);

      assertThat(result.sourceSetting()).isEqualByComparingTo("22");
      assertThat(result.micron()).isEqualByComparingTo("660");
      assertThat(result.targetSetting()).isEqualByComparingTo("30.0");
    }

    @Test
    @DisplayName("AC-GRIND-05 · 대상 설정값은 소수 첫째 자리까지 반올림한다")
    void 대상_설정값은_소수_첫째자리까지_반올림한다() {
      // C40 30클릭 = 900µm → 900 / 22 = 40.909... → 40.9
      assertThat(converter.convert(C40, bd("30"), K_PLUS).targetSetting())
          .isEqualByComparingTo("40.9");
    }

    @Test
    @DisplayName("AC-GRIND-06 · 같은 그라인더끼리는 설정값이 보존된다")
    void 같은_그라인더끼리는_설정값이_그대로_나온다() {
      assertThat(converter.convert(C40, bd("22"), C40).targetSetting())
          .isEqualByComparingTo("22.0");
    }

    @Test
    @DisplayName("AC-GRIND-07 · 환산 결과는 언제나 추정치로 표시된다")
    void 환산_결과는_언제나_추정치로_표시된다() {
      GrindConversion result = converter.convert(C40, bd("22"), K_PLUS);

      assertThat(result.estimated()).isTrue();
      assertThat(result.warning()).isEqualTo(GrindConverter.ESTIMATE_WARNING);
    }

    @Test
    @DisplayName("AC-GRIND-21 · 결과가 대상 범위 안이면 플래그가 내려간다")
    void 결과가_대상_범위_안이면_플래그가_false다() {
      assertThat(converter.convert(C40, bd("22"), K_PLUS).targetOutOfRange()).isFalse();
    }

    @Test
    @DisplayName("AC-GRIND-20 · 결과가 대상 범위를 넘으면 플래그를 세우고 값은 돌려준다")
    void 결과가_대상_범위를_넘으면_플래그가_true다() {
      // K-Plus 90클릭 = 1980µm → C40 66.0클릭. C40의 최대는 50이다.
      GrindConversion result = converter.convert(K_PLUS, bd("90"), C40);

      assertThat(result.targetSetting()).isEqualByComparingTo("66.0");
      assertThat(result.targetOutOfRange()).isTrue();
    }
  }

  @Nested
  @DisplayName("범위 검증")
  class RangeValidation {

    @Test
    @DisplayName("AC-GRIND-14 · 영점이 min_setting보다 크면 영점이 하한이 된다")
    void 영점보다_낮은_설정값은_거부한다() {
      // min_setting은 0이지만 영점이 3이므로 하한은 3이다
      GrindSpec offsetGrinder = new GrindSpec(bd("30"), bd("3"), bd("0"), bd("50"));

      assertThatThrownBy(() -> converter.toMicron(offsetGrinder, bd("2")))
          .isInstanceOf(GrindSettingOutOfRangeException.class);
    }

    @Test
    @DisplayName("AC-GRIND-15 · min·max가 null이면 범위를 검증하지 않는다")
    void min과_max가_null이면_범위를_검증하지_않는다() {
      GrindSpec noRange = new GrindSpec(bd("30"), BigDecimal.ZERO, null, null);

      assertThat(converter.toMicron(noRange, bd("999"))).isEqualByComparingTo("29970");
    }

    @Test
    @DisplayName("AC-GRIND-16 · max_setting이 0이면 범위를 검증하지 않는다")
    void max가_0이면_범위를_검증하지_않는다() {
      GrindSpec zeroMax = new GrindSpec(bd("30"), BigDecimal.ZERO, bd("0"), bd("0"));

      assertThat(converter.toMicron(zeroMax, bd("20"))).isEqualByComparingTo("600");
    }

    @Test
    void 상한을_넘으면_거부한다() {
      assertThatThrownBy(() -> converter.toMicron(C40, bd("51")))
          .isInstanceOf(GrindSettingOutOfRangeException.class);
    }

    @Test
    void 하한_아래는_거부한다() {
      assertThatThrownBy(() -> converter.toMicron(C40, bd("-1")))
          .isInstanceOf(GrindSettingOutOfRangeException.class);
    }

    @Test
    void 경계값은_양쪽_다_허용한다() {
      assertThat(converter.toMicron(C40, bd("0"))).isEqualByComparingTo("0");
      assertThat(converter.toMicron(C40, bd("50"))).isEqualByComparingTo("1500");
    }
  }

  @Nested
  @DisplayName("환산 가능 여부 판정")
  class Convertible {

    @Test
    void 클릭당_마이크론이_있으면_환산_가능하다() {
      assertThat(C40.convertible()).isTrue();
    }

    @Test
    void 클릭당_마이크론이_없으면_환산_불가다() {
      assertThat(STEPLESS.convertible()).isFalse();
    }

    @Test
    void 클릭당_마이크론이_0이하면_환산_불가다() {
      assertThat(new GrindSpec(BigDecimal.ZERO, BigDecimal.ZERO, null, null).convertible())
          .isFalse();
    }

    @Test
    void 원본이_환산_불가면_예외를_던진다() {
      assertThatThrownBy(() -> converter.toMicron(STEPLESS, bd("10")))
          .isInstanceOf(GrindNotConvertibleException.class);
    }

    @Test
    void 대상이_환산_불가면_예외를_던진다() {
      assertThatThrownBy(() -> converter.convert(C40, bd("22"), STEPLESS))
          .isInstanceOf(GrindNotConvertibleException.class);
    }
  }
}
