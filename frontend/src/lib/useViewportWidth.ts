"use client";

import { useEffect, useState } from "react";

/**
 * 현재 뷰포트 폭. 서버는 항상 `null`을 준다 — 서버는 실제 폭을 모르고, 모바일 우선이라
 * 모른다면 모바일로 취급하는 것이 안전하다. 마운트 후 실제 폭으로 갈아끼운다.
 */
export function useViewportWidth(): number | null {
  const [width, setWidth] = useState<number | null>(null);

  useEffect(() => {
    function update() {
      setWidth(window.innerWidth);
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return width;
}
