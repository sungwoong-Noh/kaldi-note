import { ApiError, CLIENT_ERROR_CODE } from "@/lib/api-client";

/** 백엔드 message는 사용자에게 그대로 보여줄 수 있는 한국어다. 프론트가 문구를 다시 만들지 않는다. */
export function errorMessageOf(error: unknown): string {
  if (error instanceof ApiError && error.code !== CLIENT_ERROR_CODE) {
    return error.message;
  }
  return "일시적인 오류가 발생했습니다.";
}

export function ErrorState({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-12">
      <p className="text-center text-sm">{errorMessageOf(error)}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
      >
        다시 시도
      </button>
    </div>
  );
}
