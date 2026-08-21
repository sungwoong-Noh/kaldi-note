import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from './msw-server';

/**
 * 하네스 자체를 검증한다. 이게 초록인 것을 확인하지 않고 다음 태스크로 가면, 이후의 모든 실패가 하네스 문제인지 코드 문제인지 구분되지 않는다.
 */
describe('테스트 하네스', () => {
  it('컴포넌트를 렌더링하고 조회할 수 있다', () => {
    render(<p>렌더링 확인</p>);

    expect(screen.getByText('렌더링 확인')).toBeInTheDocument();
  });

  it('MSW가 절대 URL 요청을 가로챈다', async () => {
    server.use(
      http.get('http://localhost:8080/api/v1/ping', () => HttpResponse.json({ pong: true })),
    );

    const res = await fetch('http://localhost:8080/api/v1/ping');

    expect(await res.json()).toEqual({ pong: true });
  });

  it('MSW가 상대 경로 요청을 가로챈다', async () => {
    server.use(http.post('/api/auth/login', () => HttpResponse.json({ ok: true })));

    const res = await fetch('/api/auth/login', { method: 'POST' });

    expect(await res.json()).toEqual({ ok: true });
  });
});
