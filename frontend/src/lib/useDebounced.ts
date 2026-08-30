"use client";

import { useEffect, useState } from "react";

/**
 * 값이 `delayMs` 동안 바뀌지 않았을 때만 따라가는 값.
 *
 * <p>분쇄도 값을 타이핑할 때 글자마다 환산 요청이 나가는 것을 막는다. `22`를 치면 `2` → `22` 두 상태를 거치는데, 그때마다 부르면 쓸모없는
 * 요청이 하나 나가고 부엌에서 폰으로 쓰는 상황에서는 그게 그대로 네트워크 대기 시간이 된다.
 */
export function useDebounced<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return settled;
}
