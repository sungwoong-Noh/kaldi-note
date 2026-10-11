import { Button, cardClass } from "@/components/ui";

/** 폼 화면의 `Shell` 폭 — 2컬럼에서 히어로 자리까지 들어가야 한다. `wide`와 함께 쓴다(폭 상한은 Shell이 정한다 — AC-SKIN-01). */
export const FORM_SHELL_CLASS = "max-w-6xl";

/** 바꾼 게 있는 채로 `취소`를 누르면 뜬다 — docs/specs/2026-09-27-brew-form-redesign.md AC-BREWFORM-17. */
export function LeaveConfirmDialog({
  onLeave,
  onStay,
}: {
  onLeave: () => void;
  onStay: () => void;
}) {
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="leave-confirm-title"
        className={cardClass("flex w-full max-w-sm flex-col gap-4", {
          tone: "raised",
        })}
      >
        <h2 id="leave-confirm-title" className="text-card-title font-semibold">
          저장하지 않고 나갈까요?
        </h2>
        <p className="text-body text-ink-3">입력한 내용이 사라집니다.</p>
        <div className="flex justify-end gap-2">
          <Button onClick={onLeave}>나가기</Button>
          <Button onClick={onStay} variant="primary">
            계속 편집
          </Button>
        </div>
      </div>
    </div>
  );
}
