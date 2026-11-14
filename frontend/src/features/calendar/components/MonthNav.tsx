import { brewCountLabel } from "../brewCountLabel";
import { kstMonthOf, kstToday } from "@/lib/kstDate";

/**
 * 월 헤더. 미래 달로는 넘어가지 않는다 — 이번 달에서 다음 달 버튼이 비활성이다
 * (docs/specs/2026-09-19-home-calendar.md).
 *
 * <p>월과 건수는 한 줄이고, 이동 버튼은 32px 한 겹이다 — 공용 `Button`은 44px 박스에 자기 테두리가
 * 있어 안에 상자를 또 그리면 이중 박스가 된다(#172). 누르는 영역은 `hit-44`가 채운다
 * (docs/specs/2026-10-11-home-fidelity.md AC-HOMEFIT-05·06).
 */
const NAV_BUTTON =
  "hit-44 flex size-8 shrink-0 items-center justify-center rounded-control border border-border font-mono text-[14px] text-ink-2 disabled:text-ink-disabled";
export function MonthNav({
  month,
  totalCount,
  activeDays,
  ownerNickname,
  showCount = true,
  onPrev,
  onNext,
}: {
  month: string;
  totalCount: number;
  /** 기록이 있는 날 수(`days.length`). 주어지면 `N일 · M잔`으로 묶어 표시한다. */
  activeDays?: number;
  /** 남의 달력일 때만 준다. 없으면 내 달력이다. */
  ownerNickname?: string;
  /** 모바일 F2 월 헤더는 건수 라벨을 생략한다(AC-HOMECAL-40). */
  showCount?: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  const isCurrentMonth = month === kstMonthOf(kstToday());
  const label = ownerNickname
    ? `${ownerNickname} · ${brewCountLabel(totalCount)}`
    : brewCountLabel(totalCount, activeDays);
  const [year, mon] = month.split("-");

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <p className="text-month-label">
          {year}.{mon}
        </p>
        {showCount && (
          <p className="text-label whitespace-nowrap text-ink-3">{label}</p>
        )}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          aria-label="이전 달"
          onClick={onPrev}
          className={NAV_BUTTON}
        >
          ‹
        </button>
        <button
          type="button"
          aria-label="다음 달"
          onClick={onNext}
          disabled={isCurrentMonth}
          className={NAV_BUTTON}
        >
          ›
        </button>
      </div>
    </div>
  );
}
