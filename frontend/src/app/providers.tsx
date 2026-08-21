'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { createQueryClient } from '@/lib/query-client';

/**
 * QueryClient를 모듈 스코프에 두면 서버에서 요청 사이에 캐시가 공유된다. useState로 컴포넌트 수명에 묶어 브라우저 세션마다 하나씩 갖게 한다.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(createQueryClient);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
