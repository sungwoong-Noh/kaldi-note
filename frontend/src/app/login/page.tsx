import { kakaoAuthorizeUrl, safeNextPath } from "@/features/auth/kakao";

/**
 * 카카오 인가 페이지로 보낸다.
 *
 * <p>버튼이 아니라 링크인 이유: 실제로 하는 일이 다른 문서로의 이동이다. 링크로 두면 새 탭 열기·가운데 클릭이 그대로 동작하고, 스크린리더도 이동임을
 * 알린다.
 */
export default async function LoginPage({
  searchParams,
}: {
  // Next 16에서 searchParams는 Promise다.
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const next = safeNextPath((await searchParams).next);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">kaldi note</h1>
        <p className="mt-2 text-sm text-neutral-500">
          커피 레시피를 재현 가능한 형태로 기록하고 공유합니다.
        </p>
      </div>

      <a
        href={kakaoAuthorizeUrl(next)}
        className="w-full max-w-xs rounded-md bg-[#FEE500] px-4 py-3 text-center font-medium text-[#191600]"
      >
        카카오로 로그인
      </a>
    </main>
  );
}
