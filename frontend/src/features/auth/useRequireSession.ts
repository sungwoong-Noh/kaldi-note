"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { refreshSession } from "@/lib/refresh";
import {
  hasAccessToken,
  hasAccessTokenOnServer,
  subscribeSession,
} from "@/lib/session";

/** 로그인 후 돌아올 경로를 실어 로그인 화면 주소를 만든다. */
export function loginPathFor(pathname: string): string {
  return `/login?next=${encodeURIComponent(pathname)}`;
}

/**
 * 인증이 필요한 화면에서 쓴다.
 *
 * <p>accessToken은 메모리에만 있어 새로고침하면 사라진다. 그때 곧바로 로그인으로 보내지 않고 refresh를 한 번 시도한다 — 쿠키가 살아 있으면
 * 사용자는 아무것도 눈치채지 못한다.
 *
 * <p><b>`useSyncExternalStore`를 쓰는 이유:</b> 렌더 중에 `getAccessToken()`을 그냥 읽으면 서버는 항상 null이고 클라이언트는
 * 로그인 값이라 첫 렌더 결과가 달라진다. 정적 프리렌더되는 목록에서는 드러나지 않지만 요청마다 서버 렌더하는 상세(`/recipes/[id]`)에서 하이드레이션이
 * 깨진다. 서버 스냅샷을 false로 고정해 양쪽 첫 렌더를 맞춘다.
 *
 * @returns `ready`가 true가 되면 화면을 그려도 된다.
 */
export function useRequireSession(): {
  ready: boolean;
  onSessionLost: () => void;
} {
  const router = useRouter();
  const pathname = usePathname();

  const ready = useSyncExternalStore(
    subscribeSession,
    hasAccessToken,
    hasAccessTokenOnServer,
  );

  const onSessionLost = useCallback(() => {
    router.replace(loginPathFor(pathname));
  }, [router, pathname]);

  useEffect(() => {
    if (ready) return;

    let cancelled = false;
    // 중복 호출은 refreshSession이 막는다. 여기에 ref 잠금을 두면 StrictMode의 두 번째
    // 실행이 그 잠금에 걸려 복구도 리다이렉트도 못 하고 화면이 빈 채로 멈춘다.
    void refreshSession().then((token) => {
      if (cancelled || token) return;
      router.replace(loginPathFor(pathname));
    });

    return () => {
      cancelled = true;
    };
  }, [ready, router, pathname]);

  return { ready, onSessionLost };
}
