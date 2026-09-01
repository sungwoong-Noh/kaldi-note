package com.kaldinote.extraction.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

class ExtractionAnalyzerTest {

  private final ExtractionAnalyzer analyzer = new ExtractionAnalyzer();

  private static BrewMeasurement measurement(
      String dose, String water, String beverage, String tds) {
    return new BrewMeasurement(
        new BigDecimal(dose),
        new BigDecimal(water),
        beverage == null ? null : new BigDecimal(beverage),
        tds == null ? null : new BigDecimal(tds));
  }

  @Nested
  @DisplayName("브루 비율")
  class BrewRatio {

    @Test
    @DisplayName("AC-EXT-01 · 브루 비율은 물량을 원두량으로 나눈 값이다")
    void 물량을_원두량으로_나눈_값이다() {
      // 250 / 15 = 16.666... → 16.7
      assertThat(analyzer.analyze(measurement("15", "250", null, null)).brewRatio())
          .isEqualByComparingTo("16.7");
    }

    @Test
    @DisplayName("AC-EXT-02 · TDS가 없어도 비율은 항상 계산된다")
    void TDS가_없어도_비율은_항상_계산된다() {
      ExtractionAnalysis result = analyzer.analyze(measurement("20", "300", null, null));

      assertThat(result.brewRatio()).isEqualByComparingTo("15.0");
      assertThat(result.measured()).isFalse();
    }
  }

  @Nested
  @DisplayName("추출 수율")
  class Yield {

    @Test
    @DisplayName("AC-EXT-03 · 음료 중량과 TDS로 수율을 계산한다")
    void 음료중량과_TDS로_수율을_계산한다() {
      // (250 × 1.35) / 15 = 22.5
      ExtractionAnalysis result = analyzer.analyze(measurement("15", "250", "250", "1.35"));

      assertThat(result.extractionYieldPercent()).isEqualByComparingTo("22.5");
      assertThat(result.measured()).isTrue();
    }

    @Test
    @DisplayName("AC-EXT-04 · 두 축이 모두 이상 구간이면 IDEAL로 분류된다")
    void 이상적인_추출은_IDEAL_구간에_들어간다() {
      // (240 × 1.25) / 15 = 20.0
      ExtractionAnalysis result = analyzer.analyze(measurement("15", "300", "240", "1.25"));

      assertThat(result.extractionYieldPercent()).isEqualByComparingTo("20.0");
      assertThat(result.extractionZone()).isEqualTo(ExtractionZone.IDEAL);
      assertThat(result.strengthZone()).isEqualTo(StrengthZone.IDEAL);
    }

    @Test
    @DisplayName("AC-EXT-05 · TDS가 없으면 수율과 구간이 모두 null이다")
    void TDS가_없으면_수율과_구간이_모두_null이다() {
      ExtractionAnalysis result = analyzer.analyze(measurement("15", "250", "240", null));

      assertThat(result.extractionYieldPercent()).isNull();
      assertThat(result.extractionZone()).isNull();
      assertThat(result.strengthZone()).isNull();
      assertThat(result.diagnosis()).contains("TDS");
    }

    @Test
    @DisplayName("AC-EXT-06 · 음료 중량이 없으면 수율을 계산하지 않는다")
    void 음료중량이_없으면_수율을_계산하지_않는다() {
      ExtractionAnalysis result = analyzer.analyze(measurement("15", "250", null, "1.25"));

      assertThat(result.extractionYieldPercent()).isNull();
      // TDS는 있다. "TDS가 없다"고 하면 사용자가 고칠 곳을 못 찾는다.
      assertThat(result.diagnosis())
          .isEqualTo("음료 중량이 없어 추출 수율을 계산할 수 없습니다. 추출 후 잔의 무게를 재어 입력하세요.");
    }
  }

  @Nested
  @DisplayName("SCA 구간 경계값")
  class Boundaries {

    @Test
    @DisplayName("AC-EXT-10 · 수율 18.0은 이상 구간에 포함된다")
    void 수율_18_0은_IDEAL이다() {
      // (216 × 1.25) / 15 = 18.0
      ExtractionAnalysis result = analyzer.analyze(measurement("15", "300", "216", "1.25"));

      assertThat(result.extractionYieldPercent()).isEqualByComparingTo("18.0");
      assertThat(result.extractionZone()).isEqualTo(ExtractionZone.IDEAL);
    }

    @Test
    @DisplayName("AC-EXT-11 · 수율 22.0은 이상 구간에 포함된다")
    void 수율_22_0은_IDEAL이다() {
      // (264 × 1.25) / 15 = 22.0
      ExtractionAnalysis result = analyzer.analyze(measurement("15", "300", "264", "1.25"));

      assertThat(result.extractionYieldPercent()).isEqualByComparingTo("22.0");
      assertThat(result.extractionZone()).isEqualTo(ExtractionZone.IDEAL);
    }

    @Test
    @DisplayName("AC-EXT-12 · 수율 17.9는 과소추출이다")
    void 수율_17_9는_과소추출이다() {
      // (214.8 × 1.25) / 15 = 17.9
      ExtractionAnalysis result = analyzer.analyze(measurement("15", "300", "214.8", "1.25"));

      assertThat(result.extractionZone()).isEqualTo(ExtractionZone.UNDER);
      assertThat(result.diagnosis()).contains("곱게");
    }

    @Test
    @DisplayName("AC-EXT-13 · 수율 22.1은 과다추출이다")
    void 수율_22_1은_과다추출이다() {
      // (265.2 × 1.25) / 15 = 22.1
      ExtractionAnalysis result = analyzer.analyze(measurement("15", "300", "265.2", "1.25"));

      assertThat(result.extractionZone()).isEqualTo(ExtractionZone.OVER);
      assertThat(result.diagnosis()).contains("굵게");
    }

    @Test
    @DisplayName("AC-EXT-14 · TDS 1.15는 이상 구간에 포함된다")
    void TDS_1_15는_IDEAL이다() {
      assertThat(analyzer.analyze(measurement("15", "300", "250", "1.15")).strengthZone())
          .isEqualTo(StrengthZone.IDEAL);
    }

    @Test
    @DisplayName("AC-EXT-15 · TDS 1.35는 이상 구간에 포함된다")
    void TDS_1_35는_IDEAL이다() {
      assertThat(analyzer.analyze(measurement("15", "300", "250", "1.35")).strengthZone())
          .isEqualTo(StrengthZone.IDEAL);
    }

    @Test
    @DisplayName("AC-EXT-16 · TDS 1.14는 농도가 옅다")
    void TDS_1_14는_농도가_옅다() {
      ExtractionAnalysis result = analyzer.analyze(measurement("15", "300", "250", "1.14"));

      assertThat(result.strengthZone()).isEqualTo(StrengthZone.WEAK);
      assertThat(result.diagnosis()).contains("물을 줄여");
    }

    @Test
    @DisplayName("AC-EXT-17 · TDS 1.36은 농도가 진하다")
    void TDS_1_36은_농도가_진하다() {
      assertThat(analyzer.analyze(measurement("15", "300", "250", "1.36")).strengthZone())
          .isEqualTo(StrengthZone.STRONG);
    }

    @Test
    @DisplayName("AC-EXT-18 · 수율 30.0은 허용된다")
    void 수율_30_0은_허용된다() {
      // (250 × 1.8) / 15 = 30.0 — 물리 한계의 경계는 포함
      assertThat(analyzer.analyze(measurement("15", "300", "250", "1.8")).extractionYieldPercent())
          .isEqualByComparingTo("30.0");
    }

    @Test
    @DisplayName("AC-EXT-19 · 수율이 30.0을 넘으면 거부한다")
    void 수율이_30을_넘으면_거부한다() {
      // (251 × 1.8) / 15 = 30.12 → 30.1
      assertThatThrownBy(() -> analyzer.analyze(measurement("15", "300", "251", "1.8")))
          .isInstanceOf(InvalidBrewMeasurementException.class);
    }
  }

  @Nested
  @DisplayName("진단 문구")
  class Diagnosis {

    @Test
    @DisplayName("AC-EXT-07 · 이상 구간이면 기준으로 삼으라고 안내한다")
    void 이상_구간이면_기준으로_삼으라고_안내한다() {
      assertThat(analyzer.analyze(measurement("15", "300", "240", "1.25")).diagnosis())
          .contains("이상적");
    }

    @Test
    @DisplayName("AC-EXT-08 · 추출과 농도가 모두 벗어나면 두 진단을 함께 준다")
    void 추출과_농도가_모두_벗어나면_두_진단을_함께_준다() {
      // (240 × 1.45) / 15 = 23.2 → 과다추출 + 진한 농도
      ExtractionAnalysis result = analyzer.analyze(measurement("15", "300", "240", "1.45"));

      assertThat(result.extractionYieldPercent()).isEqualByComparingTo("23.2");
      assertThat(result.extractionZone()).isEqualTo(ExtractionZone.OVER);
      assertThat(result.strengthZone()).isEqualTo(StrengthZone.STRONG);
      assertThat(result.diagnosis()).contains("굵게").contains("물을 늘려");
    }
  }

  @Nested
  @DisplayName("입력 검증")
  class Validation {

    @Test
    @DisplayName("AC-EXT-30 · 원두량이 0 이하면 거부한다")
    void 원두량이_0이면_거부한다() {
      assertThatThrownBy(() -> measurement("0", "250", null, null))
          .isInstanceOf(InvalidBrewMeasurementException.class);
    }

    @Test
    @DisplayName("AC-EXT-31 · 물량이 0 이하면 거부한다")
    void 물량이_0이면_거부한다() {
      assertThatThrownBy(() -> measurement("15", "0", null, null))
          .isInstanceOf(InvalidBrewMeasurementException.class);
    }

    @Test
    @DisplayName("AC-EXT-32 · 음료 중량이 0 이하면 거부한다")
    void 음료중량이_0이면_거부한다() {
      assertThatThrownBy(() -> measurement("15", "250", "0", "1.25"))
          .isInstanceOf(InvalidBrewMeasurementException.class);
    }

    @Test
    @DisplayName("AC-EXT-33 · TDS가 0 이하면 거부한다")
    void TDS가_0이면_거부한다() {
      assertThatThrownBy(() -> measurement("15", "250", "240", "0"))
          .isInstanceOf(InvalidBrewMeasurementException.class);
    }

    @Test
    @DisplayName("AC-EXT-34 · TDS가 100 이상이면 거부한다")
    void TDS가_100이면_거부한다() {
      assertThatThrownBy(() -> measurement("15", "250", "240", "100"))
          .isInstanceOf(InvalidBrewMeasurementException.class);
    }

    @Test
    @DisplayName("AC-EXT-35 · 음료가 물보다 많으면 거부한다")
    void 음료가_물보다_많으면_거부한다() {
      // 원두가 물을 머금으므로 음료가 부은 물보다 많을 수 없다
      assertThatThrownBy(() -> measurement("15", "250", "251", "1.25"))
          .isInstanceOf(InvalidBrewMeasurementException.class);
    }

    @Test
    @DisplayName("AC-EXT-36 · 음료와 물이 같은 것은 허용한다")
    void 음료와_물이_같으면_허용한다() {
      // (250 × 1.25) / 15 = 20.833... → 20.8
      assertThat(analyzer.analyze(measurement("15", "250", "250", "1.25")).extractionYieldPercent())
          .isEqualByComparingTo("20.8");
    }
  }
}
