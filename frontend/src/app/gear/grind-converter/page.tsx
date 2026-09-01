"use client";

import { ErrorState } from "@/components/ErrorState";
import { useRequireSession } from "@/features/auth/useRequireSession";
import { GrindConverter } from "@/features/gear/components/GrindConverter";
import { useGrinders } from "@/features/gear/queries";

export default function GrindConverterPage() {
  const { ready, onSessionLost } = useRequireSession();
  const grinders = useGrinders(onSessionLost);

  if (!ready || grinders.isPending) {
    return <Shell>{null}</Shell>;
  }

  if (grinders.error) {
    return (
      <Shell>
        <ErrorState error={grinders.error} onRetry={() => void grinders.refetch()} />
      </Shell>
    );
  }

  return (
    <Shell>
      <GrindConverter grinders={grinders.data} onSessionLost={onSessionLost} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-xl font-semibold">분쇄도 환산기</h1>
      {children}
    </main>
  );
}
