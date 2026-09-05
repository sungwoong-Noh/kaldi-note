"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { setAccessToken } from "@/lib/session";

/**
 * 테스트 로그인 화면. **인증 우회의 입구다** — docs/specs/2026-09-05-test-login.md를 읽는다.
 *
 * <p>시크릿을 이 앱 어디에도 저장하지 않는다. 사람이 매번 입력한다.
 */
export default function TestLoginPage() {
  const router = useRouter();
  const [secret, setSecret] = useState("");
  const [userId, setUserId] = useState("");
  const [handle, setHandle] = useState("");
  const [nickname, setNickname] = useState("");
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setFailed(false);

    const response = await fetch("/api/auth/test-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret,
        ...(userId === "" ? {} : { userId: Number(userId) }),
        ...(handle === "" ? {} : { handle }),
        ...(nickname === "" ? {} : { nickname }),
      }),
    }).catch(() => null);

    setPending(false);

    if (response === null || !response.ok) {
      setFailed(true);
      return;
    }

    const body: unknown = await response.json();
    if (
      typeof body === "object" &&
      body !== null &&
      "accessToken" in body &&
      typeof body.accessToken === "string"
    ) {
      setAccessToken(body.accessToken);
    }
    router.replace("/");
  }

  return (
    <main className="flex flex-col gap-5 px-4 py-6">
      <h1 className="text-2xl font-bold">테스트 로그인</h1>
      <p className="text-neutral-500 dark:text-neutral-400">
        OAuth 없이 세션을 발급합니다. 시크릿은 저장되지 않습니다.
      </p>

      <form
        onSubmit={(event) => void submit(event)}
        className="flex flex-col gap-4"
      >
        <Field
          label="테스트 시크릿"
          value={secret}
          onChange={setSecret}
          type="password"
        />
        <Field
          label="사용자 id"
          value={userId}
          onChange={setUserId}
          inputMode="numeric"
        />
        <Field label="핸들" value={handle} onChange={setHandle} />
        <Field label="닉네임" value={nickname} onChange={setNickname} />

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-neutral-900 px-4 py-3 text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
        >
          테스트 로그인
        </button>

        {failed && (
          <p className="text-red-600 dark:text-red-400">
            테스트 로그인을 쓸 수 없습니다
          </p>
        )}
      </form>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  type?: string;
  inputMode?: "numeric";
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-neutral-500 dark:text-neutral-400">
        {label}
      </span>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700"
      />
    </label>
  );
}
