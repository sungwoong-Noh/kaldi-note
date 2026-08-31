import type { BrewLog } from "../schema";

/**
 * 추출 분석. **`tdsPercent`가 있을 때만 그린다.**
 *
 * <p>TDS 없이도 앱이 온전히 동작해야 한다(「뒤집으면 안 되는 결정」 4번). 리프랙토미터가 없는 것이 기본 상황이라,
 * 빈 분석 영역을 세워두면 측정하지 않은 것이 결함처럼 보인다.
 *
 * <p><b>`diagnosis`의 존재로 판단하지 않는다.</b> TDS가 없어도 서버는 "계산할 수 없다"는 안내를 `diagnosis`로 보내준다.
 */
export function ExtractionSummary({ log }: { log: BrewLog }) {
  if (log.tdsPercent === undefined) return null;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-base font-semibold">추출 분석</h2>
      <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <div className="flex items-center gap-1">
          <dt className="text-neutral-500">TDS</dt>
          <dd>{log.tdsPercent} %</dd>
        </div>
        {log.extractionYieldPercent !== undefined && (
          <div className="flex items-center gap-1">
            <dt className="text-neutral-500">수율</dt>
            <dd>{log.extractionYieldPercent} %</dd>
          </div>
        )}
        {log.strengthZone !== undefined && (
          <div className="flex items-center gap-1">
            <dt className="text-neutral-500">농도</dt>
            <dd>{log.strengthZone}</dd>
          </div>
        )}
        {log.extractionZone !== undefined && (
          <div className="flex items-center gap-1">
            <dt className="text-neutral-500">추출</dt>
            <dd>{log.extractionZone}</dd>
          </div>
        )}
      </dl>
      {log.diagnosis !== undefined && (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {log.diagnosis}
        </p>
      )}
    </section>
  );
}
