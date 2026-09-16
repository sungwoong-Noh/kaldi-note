import type { ReactNode } from "react";

/** 카드·다이얼로그의 면. 그림자를 쓰지 않으므로 층은 보더와 면의 명도 차이로만 만든다. */
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-surface border border-border p-4 ${className}`.trim()}
    >
      {children}
    </div>
  );
}

/** 배지. 강조(`accent`)는 CURATED처럼 출처를 밝히는 자리에만 쓴다. */
export function Badge({
  children,
  tone = "default",
  className = "",
}: {
  children: ReactNode;
  tone?: "default" | "accent";
  className?: string;
}) {
  const palette =
    tone === "accent" ? "bg-accent-wash text-accent" : "bg-surface text-ink-3";

  return (
    <span
      className={`shrink-0 rounded-tag px-2 py-1 text-body-sm ${palette} ${className}`.trim()}
    >
      {children}
    </span>
  );
}

/**
 * 라벨-값 한 줄. 기록의 기본 단위다.
 *
 * <p>값은 **Mono**로 쓴다 — 자릿수가 정렬돼야 목록에서 값이 흔들리지 않는다.
 */
export function MetricRow({
  label,
  value,
  className = "",
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-1 ${className}`.trim()}>
      <dt className="text-body-sm text-ink-3">{label}</dt>
      <dd className="text-metric">{value}</dd>
    </div>
  );
}
