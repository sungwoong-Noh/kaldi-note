import type { RunStatus } from "../schema";

const STYLE: Record<RunStatus, string> = {
  RUNNING: "bg-accent-wash text-accent",
  SUCCEEDED: "bg-sunken text-ink-2",
  FAILED: "bg-ink text-paper",
  INTERRUPTED: "border border-dashed border-ink-3 text-ink-2",
};

/** 상태를 색 하나에 맡기지 않는다 — 언제나 텍스트 라벨이 함께 간다(목업 `StatusTag.dc.html`). */
export function StatusTag({ status }: { status?: RunStatus }) {
  if (!status) {
    return (
      <span data-testid="status-tag" className="font-mono text-ink-3">
        —
      </span>
    );
  }
  return (
    <span
      data-testid="status-tag"
      className={`inline-block rounded-[3px] px-[7px] py-[3px] font-mono text-[10.5px] tracking-[0.08em] whitespace-nowrap ${STYLE[status]}`}
    >
      {status === "RUNNING" ? "● RUNNING" : status}
    </span>
  );
}
