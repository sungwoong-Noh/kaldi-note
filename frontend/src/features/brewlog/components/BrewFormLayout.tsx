import { Button, cardClass } from "@/components/ui";
import type { ReactNode, RefObject } from "react";

/**
 * 기록 작성·편집이 함께 쓰는 틀 — docs/specs/2026-09-27-brew-form-redesign.md AC-BREWFORM-01·12.
 *
 * <p>좁은 폭은 히어로가 위, 1024px부터는 오른쪽(1024–1279: 360px, 1280~: 420px). DOM 순서는
 * 히어로가 먼저라 좁은 폭에서 따로 옮길 필요가 없다.
 */
export function BrewFormLayout({
  hero,
  formRef,
  generalError = null,
  children,
}: {
  hero: ReactNode;
  formRef?: RefObject<HTMLDivElement | null>;
  /** 필드에도 묶음에도 붙지 않는 서버 문구. 폼 맨 위에 둔다(AC-BREWFORM-22) */
  generalError?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6 min-[1024px]:flex-row-reverse min-[1024px]:items-start">
      <aside className="shrink-0 min-[1024px]:sticky min-[1024px]:top-6 min-[1024px]:w-[360px] min-[1280px]:w-[420px]">
        {hero}
      </aside>
      <div ref={formRef} className="flex min-w-0 flex-1 flex-col gap-4">
        {generalError !== null && (
          <p data-general-error tabIndex={-1} className="text-body text-danger">
            {generalError}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}

/**
 * 저장·취소 줄. 760px 미만에서는 화면 하단에 붙는다 — 부엌에서 한 손으로 누르는 버튼이다.
 *
 * <p>`fixed`가 아니라 `sticky`다. 흐름 안에 남아 있어 마지막 입력칸을 가리지 않도록 아래 여백을
 * 따로 줄 필요가 없다(여백을 주려면 간격 6단계 밖의 값이 필요했다 — AC-SPACE-01).
 */
export function FormActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 max-[759px]:sticky max-[759px]:bottom-0 max-[759px]:z-10 max-[759px]:-mx-6 max-[759px]:border-t max-[759px]:border-divider max-[759px]:bg-paper max-[759px]:px-6 max-[759px]:py-3">
      {children}
    </div>
  );
}

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
