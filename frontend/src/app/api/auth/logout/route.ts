import { NextResponse, type NextRequest } from 'next/server';
import { REFRESH_COOKIE_NAME } from '@/features/auth/cookie';
import { backendUrl } from '@/lib/api-client';

/**
 * 백엔드에서 refresh token을 무효화하고 쿠키를 지운다.
 *
 * <p>백엔드 호출이 실패해도 쿠키는 지운다 — 로그아웃을 눌렀는데 로그인 상태로 남는 것이 더 나쁘다.
 */
export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_COOKIE_NAME)?.value;

  if (refreshToken) {
    await fetch(backendUrl('/api/v1/auth/logout'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => undefined);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(REFRESH_COOKIE_NAME);
  return response;
}
