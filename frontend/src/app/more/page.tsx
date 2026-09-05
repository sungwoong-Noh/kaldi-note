"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { useRequireSession } from "@/features/auth/useRequireSession";
import { useMe } from "@/features/user/queries";
import { clearSession } from "@/lib/session";

export default function MorePage() {
  const router = useRouter();
  const { ready, onSessionLost } = useRequireSession();
  const me = useMe(onSessionLost);
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    // `/api/auth/logout`은 백엔드가 아니라 Next 라우트 핸들러다. 실패해도 세션을 지우고
    // 나간다 — 로그아웃을 눌렀는데 로그인 상태로 남는 것이 더 나쁘다.
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    clearSession();
    router.push("/");
  }

  if (!ready || me.isPending) {
    return (
      <Shell>
        <LoadingState />
      </Shell>
    );
  }

  if (me.error) {
    return (
      <Shell>
        <ErrorState error={me.error} onRetry={() => void me.refetch()} />
      </Shell>
    );
  }

  return (
    <Shell>
      <dl className="flex flex-col gap-3 border-b border-neutral-200 pb-5 dark:border-neutral-800">
        <Row label="닉네임" value={me.data.nickname} />
        {me.data.email !== undefined && (
          <Row label="이메일" value={me.data.email} />
        )}
        <Row label="가입일" value={me.data.createdAt.slice(0, 10)} />
      </dl>

      <ul className="flex flex-col py-2">
        <li>
          <Link
            href="/gear/grind-converter"
            className="block py-3 text-sm underline-offset-4 hover:underline"
          >
            분쇄도 환산기
          </Link>
        </li>
      </ul>

      <button
        type="button"
        onClick={() => void logout()}
        disabled={loggingOut}
        className="mt-4 w-full rounded-md border border-neutral-300 py-2.5 text-sm disabled:opacity-50 dark:border-neutral-700"
      >
        로그아웃
      </button>
    </Shell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-sm text-neutral-500">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-xl font-semibold">더보기</h1>
      {children}
    </main>
  );
}
