import { NextResponse, type NextRequest } from 'next/server';
import { REFRESH_COOKIE_NAME, refreshCookieOptions } from '@/features/auth/cookie';
import { tokenPairSchema } from '@/features/auth/schema';
import { backendUrl } from '@/lib/api-client';

/**
 * 쿠키의 refresh token으로 새 access token을 받는다.
 *
 * <p>브라우저는 refresh token 값을 볼 수 없으므로 이 경로를 거쳐야 한다. 백엔드가 토큰을 회전시키면 새 refresh도 쿠키에 다시 심는다.
 */
export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_COOKIE_NAME)?.value;

  if (!refreshToken) {
    return NextResponse.json(
      { code: 'REFRESH_TOKEN_INVALID', message: '다시 로그인해 주세요.' },
      { status: 401 },
    );
  }

  const upstream = await fetch(backendUrl('/api/v1/auth/refresh'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!upstream.ok) {
    const body = await upstream.json().catch(() => ({
      code: 'REFRESH_TOKEN_INVALID',
      message: '다시 로그인해 주세요.',
    }));
    // 못 쓰는 토큰이므로 쿠키를 지운다. 남겨두면 매 요청마다 같은 실패를 반복한다.
    const failed = NextResponse.json(body, { status: upstream.status });
    failed.cookies.delete(REFRESH_COOKIE_NAME);
    return failed;
  }

  const tokens = tokenPairSchema.parse(await upstream.json());

  const response = NextResponse.json({
    accessToken: tokens.accessToken,
    expiresInSeconds: tokens.expiresInSeconds,
  });
  response.cookies.set(REFRESH_COOKIE_NAME, tokens.refreshToken, refreshCookieOptions);
  return response;
}
