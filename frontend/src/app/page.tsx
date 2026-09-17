"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { useRequireSession } from "@/features/auth/useRequireSession";
import { fetchBrewLogPage } from "@/features/brewlog/api";
import { BrewLogCard } from "@/features/brewlog/components/BrewLogCard";
import { useRecipeLabels } from "@/features/brewlog/useRecipeLabels";
import { ButtonLink, Shell } from "@/components/ui";

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
  const labels = useRecipeLabels(logs, ready, onSessionLost);

  if (!ready || recent.isPending) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  if (recent.error) {
    return (
      <Screen>
        <ErrorState
          error={recent.error}
          onRetry={() => void recent.refetch()}
        />
      </Screen>
    );
  }

  if (logs.length === 0) {
    return (
      <Screen>
        {/* 빈 화면은 다음 행동을 제안한다 — docs/specs/2026-09-15-structure.md */}
        <div data-empty className="flex flex-col gap-3">
          <p className="py-6 text-center text-body text-ink-3">
            아직 기록이 없습니다
          </p>
          <ButtonLink href="/recipes" variant="primary">
            레시피 보러 가기
          </ButtonLink>
        </div>
      </Screen>
    );
  }

  return (
    <Screen>
      <ul className="flex flex-col gap-3">
        {logs.map((log) => (
          <BrewLogCard
            key={log.id}
            log={log}
            recipeLabel={labels.get(log.recipeId) ?? ""}
          />
        ))}
      </ul>
    </Screen>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <Shell>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-page-title font-semibold">최근 기록</h1>
        <Link
          href="/brews"
          className="inline-flex min-h-11 min-w-11 items-center justify-center text-body text-ink-3"
        >
          전체 보기
        </Link>
      </div>
      {children}
    </Shell>
  );
}
