/**
 * refresh token은 Next 서버 도메인의 httpOnly 쿠키에만 존재한다.
 *
 * <p>백엔드는 refreshToken을 JSON 본문으로 돌려주고 Set-Cookie를 쓰지 않는데, httpOnly 쿠키는 브라우저 JS가 만들 수 없다. 그래서
 * BFF Route Handler가 이 값을 쿠키로 옮긴다.
 */
export const REFRESH_COOKIE_NAME = 'kaldi_refresh';

/** 백엔드 `kaldi.jwt.refresh-token-ttl`(P14D)과 맞춘다. */
export const REFRESH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

export const refreshCookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
  maxAge: REFRESH_COOKIE_MAX_AGE_SECONDS,
  // localhost는 http라 secure를 켜면 쿠키가 아예 저장되지 않는다.
  secure: process.env.NODE_ENV === 'production',
} as const;
