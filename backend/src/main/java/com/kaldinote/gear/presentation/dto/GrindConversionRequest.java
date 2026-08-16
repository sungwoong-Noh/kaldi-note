package com.kaldinote.gear.presentation.dto;

import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

/**
 * sourceSetting에 하한 검증(예: {@code @DecimalMin})을 걸지 않는다. 하한은 그라인더마다 다르고 영점 보정에 따라 달라지므로, 범위 검증은
 * 도메인({@code GrindConverter})이 담당한다. 여기서 0 이상을 강제하면 AC-GRIND-13(-1 → GRIND_SETTING_OUT_OF_RANGE)이
 * INVALID_REQUEST로 잘못 응답한다.
 */
public record GrindConversionRequest(
    @NotNull Long sourceGrinderModelId,
    @NotNull BigDecimal sourceSetting,
    @NotNull Long targetGrinderModelId) {}
