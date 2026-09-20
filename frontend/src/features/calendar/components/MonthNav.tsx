import { brewCountLabel } from "../brewCountLabel";
import { kstMonthOf, kstToday } from "@/lib/kstDate";
import { Button } from "@/components/ui";

/**
 * 월 헤더. 미래 달로는 넘어가지 않는다 — 이번 달에서 다음 달 버튼이 비활성이다
 * (docs/specs/2026-09-19-home-calendar.md).
 */
export function MonthNav({
  month,
  totalCount,
  ownerNickname,
  onPrev,
  onNext,
}: {
  month: string;
  totalCount: number;
  /** 남의 달력일 때만 준다. 없으면 내 달력이다. */
  ownerNickname?: string;
  onPrev: () => void;
  onNext: () => void;
}) {
  const isCurrentMonth = month === kstMonthOf(kstToday());
  const label = ownerNickname
    ? `${ownerNickname} · ${brewCountLabel(totalCount)}`
    : brewCountLabel(totalCount);
  const [year, mon] = month.split("-");

  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-card-title font-mono font-medium tracking-[-0.03em]">
          {year}.{mon}
        </p>
        <p className="text-label text-ink-3">{label}</p>
      </div>
      <div className="flex gap-2">
        <Button aria-label="이전 달" onClick={onPrev}>
          ‹
        </Button>
        <Button aria-label="다음 달" onClick={onNext} disabled={isCurrentMonth}>
          ›
        </Button>
      </div>
    </div>
  );
}
