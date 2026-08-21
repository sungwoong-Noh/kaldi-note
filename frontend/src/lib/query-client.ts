import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api-client';

/**
 * 401은 `authedRequest`가 이미 refresh로 처리한다. 여기까지 온 401은 갱신도 실패한 것이라 재시도할 이유가 없다. 4xx 전반이 마찬가지다 —
 * 같은 요청을 반복해도 같은 답이 온다.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return false;
  }
  return failureCount < 1;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetry },
      mutations: { retry: false },
    },
  });
}
