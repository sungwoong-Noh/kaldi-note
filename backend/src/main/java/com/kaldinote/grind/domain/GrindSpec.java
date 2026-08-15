package com.kaldinote.grind.domain;

import java.math.BigDecimal;
import java.util.Objects;

/**
 * 그라인더의 분쇄도 환산 특성.
 *
 * <p>범위 검증까지 순수 도메인에서 단위 테스트로 검증하기 위해 min·max를 함께 갖는다. 엔티티를 끌어오면 이 패키지의 무의존 원칙이 깨진다.
 *
 * @param micronsPerClick 클릭 1칸당 입자 크기 변화량(µm). 무단계 그라인더는 null
 * @param zeroPointOffsetClicks 버가 맞닿는 영점의 클릭 값. 대부분 0
 * @param minSetting 제조사 사양의 최소 설정값. 모르면 null
 * @param maxSetting 제조사 사양의 최대 설정값. 모르면 null
 */
public record GrindSpec(
    BigDecimal micronsPerClick,
    BigDecimal zeroPointOffsetClicks,
    BigDecimal minSetting,
    BigDecimal maxSetting) {

  public GrindSpec {
    Objects.requireNonNull(zeroPointOffsetClicks, "zeroPointOffsetClicks는 null일 수 없습니다");
  }

  /** 클릭당 마이크론을 알아야만 다른 그라인더로 환산할 수 있다. */
  public boolean convertible() {
    return micronsPerClick != null && micronsPerClick.signum() > 0;
  }

  /** 범위를 검증할 수 있는가. min·max가 null이거나 max가 0이면 사양을 모르는 것으로 보고 검증을 생략한다. */
  public boolean rangeChecked() {
    return minSetting != null && maxSetting != null && maxSetting.signum() > 0;
  }

  /** 실제 하한. min_setting이 0이어도 영점이 3이면 3보다 낮은 값은 마이크론이 음수가 된다. 둘 중 큰 값이 하한이다. */
  public BigDecimal effectiveMinSetting() {
    if (minSetting == null) {
      return zeroPointOffsetClicks;
    }
    return minSetting.max(zeroPointOffsetClicks);
  }
}
