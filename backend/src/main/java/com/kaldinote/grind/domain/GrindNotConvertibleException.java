package com.kaldinote.grind.domain;

/** 클릭당 마이크론 정보가 없어 환산할 수 없을 때 발생한다. HTTP 422로 매핑된다. */
public class GrindNotConvertibleException extends RuntimeException {

  public GrindNotConvertibleException(String message) {
    super(message);
  }
}
