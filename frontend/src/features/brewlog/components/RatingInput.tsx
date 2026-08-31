"use client";

const STARS = [1, 2, 3, 4, 5];

/**
 * 별 다섯 개짜리 별점 입력. **정수만 올린다.**
 *
 * <p>백엔드는 `0.5` 단위를 계속 허용하므로, 나중에 반개 입력을 열려면 이 컴포넌트만 고치면 된다.
 * 읽기 화면은 `4.5` 같은 값도 그대로 표시한다.
 *
 * <p>같은 별을 다시 누르면 해제된다 — 잘못 눌렀을 때 되돌릴 방법이 없으면 저장할 수밖에 없다.
 */
export function RatingInput({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="w-20 text-sm text-neutral-500">별점</span>
      {STARS.map((star) => (
        <button
          key={star}
          type="button"
          aria-label={`별점 ${star}`}
          aria-pressed={value !== null && star <= value}
          onClick={() => onChange(value === star ? null : star)}
          className="px-1 text-xl leading-none"
        >
          <span aria-hidden="true">
            {value !== null && star <= value ? "★" : "☆"}
          </span>
        </button>
      ))}
    </div>
  );
}
