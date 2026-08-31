"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ErrorState } from "@/components/ErrorState";
import { useRequireSession } from "@/features/auth/useRequireSession";
import { fetchBrewLogPage } from "@/features/brewlog/api";
import { BrewLogCard } from "@/features/brewlog/components/BrewLogCard";
import { useRecipeTitles } from "@/features/brewlog/useRecipeTitles";

/** 홈에 세우는 최근 기록 수. 스크롤 없이 한눈에 들어오는 만큼만 둔다. */
const RECENT_SIZE = 3;

export default function HomePage() {
  const { ready, onSessionLost } = useRequireSession();

  const recent = useQuery({
    queryKey: ["brew-logs", "recent", RECENT_SIZE],
    queryFn: () => fetchBrewLogPage(0, RECENT_SIZE, onSessionLost),
    enabled: ready,
  });

  const logs = recent.data?.content ?? [];
  const titles = useRecipeTitles(logs, ready, onSessionLost);

  if (!ready || recent.isPending) {
    return <Shell>{null}</Shell>;
  }

  if (recent.error) {
    return (
      <Shell>
        <ErrorState error={recent.error} onRetry={() => void recent.refetch()} />
      </Shell>
    );
  }

  if (logs.length === 0) {
    return (
      <Shell>
        <p className="py-8 text-center text-sm text-neutral-500">
          아직 기록이 없습니다
        </p>
        <Link
          href="/recipes"
          className="block rounded-md bg-neutral-900 py-2.5 text-center text-sm text-white dark:bg-white dark:text-neutral-900"
        >
          레시피 보러 가기
        </Link>
      </Shell>
    );
  }

  return (
    <Shell>
      <ul className="flex flex-col gap-3">
        {logs.map((log) => (
          <BrewLogCard
            key={log.id}
            log={log}
            recipeTitle={titles.get(log.recipeId)}
          />
        ))}
      </ul>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">최근 기록</h1>
        <Link href="/brews" className="text-sm text-neutral-500">
          전체 보기
        </Link>
      </div>
      {children}
    </main>
  );
}
