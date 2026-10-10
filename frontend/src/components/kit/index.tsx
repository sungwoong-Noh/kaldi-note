"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { RoastLevel } from "@/features/catalog/schema";
import { RoastDot } from "@/components/ui";

/**
 * 공용 부품 키트 — 목업 CSS 값 그대로(docs/decisions/0010).
 *
 * <p>값의 출처는 `docs/design/kaldi-note-design/screens/02 Recipes and Cups - Mobile·Web`(RM1·RM3·BM1·BW1)과
 * `system/Design System.dc.html`이다. 크기·간격·모서리는 목업 px를 그대로 옮겼고, **색만 가장 가까운 토큰**으로
 * 맞췄다(예: 목업 `0.87 0.008 75` 테두리 → `border` 0.88). 웹 값은 `min-[1100px]:`로 덧붙인다.
 *
 * <p>보이는 크기가 44px보다 작은 컨트롤(세그먼트·알약)은 `hit-44`로 누르는 영역만 넓힌다.
 */

function cx(...classes: (string | false | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

/** eyebrow(mono 대문자) + 제목 + 오른쪽 자리(아바타 등). RM1 · BW1. */
export function PageHeader({
  eyebrow,
  title,
  aside,
}: {
  eyebrow: string;
  title: string;
  aside?: ReactNode;
}) {
  return (
    <header className="flex items-start justify-between">
      <div className="flex flex-col gap-[3px] min-[1100px]:gap-[5px]">
        <span className="font-mono text-[10px] tracking-[0.16em] text-ink-3 uppercase min-[1100px]:text-[10.5px]">
          {eyebrow}
        </span>
        <h1 className="text-[27px] leading-[1.1] font-semibold tracking-[-0.03em] text-ink min-[1100px]:text-[30px] min-[1100px]:tracking-[-0.025em]">
          {title}
        </h1>
      </div>
      {aside}
    </header>
  );
}

/** sunken 트랙 위의 세그먼트. 활성 칸만 종이색 면이 뜬다. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange?: (value: T) => void;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex gap-[3px] rounded-[8px] bg-sunken p-[3px]"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange?.(option.value)}
            className={cx(
              "hit-44 flex-1 rounded-[6px] border py-[9px] text-center text-[13.5px]",
              active
                ? "border-border bg-paper font-medium text-ink"
                : "border-transparent text-ink-3",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** 알약 필터. 개수가 있으면 라벨 뒤에 붙는다(`전체 7`). */
export function PillFilter<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string; count?: number }[];
  value: T;
  onChange?: (value: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex gap-[7px] min-[1100px]:gap-[10px]">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange?.(option.value)}
            className={cx(
              "hit-44 rounded-full border px-[13px] py-[7px] text-[12.5px] whitespace-nowrap min-[1100px]:px-[14px] min-[1100px]:py-[8px] min-[1100px]:text-[13px]",
              active
                ? "border-ink bg-ink text-on-ink"
                : "border-border text-ink-2",
            )}
          >
            {option.label}
            {option.count !== undefined && ` ${option.count}`}
          </button>
        );
      })}
    </div>
  );
}

/** 2줄 원장 행. BM1 — 배전도 점 · 제목/값 · 보조줄/강조값. */
export function LedgerRow({
  roastLevel,
  title,
  value,
  meta,
  accent,
}: {
  roastLevel?: RoastLevel;
  title: string;
  value: string;
  meta: string;
  accent?: string;
}) {
  return (
    <div className="flex items-start gap-[13px] border-t border-divider-strong py-[15px]">
      {/* 점이 없어도 10px 자리를 남긴다 — 제목의 왼쪽 선이 행마다 같아야 한다. */}
      <span data-ledger-dot className="mt-[5px] flex size-[10px] shrink-0">
        <RoastDot roastLevel={roastLevel} size={10} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-[10px]">
          <span className="truncate text-[15px] font-medium text-ink">{title}</span>
          <span className="shrink-0 font-mono text-[14px] font-medium text-ink">{value}</span>
        </div>
        <div className="mt-[5px] flex justify-between gap-[10px] font-mono text-[11.5px]">
          <span className="text-ink-3">{meta}</span>
          {accent !== undefined && (
            <span data-ledger-accent className="shrink-0 text-accent">
              {accent}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 통계 타일. BM1(모바일) — 값 Mono 22px · 패딩 14/16. BW1(웹, `web`) — 값 24px · 패딩 18/20.
 * `prose`면 값이 Sans 15px다(즐겨 쓴 레시피처럼 글인 값).
 */
export function StatTile({
  label,
  value,
  web = false,
  prose = false,
}: {
  label: string;
  value: string;
  web?: boolean;
  prose?: boolean;
}) {
  return (
    <div
      className={cx(
        "flex-1 rounded-[10px] border border-divider bg-surface",
        web ? "px-[20px] py-[18px]" : "px-[16px] py-[14px]",
      )}
    >
      <div data-stat-label className="font-mono text-[9.5px] tracking-[0.1em] text-ink-3 uppercase">
        {label}
      </div>
      <div
        className={cx(
          "text-ink",
          prose
            ? "mt-[8px] text-[15px] font-medium"
            : cx("font-mono font-medium", web ? "mt-[6px] text-[24px]" : "mt-[5px] text-[22px]"),
        )}
      >
        {value}
      </div>
    </div>
  );
}

/** HOT/ICE 칩. */
export function TempChip({ children }: { children: string }) {
  return (
    <span className="rounded-[3px] bg-ink px-[9px] py-[5px] font-mono text-[10.5px] tracking-[0.08em] text-on-ink">
      {children}
    </span>
  );
}

/** 배전도 점 + 라벨. */
export function RoastLabel({ roastLevel, label }: { roastLevel: RoastLevel; label: string }) {
  return (
    <span className="flex items-center gap-[6px]">
      <RoastDot roastLevel={roastLevel} />
      <span className="text-[12.5px] text-ink-2">{label}</span>
    </span>
  );
}

/** 작은 mono 태그. `accent`면 내가 만든 것(accent-wash). */
export function Tag({ children, accent = false }: { children: string; accent?: boolean }) {
  return (
    <span
      className={cx(
        "inline-block rounded-[3px] px-[8px] py-[4px] font-mono text-[10px] tracking-[0.08em]",
        accent ? "bg-accent-wash text-accent" : "bg-sunken text-ink-2",
      )}
    >
      {children}
    </span>
  );
}

/** 레시피 카드. RM1 — 제목 · 원두량 + 온도·배전도 · 구분선 아래 출처. */
export function RecipeCardKit({
  title,
  dose,
  temp,
  roast,
  footer,
}: {
  title: string;
  dose: string;
  temp: string;
  roast: { level: RoastLevel; label: string };
  footer: ReactNode;
}) {
  return (
    <article className="flex flex-col gap-[13px] rounded-[12px] border border-border px-[18px] py-[17px]">
      <h3 className="text-[17px] font-semibold tracking-[-0.015em] text-ink">{title}</h3>
      <div className="flex items-end justify-between gap-[12px]">
        <span className="font-mono text-[36px] leading-none font-medium tracking-[-0.04em] text-ink">
          {dose}
        </span>
        <span className="flex items-center gap-[9px]">
          <TempChip>{temp}</TempChip>
          <RoastLabel roastLevel={roast.level} label={roast.label} />
        </span>
      </div>
      <div className="flex items-center gap-[9px] border-t border-sunken pt-[12px]">{footer}</div>
    </article>
  );
}

/** 하단 전폭 CTA. 높이 52(15px 패딩 + 22 행). `href`가 있으면 링크로 그린다. */
export function BottomCta({
  children,
  onClick,
  href,
}: {
  children: string;
  onClick?: () => void;
  href?: string;
}) {
  const className =
    "block w-full rounded-[8px] bg-ink p-[15px] text-center text-[15px] font-medium text-on-ink";
  if (href !== undefined) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  );
}

/** 바텀시트 면. RM3 — 손잡이 · 제목/보조 액션 · 내용. 위치(fixed·딤)는 쓰는 쪽이 정한다. */
export function BottomSheet({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      role="dialog"
      aria-label={title}
      className="flex flex-col gap-[20px] rounded-t-[18px] border-t border-border bg-paper px-[24px] pt-[14px] pb-[14px] shadow-[0_-1px_0_var(--border)]"
    >
      <div className="flex justify-center">
        <span className="h-[4px] w-[40px] rounded-full bg-border" />
      </div>
      <div className="flex items-baseline justify-between">
        <h2 className="text-[19px] font-semibold tracking-[-0.02em] text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** 바텀시트 안의 소제목(mono 대문자). */
export function SheetLabel({ children }: { children: string }) {
  return (
    <span className="font-mono text-[10px] tracking-[0.12em] text-ink-3 uppercase">{children}</span>
  );
}
