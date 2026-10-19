import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api-client";
import {
  clock,
  duration,
  groupSkipped,
  groupUnmapped,
  hasTotals,
  observation,
} from "../format";
import { useCrawlRun } from "../queries";
import type { CrawlRun, CrawlSource } from "../schema";
import { useNow } from "../useNow";
import { StatusTag } from "./StatusTag";

const FOLD = 5;

/**
 * 실행 상세. ≥1280px에서는 본문 오른쪽 420px 열, 그 아래에서는 오른쪽에 붙는 오버레이다
 * (목업 「1280px 미만 동작」, AC-ADMIN-41).
 */
export function RunPanel({
  id,
  sources,
  onClose,
  onSessionLost,
}: {
  id: number;
  sources: readonly CrawlSource[];
  onClose: () => void;
  onSessionLost: () => void;
}) {
  const run = useCrawlRun(id, onSessionLost);
  useRefreshListsWhenDone(run.data);

  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className="fixed inset-0 z-10 bg-ink/30 min-[1280px]:hidden"
      />
      <aside
        data-testid="run-panel"
        className="z-20 flex w-[420px] max-w-full shrink-0 flex-col overflow-y-auto border-l border-border bg-paper max-[1279px]:fixed max-[1279px]:inset-y-0 max-[1279px]:right-0"
      >
        <div className="flex justify-end px-6 pt-5">
          <button
            type="button"
            onClick={onClose}
            className="border-b border-border text-[13px] text-ink-2"
          >
            닫기
          </button>
        </div>
        {run.data ? (
          <Detail
            run={run.data}
            name={
              sources.find((s) => s.key === run.data.source)?.name ??
              run.data.source
            }
          />
        ) : run.error instanceof ApiError && run.error.status === 404 ? (
          <p className="px-6 py-5 text-body text-ink-2">
            실행 #{id}을 찾지 못했습니다.
          </p>
        ) : run.isError ? (
          <p className="px-6 py-5 text-body text-ink-2">
            실행을 불러오지 못했습니다.
          </p>
        ) : null}
      </aside>
    </>
  );
}

/** RUNNING이 끝나는 순간 구매처·이력을 다시 읽는다 — 버튼이 풀리고 집계가 채워진다(AC-ADMIN-04). */
function useRefreshListsWhenDone(run?: CrawlRun) {
  const client = useQueryClient();
  const previous = useRef<CrawlRun["status"]>(undefined);
  useEffect(() => {
    if (!run) return;
    if (previous.current === "RUNNING" && run.status !== "RUNNING") {
      void client.invalidateQueries({ queryKey: ["admin", "crawl-sources"] });
      void client.invalidateQueries({ queryKey: ["admin", "crawl-runs"] });
    }
    previous.current = run.status;
  }, [client, run]);
}

function Detail({ run, name }: { run: CrawlRun; name: string }) {
  const running = run.status === "RUNNING";
  const now = useNow(running);
  const totals = hasTotals(run);
  const sk = run.skipped.length;
  const un = run.unmapped.length;
  const showLists = run.status === "SUCCEEDED";

  return (
    <div className="flex flex-col gap-5 px-6 pt-2 pb-8">
      <header className="flex flex-col gap-2">
        <span className="font-mono text-[10.5px] tracking-[0.14em] text-ink-3">
          Run #{run.id} · {run.source}
        </span>
        <h2 className="text-[20px] font-semibold">{name}</h2>
        <div>
          <StatusTag status={run.status} />
        </div>
      </header>

      <dl className="grid grid-cols-3 gap-3">
        <Stat label="시작" value={clock(run.startedAt)} />
        <Stat
          label="종료"
          testId="run-end"
          value={
            run.finishedAt && run.status !== "INTERRUPTED"
              ? clock(run.finishedAt)
              : "—"
          }
        />
        <Stat
          label={running ? "경과" : "소요"}
          testId="run-duration"
          value={duration(run, now)}
        />
      </dl>

      <div className="flex flex-col gap-1">
        <span className="font-mono text-[36px] font-medium tracking-[-0.04em]">
          {running ? "진행 중" : totals ? `생성 ${run.created}` : "생성 —"}
        </span>
        <span className="font-mono text-[13px] text-ink-2">
          {totals
            ? `갱신 ${run.updated} · 건너뜀 ${sk} · 미매핑 ${un}`
            : "갱신 — · 건너뜀 — · 미매핑 —"}
        </span>
      </div>

      <p className="text-[14px] leading-[1.7] text-ink-2">{observation(run)}</p>

      {run.status === "FAILED" && run.errorMessage && (
        <pre
          data-testid="error-message"
          className="rounded-[7px] bg-sunken px-4 py-3 font-mono text-[12.5px] whitespace-pre-wrap"
        >
          {run.errorMessage}
        </pre>
      )}

      {showLists && sk > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="text-[16px] font-semibold">건너뛴 상품</h3>
          {groupSkipped(run.skipped).map((g) => (
            <div key={g.code} className="flex flex-col gap-1">
              <GroupHead testId="skip-group" {...g} count={g.items.length} />
              {g.items.map((item, i) => (
                <span key={i} className="text-[12.5px] break-all text-ink-2">
                  {item.name}
                </span>
              ))}
            </div>
          ))}
        </section>
      )}

      {showLists && un > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="text-[16px] font-semibold">매핑하지 못한 원문</h3>
          {groupUnmapped(run.unmapped).map((g) => (
            <UnmappedGroup key={g.code} {...g} />
          ))}
        </section>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="font-mono text-[10.5px] tracking-[0.1em] text-ink-3">
        {label}
      </dt>
      <dd data-testid={testId} className="font-mono text-[13.5px]">
        {value}
      </dd>
    </div>
  );
}

function GroupHead({
  code,
  label,
  count,
  testId,
}: {
  code: string;
  label: string;
  count: number;
  testId: string;
}) {
  return (
    <div data-testid={testId} className="flex items-baseline gap-2">
      <span className="font-mono text-[11px] text-ink-3">{code}</span>
      <span className="text-[13.5px] font-semibold">{label}</span>
      <span className="ml-auto font-mono text-[12px] text-ink-3">
        {count}건
      </span>
    </div>
  );
}

function UnmappedGroup({
  code,
  label,
  items,
}: {
  code: string;
  label: string;
  items: CrawlRun["unmapped"];
}) {
  const [open, setOpen] = useState(false);
  const shown = open ? items : items.slice(0, FOLD);
  return (
    <div
      data-testid="unmapped-group"
      data-field={code}
      className="flex flex-col gap-2"
    >
      <GroupHead
        testId="unmapped-head"
        code={code}
        label={label}
        count={items.length}
      />
      {shown.map((item, i) => (
        <div key={i} className="flex flex-col">
          <span
            data-testid="raw"
            className="self-start bg-accent-wash text-[14px] font-semibold"
          >
            “{item.raw}”
          </span>
          <span className="text-[12px] break-all text-ink-3">{item.name}</span>
        </div>
      ))}
      {!open && items.length > FOLD && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="self-start border-b border-border text-[13px] text-ink-2"
        >
          나머지 {items.length - FOLD}건 보기
        </button>
      )}
    </div>
  );
}
