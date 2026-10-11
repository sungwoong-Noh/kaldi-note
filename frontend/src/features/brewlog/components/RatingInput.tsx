"use client";

const STARS = [1, 2, 3, 4, 5];

/**
 * 별 다섯 개짜리 별점 입력. **정수만 올린다.**
 *
 * <p>백엔드는 `0.5` 단위를 계속 허용하므로, 나중에 반개 입력을 열려면 이 컴포넌트만 고치면 된다.
 * 읽기 화면은 `4.5` 같은 값도 그대로 표시한다.
 *
 * <p>같은 별을 다시 누르면 해제된다 — 잘못 눌렀을 때 되돌릴 방법이 없으면 저장할 수밖에 없다.
 *
 * <p>시안 `.stars` — 웹 22px, 모바일 원장 행 안 18px. 보이는 칸은 작고 누르는 영역은 `hit-44`다.
 */
export function RatingInput({
  value,
  onChange,
  compact = false,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  compact?: boolean;
}) {
  return (
    <div className="flex items-center gap-[6px]">
      {STARS.map((star) => {
        const on = value !== null && star <= value;
        return (
          <button
            key={star}
            type="button"
            aria-label={`별점 ${star}`}
            aria-pressed={on}
            onClick={() => onChange(value === star ? null : star)}
            className={`hit-44 inline-flex shrink-0 items-center justify-center leading-none ${
              compact ? "size-[22px] text-[18px]" : "size-[28px] text-[22px]"
            } ${on ? "text-accent" : "text-divider-strong"}`}
          >
            <span aria-hidden="true">★</span>
          </button>
        );
      })}
    </div>
  );
}
