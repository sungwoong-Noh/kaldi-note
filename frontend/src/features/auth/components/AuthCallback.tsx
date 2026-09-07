"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { sessionSchema } from "@/features/auth/schema";
import { setAccessToken } from "@/lib/session";

function CallbackMessage({ message }: { message: string }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6">
      <p className="text-center text-sm">{message}</p>
      <a href="/login" className="text-sm underline">
        로그인으로 돌아가기
      </a>
    </main>
  );
}

/**
 * 인가코드를 BFF에 넘겨 세션을 만들고 원래 가려던 경로로 돌아간다.
 *
 * <p>코드가 없는 경우를 바깥에서 걸러내는 이유: effect 안에서 동기적으로 setState를 부르면 연쇄 렌더가 일어난다. 렌더 시점에 알 수 있는 것은
 * 렌더에서 판정한다.
 */
export function AuthCallback({
  code,
  next,
  provider,
  error,
}: {
  code: string | null;
  next: string;
  provider: "kakao" | "google";
  error: string | null;
}) {
  // 취소는 장애가 아니다. code가 없는 것은 같지만 사용자가 스스로 한 일이다.
  // ★ 이 분기가 !code보다 먼저 와야 한다 — 취소도 code 없이 오므로, 순서가 뒤바뀌면
  //   영영 「인가 코드가 없습니다」가 뜬다.
  if (error) {
    return <CallbackMessage message="로그인을 취소했습니다" />;
  }

  if (!code) {
    return (
      <CallbackMessage message="인가 코드가 없습니다. 다시 로그인해 주세요." />
    );
  }

  return <AuthCallbackExchange code={code} next={next} provider={provider} />;
}

function AuthCallbackExchange({
  code,
  next,
  provider,
}: {
  code: string;
  next: string;
  provider: "kakao" | "google";
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  // StrictMode는 effect를 두 번 실행한다. 인가코드는 1회용이라 두 번째 교환은 반드시 실패한다.
  const exchanged = useRef(false);

  useEffect(() => {
    if (exchanged.current) return;
    exchanged.current = true;

    void (async () => {
      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, provider }),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => null);
          setMessage(body?.message ?? "일시적인 오류가 발생했습니다.");
          return;
        }

        const session = sessionSchema.parse(await response.json());
        // userId는 여기서 들고 있지 않는다. 새로고침하면 사라져 진실 원천이 둘이 된다 —
        // 필요한 화면이 GET /users/me를 부른다(features/user/queries.ts).
        setAccessToken(session.accessToken);
        router.replace(next);
      } catch {
        setMessage("일시적인 오류가 발생했습니다.");
      }
    })();
  }, [code, next, provider, router]);

  if (message) {
    return <CallbackMessage message={message} />;
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <p className="text-sm text-neutral-500">로그인하는 중…</p>
    </main>
  );
}
