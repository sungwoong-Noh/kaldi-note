"use client";

/**
 * 삭제 확인 대화상자.
 *
 * <p>브라우저 `confirm()`을 쓰지 않는다 — 그건 페이지 전체를 멈추고, 문구를 우리가 정할 수 없으며, 테스트에서 잡을 수도 없다.
 *
 * <p>열렸을 때만 그린다. 닫힌 상태에서 DOM에 남겨두면 "삭제합니다" 버튼이 계속 존재해 취소했는지 확인했는지 구분할 수 없다.
 */
export function DeleteRecipeDialog({
  title,
  deleting,
  onConfirm,
  onCancel,
}: {
  title: string;
  deleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-recipe-title"
        className="flex w-full max-w-sm flex-col gap-4 rounded-lg bg-white p-5 dark:bg-neutral-900"
      >
        <h2 id="delete-recipe-title" className="text-base font-semibold">
          레시피를 삭제할까요?
        </h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {title} — 되돌릴 수 없습니다.
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
