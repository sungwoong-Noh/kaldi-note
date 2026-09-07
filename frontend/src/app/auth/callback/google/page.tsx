import { AuthCallback } from "@/features/auth/components/AuthCallback";
import { safeNextPath } from "@/features/auth/kakao";

/**
 * 구글이 되돌려보내는 곳.
 *
 * <p><b>경로가 곧 provider 계약이다.</b> 카카오와 같은 `/auth/callback`을 쓰면 화면이 어느 provider인지 알 수 없어 `state`에 provider를
 * 실어야 하는데, 그러면 `state` 하나가 「돌아갈 경로」와 「provider」 둘을 나르게 된다 —
 * docs/specs/2026-09-07-google-login.md의 「콜백 경로를 나누는 이유」.
 *
 * <p>`safeNextPath`를 `kakao.ts`에서 가져오는 것이 어색하지만 옮기지 않았다. 계획에 없는 리팩터링이다.
 */
export default async function GoogleAuthCallbackPage({
  searchParams,
}: {
  // Next 16에서 searchParams는 Promise다.
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const code = Array.isArray(params.code)
    ? params.code[0]
    : (params.code ?? null);
  // 구글도 인가 요청에 실어 보낸 state를 그대로 돌려준다.
  const next = safeNextPath(params.state ?? params.next);

  return <AuthCallback code={code} next={next} provider="google" />;
}
