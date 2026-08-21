import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './src/test/msw-server';

// 핸들러를 등록하지 않은 요청은 통과시키지 않고 에러로 만든다.
// 조용히 실제 네트워크로 나가면 테스트가 이유 없이 느려지고 CI에서만 깨진다.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => server.close());
