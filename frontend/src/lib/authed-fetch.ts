import { z } from 'zod';
import { ApiError, request } from './api-client';
import { getAccessToken, clearSession, setAccessToken } from './session';

const refreshResponseSchema = z.object({
  accessToken: z.string(),
  expiresInSeconds: z.number(),
});

/**
 * 진행 중인 refresh 요청. 상세 화면은 레시피·브루어·필터를 함께 부르므로 세 요청이 동시에 401을 받을 수 있다. 공유하지 않으면 refresh가 세 번
 * 나가고, 백엔드가 토큰을 회전시키는 경우 뒤의 둘이 이미 무효해진 토큰으로 요청해 실패한다.
 */
let inFlightRefresh: Promise<string | null> | null = null;

/** 테스트 전용. 모듈 스코프 상태를 테스트 사이에 지운다. */
export function __resetRefreshState(): void {
  inFlightRefresh = null;
}

async function refreshAccessToken(): Promise<string | null> {
  inFlightRefresh ??= (async () => {
    try {
      const response = await fetch('/api/auth/refresh', { method: 'POST' });
      if (!response.ok) return null;

      const { accessToken } = refreshResponseSchema.parse(await response.json());
      setAccessToken(accessToken);
      return accessToken;
    } catch {
      return null;
    } finally {
      // 다음 401은 새로 갱신을 시도할 수 있어야 한다.
      inFlightRefresh = null;
    }
  })();

  return inFlightRefresh;
}

function withAuth(init: RequestInit, token: string | null): RequestInit {
  if (!token) return init;
  return {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` },
  };
}

/**
 * 인증이 필요한 백엔드 호출. 401을 받으면 refresh를 **정확히 1회** 시도하고 성공하면 원 요청을 재시도한다.
 *
 * @param onSessionLost 갱신에 실패했을 때 호출된다. 화면이 `/login?next=…`로 보내는 데 쓴다.
 * @throws {ApiError}
 */
export async function authedRequest<T>(
  url: string,
  init: RequestInit & { schema: z.ZodType<T>; onSessionLost?: () => void },
): Promise<T> {
  const { onSessionLost, ...rest } = init;

  try {
    return await request(url, withAuth(rest, getAccessToken()) as typeof rest);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) {
      throw error;
    }

    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      clearSession();
      onSessionLost?.();
      throw error;
    }

    return request(url, withAuth(rest, refreshed) as typeof rest);
  }
}
