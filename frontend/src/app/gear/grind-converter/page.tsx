"use client";

import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { useRequireSession } from "@/features/auth/useRequireSession";
import { GrindConverter } from "@/features/gear/components/GrindConverter";
import { useGrinders } from "@/features/gear/queries";
import { Shell } from "@/components/ui";

export default function GrindConverterPage() {
  const { ready, onSessionLost } = useRequireSession();
  const grinders = useGrinders(onSessionLost);

  if (!ready || grinders.isPending) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  if (grinders.error) {
    return (
      <Screen>
        <ErrorState
          error={grinders.error}
          onRetry={() => void grinders.refetch()}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <GrindConverter grinders={grinders.data} onSessionLost={onSessionLost} />
    </Screen>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <Shell>
      <h1 className="mb-4 text-page-title font-semibold">분쇄도 환산기</h1>
      {children}
    </Shell>
  );
}
