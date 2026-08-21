import { AuthCallback } from '@/features/auth/components/AuthCallback';
import { safeNextPath } from '@/features/auth/kakao';

/** 카카오가 되돌려보내는 곳. 인가코드를 꺼내 클라이언트 컴포넌트에 넘긴다. */
export default async function AuthCallbackPage({
  searchParams,
}: {
  // Next 16에서 searchParams는 Promise다.
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const code = Array.isArray(params.code) ? params.code[0] : (params.code ?? null);
  // 카카오는 인가 요청에 실어 보낸 state를 그대로 돌려준다. 거기에 원래 경로가 들어 있다.
  const next = safeNextPath(params.state ?? params.next);

  return <AuthCallback code={code} next={next} />;
}
