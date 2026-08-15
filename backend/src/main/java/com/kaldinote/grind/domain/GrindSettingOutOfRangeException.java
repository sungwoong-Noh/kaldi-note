package com.kaldinote.grind.domain;

/** 설정값이 그라인더의 사양 범위를 벗어났을 때 발생한다. HTTP 400으로 매핑된다. */
public class GrindSettingOutOfRangeException extends RuntimeException {

  public GrindSettingOutOfRangeException(String message) {
    super(message);
  }
}
