import { NextResponse } from 'next/server';
import { z } from 'zod';
import { REFRESH_COOKIE_NAME, refreshCookieOptions } from '@/features/auth/cookie';
import { loginResponseSchema } from '@/features/auth/schema';
import { backendUrl } from '@/lib/api-client';

/**
 * 인가코드를 백엔드 JWT로 바꾼다.
 *
 * <p>이 핸들러가 존재하는 이유는 하나다 — 백엔드가 refreshToken을 JSON 본문으로 주는데 httpOnly 쿠키는 서버만 심을 수 있기 때문이다.
 * 레시피 조회 같은 나머지 호출은 브라우저가 백엔드를 직접 부른다.
 */
const requestSchema = z.object({
  code: z.string().min(1),
  provider: z.enum(['kakao', 'google']).default('kakao'),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { code: 'INVALID_REQUEST', message: '인가 코드가 없습니다.' },
      { status: 400 },
    );
  }

  const { code, provider } = parsed.data;

  const upstream = await fetch(backendUrl(`/api/v1/auth/login/${provider}`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });

  if (!upstream.ok) {
    // 백엔드의 code와 상태를 그대로 넘긴다. 화면이 code로 분기한다.
    const body = await upstream.json().catch(() => ({
      code: 'CLIENT_ERROR',
      message: '일시적인 오류가 발생했습니다.',
    }));
    return NextResponse.json(body, { status: upstream.status });
  }

  const login = loginResponseSchema.parse(await upstream.json());

  const response = NextResponse.json({
    accessToken: login.tokens.accessToken,
    expiresInSeconds: login.tokens.expiresInSeconds,
    userId: login.userId,
    nickname: login.nickname,
    newUser: login.newUser,
  });
  response.cookies.set(REFRESH_COOKIE_NAME, login.tokens.refreshToken, refreshCookieOptions);
  return response;
}
