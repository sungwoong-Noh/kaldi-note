package com.kaldinote.extraction.domain;

/**
 * 추출 측정값이 물리적으로 불가능할 때 발생한다. HTTP 400으로 매핑된다.
 *
 * <p>{@code IllegalArgumentException}을 쓰지 않는 이유: 그 예외를 통째로 잡는 핸들러를 두면 다른 곳의 진짜 프로그래밍 버그까지 400으로 숨겨서
 * 500이 나야 할 상황을 조용히 넘긴다.
 */
public class InvalidBrewMeasurementException extends RuntimeException {

  public InvalidBrewMeasurementException(String message) {
    super(message);
  }
}
