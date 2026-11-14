/**
 * 시안 A4 오늘 홈 로딩 뼈대.
 *
 * <p>300ms 이상 기다릴 때만 렌더되며, 깜빡이는 shimmer 없이 고정 톤(`bg-sunken`)을 유지한다
 * (`AC-QUICKBREW-65`). `role="status"`·`aria-label="불러오는 중"`으로 스크린리더에 알린다.
 */
export function TodaySkeleton() {
  return (
    <div
      data-today-skeleton
      role="status"
      aria-label="불러오는 중"
      aria-busy="true"
      className="mx-auto grid w-full max-w-[1080px] grid-cols-1 gap-[16px] min-[1100px]:grid-cols-[minmax(0,1fr)_300px] min-[1100px]:gap-x-[40px] min-[1100px]:gap-y-[20px]"
    >
      <div
        aria-hidden="true"
        className="flex flex-col gap-[8px] min-[1100px]:col-start-1 min-[1100px]:row-start-1"
      >
        <div className="h-[11px] w-[110px] rounded-[3px] bg-sunken" />
        <div className="h-[30px] w-[240px] rounded-[3px] bg-sunken" />
      </div>

      <div
        aria-hidden="true"
        className="h-[76px] w-full rounded-[14px] bg-sunken min-[1100px]:hidden"
      />

      <div
        aria-hidden="true"
        className="flex flex-col gap-[12px] rounded-[12px] border border-divider bg-surface p-[18px] min-[1100px]:col-start-1 min-[1100px]:row-start-2 min-[1100px]:p-[24px]"
      >
        <div className="h-[11px] w-[90px] rounded-[3px] bg-sunken" />
        <div className="h-[17px] w-[190px] rounded-[3px] bg-sunken" />
        <div className="h-[34px] w-[220px] rounded-[3px] bg-sunken" />
        <div className="h-[48px] w-full rounded-[8px] bg-sunken" />
      </div>

      <div
        aria-hidden="true"
        className="hidden flex-col gap-[14px] min-[1100px]:col-start-2 min-[1100px]:row-span-2 min-[1100px]:row-start-2 min-[1100px]:flex"
      >
        <div className="h-[88px] w-full rounded-[12px] border border-divider bg-surface p-[18px]" />
      </div>

      <div
        aria-hidden="true"
        className="min-[1100px]:col-start-1 min-[1100px]:row-start-3"
      >
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="flex justify-between border-t border-divider py-[14px]"
          >
            <div className="flex flex-col gap-[7px]">
              <div className="h-[15px] w-[150px] rounded-[3px] bg-sunken" />
              <div className="h-[11px] w-[110px] rounded-[3px] bg-sunken" />
            </div>
            <div className="h-[15px] w-[44px] rounded-[3px] bg-sunken" />
          </div>
        ))}
      </div>
    </div>
  );
}
