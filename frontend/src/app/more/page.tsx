"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { useRequireSession } from "@/features/auth/useRequireSession";
import { useMe } from "@/features/user/queries";
import { clearRecipeCache } from "@/lib/offline-cache";
import { clearSession } from "@/lib/session";

export default function MorePage() {
  const router = useRouter();
  const { ready, onSessionLost } = useRequireSession();
  const me = useMe(onSessionLost);
  const [loggingOut, setLoggingOut] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyInviteLink(id: number) {
    await navigator.clipboard.writeText(`${window.location.origin}/u/${id}`);
    setCopied(true);
  }

  async function logout() {
    setLoggingOut(true);
    // `/api/auth/logout`은 백엔드가 아니라 Next 라우트 핸들러다. 실패해도 세션을 지우고
    // 나간다 — 로그아웃을 눌렀는데 로그인 상태로 남는 것이 더 나쁘다.
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    // 오프라인 캐시에는 남의 비공개 레시피가 될 수 있는 본문이 들어 있다.
    // 계정이 바뀌기 전에 지운다(docs/specs/2026-09-05-web-pwa.md).
    //
    // clearSession() 안에 넣지 않는다 — 그것은 401을 만났을 때도 불린다
    // (lib/authed-fetch.ts). 토큰이 만료됐을 뿐인데 오프라인 데이터를 날리게 된다.
    await clearRecipeCache();
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
      <dl className="flex flex-col gap-3 border-b border-line pb-5">
        <Row label="닉네임" value={me.data.nickname} />
        {me.data.email !== undefined && (
          <Row label="이메일" value={me.data.email} />
        )}
        <Row label="가입일" value={me.data.createdAt.slice(0, 10)} />
      </dl>

      <div className="flex items-center justify-between gap-3 border-b border-line py-4">
        <div className="min-w-0">
          <p className="font-medium">내 초대 링크</p>
          <p className="truncate text-sm text-muted">
            {`/u/${me.data.id}`}
          </p>
        </div>
        {copied ? (
          <span className="shrink-0 text-sm text-muted">
            복사했습니다
          </span>
        ) : (
          <button
            type="button"
            onClick={() => void copyInviteLink(me.data.id)}
            className="shrink-0 rounded-lg border border-line px-3 py-2"
          >
            복사
          </button>
        )}
      </div>

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
        className="mt-4 w-full rounded-md border border-line py-2.5 text-sm disabled:opacity-50"
      >
        로그아웃
      </button>
    </Shell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-sm text-muted">{label}</dt>
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
