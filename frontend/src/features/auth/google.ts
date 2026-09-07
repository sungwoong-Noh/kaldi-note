const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";

/**
 * 구글 인가 URL을 만든다.
 *
 * <p>`redirect_uri`는 구글 클라우드 콘솔에 등록한 값·백엔드의 `GOOGLE_REDIRECT_URI`와 문자 하나까지 같아야 한다. 셋 중 하나라도 다르면
 * 구글이 인가코드 교환을 거부한다.
 *
 * <p><b>카카오와 경로가 다르다</b>(`/auth/callback/google`). 콜백 화면이 경로로 provider를 판정하기 때문이다 —
 * docs/specs/2026-09-07-google-login.md의 「콜백 경로를 나누는 이유」.
 */
export function googleAuthorizeUrl(next: string): string {
  const params = new URLSearchParams({
    client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "",
    redirect_uri:
      process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI ??
      "http://localhost:3000/auth/callback/google",
    response_type: "code",
    // GoogleOAuthClient가 sub·email·name·picture를 읽는다. openid가 없으면 sub가,
    // profile이 없으면 name·picture가 비어 돌아온다.
    scope: "openid email profile",
    // 로그인 후 돌아갈 경로. 구글이 그대로 되돌려준다.
    state: next,
  });

  return `${GOOGLE_AUTHORIZE_URL}?${params.toString()}`;
}
