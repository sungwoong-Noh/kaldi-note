"use client";

import { useEffect } from "react";

/**
 * Service Worker를 등록한다. 화면을 그리지 않는다.
 *
 * <p>등록이 실패해도 앱은 그대로 동작해야 하므로 예외를 삼킨다 — 오프라인 캐시가 없을 뿐이다. 사파리의 사생활 보호 창처럼 `serviceWorker`
 * 자체가 없는 환경도 있다.
 */
export function ServiceWorkerRegistrar(): null {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch(() => undefined);
  }, []);

  return null;
}
