"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { useRequireSession } from "@/features/auth/useRequireSession";
import { RunPanel } from "@/features/admin/components/RunPanel";
import { RunTable } from "@/features/admin/components/RunTable";
import { SourceList } from "@/features/admin/components/SourceList";
import {
  useCrawlRuns,
  useCrawlSources,
  useStartCrawl,
} from "@/features/admin/queries";
import { ApiError } from "@/lib/api-client";

const PATH = "/admin/crawl";
const ALREADY_RUNNING =
  "409 CRAWL_ALREADY_RUNNING — 이 구매처는 이미 수집 중이라 새 실행을 시작하지 않았습니다.";

/** `useSearchParams()`가 CSR bailout을 일으키므로 Next가 요구하는 Suspense 경계를 둔다. */
export default function CrawlPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <CrawlConsole />
    </Suspense>
  );
}

/** 원두 수집 — docs/specs/2026-10-19-admin-crawl-console.md. 권한은 `app/admin/layout.tsx`가 거른다. */
function CrawlConsole() {
  const router = useRouter();
  const params = useSearchParams();
  const { onSessionLost } = useRequireSession();
  // URL은 딥링크 입구다. 이후로는 상태가 진실이고 URL은 따라간다(AC-ADMIN-12).
  const [runId, setRunId] = useState<number | undefined>(() => {
    const raw = Number(params.get("run"));
    return Number.isInteger(raw) && raw > 0 ? raw : undefined;
  });
  const [source, setSource] = useState<string>();
  const [page, setPage] = useState(0);
  const [notice, setNotice] = useState<{ key: string; text: string }>();

  const sources = useCrawlSources(onSessionLost);
  const runs = useCrawlRuns(source, page, onSessionLost);
  const start = useStartCrawl(onSessionLost);

  function select(id: number | undefined) {
    setRunId(id);
    router.replace(id === undefined ? PATH : `${PATH}?run=${id}`);
  }

  function startCrawl(key: string) {
    setNotice(undefined);
    start.mutate(key, {
      onSuccess: (run) => select(run.id),
      onError: async (error) => {
        if (
          !(error instanceof ApiError) ||
          error.code !== "CRAWL_ALREADY_RUNNING"
        )
          return;
        // 버튼이 눌렸다는 것은 목록이 낡았다는 뜻이다 — 다시 읽어 진행 중 실행을 찾는다.
        const fresh = await sources.refetch();
        const last = fresh.data?.find((s) => s.key === key)?.lastRun;
        if (last?.status === "RUNNING") {
          setNotice({
            key,
            text: `${ALREADY_RUNNING} 진행 중인 실행 #${last.id}를 표시합니다.`,
          });
          select(last.id);
        } else {
          setNotice({ key, text: ALREADY_RUNNING });
        }
      },
    });
  }

  if (sources.isPending) return <LoadingState />;
  if (sources.isError)
    return (
      <ErrorState
        error={sources.error}
        onRetry={() => void sources.refetch()}
      />
    );

  return (
    <div className="flex min-w-0 flex-1">
      <main className="flex min-w-0 flex-1 flex-col gap-[26px] px-10 pt-8 pb-12">
        <header className="flex flex-col gap-2">
          <span className="font-mono text-[10.5px] tracking-[0.14em] text-ink-3 uppercase">
            Catalog · Crawl
          </span>
          <h1 className="text-[27px] font-semibold tracking-[-0.03em]">
            원두 수집
          </h1>
          <p className="max-w-[64ch] text-[14.5px] leading-[1.7] text-ink-2">
            구매처를 골라 「수집」을 누르면 서버가 그 사이트의 원두를 읽어
            카탈로그에 바로 넣습니다. 실행 결과의 건너뛴 상품과 매핑하지 못한
            원문이 검수 목록입니다.
          </p>
        </header>
        <SourceList
          sources={sources.data}
          starting={start.isPending ? start.variables : undefined}
          notice={notice}
          onStart={startCrawl}
        />
        {runs.data ? (
          <RunTable
            data={runs.data}
            sources={sources.data}
            source={source}
            selected={runId}
            onSource={(key) => {
              setSource(key);
              setPage(0);
            }}
            onPage={setPage}
            onSelect={select}
          />
        ) : runs.isError ? (
          <ErrorState error={runs.error} onRetry={() => void runs.refetch()} />
        ) : null}
      </main>
      {runId !== undefined && (
        <RunPanel
          id={runId}
          sources={sources.data}
          onClose={() => select(undefined)}
          onSessionLost={onSessionLost}
        />
      )}
    </div>
  );
}
