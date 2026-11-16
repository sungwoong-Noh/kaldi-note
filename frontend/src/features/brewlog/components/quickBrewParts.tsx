/** 빠른 기록 시트와 그 위에 쌓이는 시트가 함께 쓰는 제목 · 버튼. */

export function Heading({ children }: { children: string }) {
  return (
    <h2 className="kn-step-forward text-[21px] font-semibold tracking-[-0.02em] text-ink">
      {children}
    </h2>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled = false,
}: {
  children: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-disabled={disabled}
      onClick={onClick}
      className="kn-press block w-full rounded-[8px] bg-ink p-[15px] text-center text-[15px] font-semibold tracking-[-0.01em] text-on-ink aria-disabled:opacity-60"
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  onClick,
}: {
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="kn-press block w-full rounded-[8px] border border-border p-[15px] text-center text-[15px] text-ink"
    >
      {children}
    </button>
  );
}
