package com.kaldinote.inventory.domain;

public enum DegassingStatus {
  TOO_FRESH,
  IDEAL,
  PAST_PEAK;

  public static DegassingStatus of(long daysOffRoast) {
    if (daysOffRoast <= 2) {
      return TOO_FRESH;
    }
    if (daysOffRoast <= 14) {
      return IDEAL;
    }
    return PAST_PEAK;
  }
}
