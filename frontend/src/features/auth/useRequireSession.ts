'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/session';

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
 * @returns `ready`가 true가 되면 화면을 그려도 된다.
 */
export function useRequireSession(): { ready: boolean; onSessionLost: () => void } {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(() => getAccessToken() !== null);

  const onSessionLost = useCallback(() => {
    router.replace(loginPathFor(pathname));
  }, [router, pathname]);

  useEffect(() => {
    if (getAccessToken() !== null) return;

    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/auth/refresh', { method: 'POST' });
        if (cancelled) return;

        if (!response.ok) {
          router.replace(loginPathFor(pathname));
          return;
        }

        const { accessToken } = (await response.json()) as { accessToken: string };
        const { setAccessToken } = await import('@/lib/session');
        setAccessToken(accessToken);
        setReady(true);
      } catch {
        if (!cancelled) router.replace(loginPathFor(pathname));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router, pathname]);

  return { ready, onSessionLost };
}
