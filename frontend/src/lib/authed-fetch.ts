import { z } from "zod";
import { ApiError, request } from "./api-client";
import { refreshSession } from "./refresh";
import { clearSession, getAccessToken } from "./session";

export { __resetRefreshState } from "./refresh";

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

    const refreshed = await refreshSession();
    if (!refreshed) {
      clearSession();
      onSessionLost?.();
      throw error;
    }

    return request(url, withAuth(rest, refreshed) as typeof rest);
  }
}
