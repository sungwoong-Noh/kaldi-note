"use client";

/**
 * 로그 삭제 확인 대화상자.
 *
 * <p>레시피용(`DeleteRecipeDialog`)과 형태는 같지만 <b>문구가 다르다.</b> 레시피는 설계도라 지워도 다시 쓸 수 있지만,
 * 로그는 그날 실제로 내린 기록이라 되살릴 방법이 없다.
 */
export function DeleteBrewLogDialog({
  deleting,
  onConfirm,
  onCancel,
}: {
  deleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-brew-log-title"
        className="flex w-full max-w-sm flex-col gap-4 rounded-lg bg-white p-5 dark:bg-neutral-900"
      >
        <h2 id="delete-brew-log-title" className="text-base font-semibold">
          이 기록을 삭제할까요?
        </h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          내린 기록은 되살릴 수 없습니다.
        </p>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            삭제합니다
          </button>
        </div>
      </div>
    </div>
  );
}
