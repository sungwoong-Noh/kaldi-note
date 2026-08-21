import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';

/**
 * TanStack Query가 필요한 화면을 렌더링한다.
 *
 * <p>테스트마다 새 QueryClient를 만든다 — 공유하면 앞 테스트의 캐시가 뒤 테스트에 새어들어 "혼자 돌리면 통과하는데 같이 돌리면 실패"가 된다. 재시도는
 * 끈다. 실패를 기대하는 테스트가 재시도를 기다리며 느려진다.
 */
export function renderWithQuery(ui: ReactElement): RenderResult {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}
