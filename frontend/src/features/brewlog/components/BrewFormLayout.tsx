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
  children,
}: {
  hero: ReactNode;
  formRef?: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6 min-[1024px]:flex-row-reverse min-[1024px]:items-start">
      <aside className="shrink-0 min-[1024px]:sticky min-[1024px]:top-6 min-[1024px]:w-[360px] min-[1280px]:w-[420px]">
        {hero}
      </aside>
      <div ref={formRef} className="flex min-w-0 flex-1 flex-col gap-4">
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
