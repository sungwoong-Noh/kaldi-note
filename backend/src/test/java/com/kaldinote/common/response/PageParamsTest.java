package com.kaldinote.common.response;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.kaldinote.common.error.BusinessException;
import com.kaldinote.common.error.ErrorCode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** 목록 조회 파라미터의 경계값. HTTP 레벨 검증은 RecipeControllerTest가 담당한다. */
class PageParamsTest {

  @Test
  @DisplayName("생략하면 page 0, size 20이 된다")
  void 생략하면_기본값이_적용된다() {
    PageParams params = PageParams.of(null, null);

    assertThat(params.page()).isZero();
    assertThat(params.size()).isEqualTo(20);
  }

  @Test
  @DisplayName("size 100은 상한 포함이라 허용된다")
  void size_100은_허용된다() {
    assertThat(PageParams.of(0, 100).size()).isEqualTo(100);
  }

  @Test
  @DisplayName("size 1은 하한 포함이라 허용된다")
  void size_1은_허용된다() {
    assertThat(PageParams.of(0, 1).size()).isEqualTo(1);
  }

  @Test
  @DisplayName("size 101은 상한 바로 바깥이라 거절된다")
  void size_101은_거절된다() {
    assertThatThrownBy(() -> PageParams.of(0, 101))
        .isInstanceOf(BusinessException.class)
        .extracting(e -> ((BusinessException) e).getErrorCode())
        .isEqualTo(ErrorCode.INVALID_REQUEST);
  }

  @Test
  @DisplayName("size 0은 하한 바로 바깥이라 거절된다")
  void size_0은_거절된다() {
    assertThatThrownBy(() -> PageParams.of(0, 0))
        .isInstanceOf(BusinessException.class)
        .extracting(e -> ((BusinessException) e).getErrorCode())
        .isEqualTo(ErrorCode.INVALID_REQUEST);
  }

  @Test
  @DisplayName("page 음수는 거절된다")
  void page_음수는_거절된다() {
    assertThatThrownBy(() -> PageParams.of(-1, 20))
        .isInstanceOf(BusinessException.class)
        .extracting(e -> ((BusinessException) e).getErrorCode())
        .isEqualTo(ErrorCode.INVALID_REQUEST);
  }
}
