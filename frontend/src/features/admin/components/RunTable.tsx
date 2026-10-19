import { clock, duration, hasTotals } from "../format";
import type { CrawlRun, CrawlRunPage, CrawlSource } from "../schema";
import { StatusTag } from "./StatusTag";

const COLS =
  "grid grid-cols-[44px_108px_1fr_108px_52px_44px_44px_52px_52px] items-center gap-3 px-5";

export function RunTable({
  data,
  sources,
  source,
  selected,
  onSource,
  onPage,
  onSelect,
}: {
  data: CrawlRunPage;
  sources: readonly CrawlSource[];
  source?: string;
  selected?: number;
  onSource: (key?: string) => void;
  onPage: (page: number) => void;
  onSelect: (id: number) => void;
}) {
  const nameOf = (key: string) =>
    sources.find((s) => s.key === key)?.name ?? key;
  const from = data.page * data.size + 1;
  const to = data.page * data.size + data.content.length;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-baseline gap-2 text-[16px] font-semibold">
          실행 이력
          <span className="font-mono text-[12px] font-normal text-ink-3">
            {data.totalElements}건 · 최신순
          </span>
        </h2>
        <div className="flex gap-2">
          <Pill active={!source} onClick={() => onSource(undefined)}>
            전체
          </Pill>
          {sources.map((s) => (
            <Pill
              key={s.key}
              active={source === s.key}
              onClick={() => onSource(s.key)}
            >
              {s.name}
            </Pill>
          ))}
        </div>
      </div>

      {data.content.length === 0 ? (
        <div className="flex flex-col gap-1 rounded-[10px] border border-border bg-paper px-5 py-8 text-center">
          <p className="text-[14.5px] font-semibold">
            아직 실행 이력이 없습니다.
          </p>
          <p className="text-[13.5px] text-ink-2">
            위에서 구매처를 골라 「수집」을 누르면 첫 실행이 여기 쌓입니다.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[10px] border border-border bg-paper">
          <div
            className={`${COLS} bg-surface py-[10px] font-mono text-[10px] tracking-[0.1em] text-ink-3 uppercase`}
          >
            <span>#</span>
            <span>시작</span>
            <span>소스</span>
            <span>상태</span>
            <span>소요</span>
            <span className="text-right">생성</span>
            <span className="text-right">갱신</span>
            <span className="text-right">건너뜀</span>
            <span className="text-right">미매핑</span>
          </div>
          {data.content.map((run) => (
            <Row
              key={run.id}
              run={run}
              name={nameOf(run.source)}
              selected={run.id === selected}
              onClick={() => onSelect(run.id)}
            />
          ))}
          <div className="flex items-center justify-between border-t border-divider px-5 py-3">
            <span className="font-mono text-[12px] text-ink-3">
              {from}–{to} / {data.totalElements}
            </span>
            <div className="flex gap-4 text-[13px]">
              <button
                type="button"
                disabled={data.page === 0}
                onClick={() => onPage(data.page - 1)}
                className="text-ink-2 disabled:text-ink-3"
              >
                ← 이전
              </button>
              <button
                type="button"
                disabled={!data.hasNext}
                onClick={() => onPage(data.page + 1)}
                className="text-ink-2 disabled:text-ink-3"
              >
                다음 →
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Row({
  run,
  name,
  selected,
  onClick,
}: {
  run: CrawlRun;
  name: string;
  selected: boolean;
  onClick: () => void;
}) {
  const totals = hasTotals(run);
  const counts = [
    run.created,
    run.updated,
    run.skipped.length,
    run.unmapped.length,
  ];
  return (
    <button
      type="button"
      data-testid={`run-row-${run.id}`}
      onClick={onClick}
      className={`${COLS} w-full border-t border-divider py-3 text-left text-[13.5px] ${selected ? "bg-sunken" : "hover:bg-surface"}`}
    >
      <span className="font-mono text-ink-3">{run.id}</span>
      <span className="font-mono">{clock(run.startedAt)}</span>
      <span className="truncate">{name}</span>
      <span>
        <StatusTag status={run.status} />
      </span>
      <span data-testid="run-duration" className="font-mono">
        {run.status === "RUNNING" ? "—" : duration(run)}
      </span>
      {counts.map((n, i) => (
        <span
          key={i}
          data-testid="count"
          className={`text-right font-mono ${!totals || n === 0 ? "text-ink-3" : ""} ${totals && i === 3 && n >= 40 ? "font-semibold" : ""}`}
        >
          {totals ? n : "—"}
        </span>
      ))}
    </button>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full border px-3 py-[5px] text-[12.5px] ${active ? "border-ink bg-ink text-on-ink" : "border-border text-ink-2"}`}
    >
      {children}
    </button>
  );
}
