import { renderHook } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useViewportWidth } from "./useViewportWidth";

const ORIGINAL_WIDTH = window.innerWidth;

afterEach(() => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: ORIGINAL_WIDTH,
  });
});

describe("useViewportWidth", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1440,
    });
  });

  it("마운트 후 실제 폭을 준다", () => {
    const { result } = renderHook(() => useViewportWidth());

    expect(result.current).toBe(1440);
  });

  it("resize 이벤트에 맞춰 값이 바뀐다", () => {
    const { result } = renderHook(() => useViewportWidth());

    act(() => {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: 759,
      });
      window.dispatchEvent(new Event("resize"));
    });

    expect(result.current).toBe(759);
  });
});
