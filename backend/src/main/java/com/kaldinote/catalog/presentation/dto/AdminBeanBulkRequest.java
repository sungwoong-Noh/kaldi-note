package com.kaldinote.catalog.presentation.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/** 일괄 확인 · 숨김 · 숨김 해제. ids 1~100개, 중복은 한 번으로 친다. */
public record AdminBeanBulkRequest(
    @NotNull @Size(min = 1, max = 100) List<@NotNull Long> ids, @NotNull Action action) {

  public enum Action {
    VERIFY,
    HIDE,
    UNHIDE
  }
}
