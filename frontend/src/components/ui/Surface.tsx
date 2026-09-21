import type { ComponentPropsWithoutRef, ReactNode } from "react";

/**
 * 면 스타일의 단일 출처.
 *
 * <p><b>`Card` 컴포넌트를 쓸 수 없는 자리를 위한 문이다.</b> 목록 카드는 `<Link>`라
 * 감싸면 클릭 영역이 패딩 밖으로 새고, 다이얼로그는 `role`·`aria-modal`을 직접 들고 있다.
 * `controlClass`와 같은 이유·같은 모양이다.
 */
export function cardClass(
  extra = "",
  { tone = "outlined", pad = "normal" }: CardTone = {},
): string {
  const surface = tone === "raised" ? "bg-paper" : "border border-border";
  const padding = pad === "tight" ? "p-3" : pad === "loose" ? "p-6" : "p-4";
  return `rounded-surface ${surface} ${padding} ${extra}`
    .replace(/\s+/g, " ")
    .trim();
}

interface CardTone {
  tone?: "outlined" | "raised";
  /** `loose`는 웹 홈 달력 카드용이다(AC-HOMECAL-112, 24px — 목업 20px을 간격
   * 스케일에 반올림, |20-16|=|20-24|=4로 동점이라 이 스펙의 "동점은 올림" 규칙을 따른다). */
  pad?: "normal" | "tight" | "loose";
}

/**
 * 카드·다이얼로그의 면. 그림자를 쓰지 않으므로 층은 보더와 면의 명도 차이로만 만든다.
 *
 * @param tone `outlined`는 배경 위의 카드라 테두리로 경계를 만든다.
 *   `raised`는 배경막 위에 뜨는 다이얼로그라 **불투명한 면 자체가 경계**이고,
 *   테두리를 더하면 어두운 배경막과 겹쳐 이중선이 된다.
 * @param pad `tight`는 카드 안의 카드(스텝 행)용이다. 같은 여백이면 중첩이 안 읽힌다.
 */
export function Card({
  children,
  tone = "outlined",
  pad = "normal",
  className = "",
  ...rest
}: {
  children: ReactNode;
  tone?: "outlined" | "raised";
  pad?: "normal" | "tight" | "loose";
  className?: string;
} & ComponentPropsWithoutRef<"div">) {
  return (
    <div className={cardClass(className, { tone, pad })} {...rest}>
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
 * 라벨-값 한 줄 — **원장 행**이다.
 *
 * <p>값은 **Mono**로 쓴다 — 자릿수가 정렬돼야 목록에서 값이 흔들리지 않는다.
 *
 * <p>위쪽 1px 선이 행을 나눈다(docs/specs/2026-09-17-screen-reskin.md). 카드 테두리로
 * 항목을 감싸는 대신 선 하나로 나누는 것이 이 디자인의 어휘다 — 여러 항목이 이어질 때
 * 테두리가 겹쳐 두꺼워지지 않는다.
 *
 * @param bare 선을 그리지 않는다. 히어로 안쪽처럼 이미 구분된 자리에서 쓴다.
 */
export function MetricRow({
  label,
  value,
  bare = false,
  tone = "default",
  className = "",
}: {
  label: string;
  value: ReactNode;
  bare?: boolean;
  /** `hero`는 어두운 판 위에서 쓴다 — 판은 모드와 무관하게 어두우므로 글자색도 고정이다. */
  tone?: "default" | "hero";
  className?: string;
}) {
  const onHero = tone === "hero";
  // 히어로 안에서는 행마다 선을 또 그으면 판의 구분선과 겹친다.
  const divider = bare || onHero ? "" : "border-t border-divider py-3";

  return (
    <div
      className={`flex items-center justify-between gap-3 ${divider} ${onHero ? "py-1" : ""} ${className}`
        .replace(/\s+/g, " ")
        .trim()}
    >
      <dt className={onHero ? "text-body-sm text-on-hero-dim" : "text-body-sm text-ink-3"}>
        {label}
      </dt>
      <dd className={onHero ? "text-metric text-on-hero" : "text-metric"}>
        {value}
      </dd>
    </div>
  );
}
