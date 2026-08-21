const KAKAO_AUTHORIZE_URL = "https://kauth.kakao.com/oauth/authorize";

/**
 * 카카오 인가 URL을 만든다.
 *
 * <p>`redirect_uri`는 카카오 콘솔에 등록한 값·백엔드의 `KAKAO_REDIRECT_URI`와 문자 하나까지 같아야 한다. 셋 중 하나라도 다르면 카카오가
 * 인가코드 교환을 거부한다.
 */
export function kakaoAuthorizeUrl(next: string): string {
  const params = new URLSearchParams({
    client_id: process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID ?? "",
    redirect_uri:
      process.env.NEXT_PUBLIC_KAKAO_REDIRECT_URI ??
      "http://localhost:3000/auth/callback",
    response_type: "code",
    // 로그인 후 돌아갈 경로. 카카오가 그대로 되돌려준다.
    state: next,
  });

  return `${KAKAO_AUTHORIZE_URL}?${params.toString()}`;
}

/** 로그인 후 돌아갈 경로. 외부 사이트로 튕기지 않도록 앱 내부 경로만 허용한다. */
export function safeNextPath(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/recipes";
  }
  return value;
}
