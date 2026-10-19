import { clock, duration } from "../format";
import type { CrawlSource } from "../schema";
import { useNow } from "../useNow";
import { StatusTag } from "./StatusTag";

export function SourceList({
  sources,
  starting,
  notice,
  onStart,
}: {
  sources: readonly CrawlSource[];
  starting?: string;
  notice?: { key: string; text: string };
  onStart: (key: string) => void;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[16px] font-semibold">구매처</h2>
      <div className="overflow-hidden rounded-[10px] border border-border bg-paper">
        {sources.map((source, i) => (
          <div
            key={source.key}
            className={i > 0 ? "border-t border-divider" : ""}
          >
            <SourceRow
              source={source}
              starting={starting === source.key}
              onStart={() => onStart(source.key)}
            />
            {notice?.key === source.key && (
              <p className="bg-sunken px-5 py-3 text-[13.5px] text-ink-2">
                {notice.text}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function SourceRow({
  source,
  starting,
  onStart,
}: {
  source: CrawlSource;
  starting: boolean;
  onStart: () => void;
}) {
  const last = source.lastRun;
  const running = last?.status === "RUNNING";
  const now = useNow(running);
  return (
    <div
      data-testid={`source-${source.key}`}
      className="grid grid-cols-[150px_1fr_210px_96px] items-center gap-4 px-5 py-4"
    >
      <div className="flex flex-col">
        <span className="text-[14.5px] font-semibold">{source.name}</span>
        <span className="font-mono text-[11px] text-ink-3">{source.key}</span>
      </div>
      <span className="truncate font-mono text-[12px] text-ink-2">
        {source.listUrl}
      </span>
      <div className="flex flex-col items-start gap-1">
        <StatusTag status={last?.status} />
        {last && (
          <span className="font-mono text-[11.5px] text-ink-3">
            {clock(last.startedAt)} · {running ? "경과" : "소요"}{" "}
            {duration(last, now)}
          </span>
        )}
      </div>
      {running ? (
        <div className="flex flex-col items-stretch gap-1">
          <button
            type="button"
            disabled
            className="rounded-[7px] bg-sunken px-4 py-[10px] text-[14px] text-ink-3"
          >
            수집 중
          </button>
          <span className="text-center font-mono text-[10.5px] text-accent">
            {duration(last, now)}
          </span>
        </div>
      ) : (
        <button
          type="button"
          onClick={onStart}
          disabled={starting}
          className="rounded-[7px] bg-ink px-4 py-[10px] text-[14px] font-medium text-on-ink hover:bg-ink-hover disabled:bg-sunken disabled:text-ink-3"
        >
          수집
        </button>
      )}
    </div>
  );
}
