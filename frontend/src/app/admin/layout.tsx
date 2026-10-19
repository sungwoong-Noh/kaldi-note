"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { LogoSymbol } from "@/components/layout/WebTopBar";
import { Avatar } from "@/components/ui";
import { useRequireSession } from "@/features/auth/useRequireSession";
import { useMe, type Me } from "@/features/user/queries";

const MENU = [
  { group: "카탈로그", items: [{ href: "/admin/crawl", label: "원두 수집" }] },
];

/**
 * 관리자 콘솔 틀 — docs/specs/2026-10-19-admin-crawl-console.md.
 *
 * <p>권한 판정은 표시용이다. 실제 보호는 서버의 `/api/v1/admin/**` ADMIN 규칙이다. USER에게는
 * 자식(admin API를 부르는 화면)을 아예 마운트하지 않는다(AC-ADMIN-30).
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  const { ready, onSessionLost } = useRequireSession();
  const me = useMe(onSessionLost);

  if (!ready || me.isPending) return <LoadingState />;
  if (me.isError)
    return <ErrorState error={me.error} onRetry={() => void me.refetch()} />;
  if (me.data.role !== "ADMIN") return <Forbidden me={me.data} />;

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <TopBar me={me.data} />
      <p className="p-6 text-body text-ink-2 min-[960px]:hidden">
        관리자 화면은 데스크톱에서 열어 주세요.
      </p>
      <div className="hidden flex-1 min-[960px]:flex">
        <SideMenu />
        <div className="flex min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <LogoSymbol />
      <span className="text-[19px] font-semibold tracking-[-0.03em]">
        kaldi<span className="text-accent-soft">·</span>note
      </span>
    </Link>
  );
}

function BackToApp() {
  return (
    <Link
      href="/"
      className="border-b border-border text-[13px] text-ink-2 hover:text-ink"
    >
      앱으로 돌아가기
    </Link>
  );
}

function TopBar({ me }: { me: Me }) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-paper px-6">
      <div className="flex items-center gap-3">
        <Brand />
        <span aria-hidden className="h-[18px] w-px bg-border" />
        <span className="text-[14px] font-semibold">관리자</span>
      </div>
      <div className="flex items-center gap-4">
        <BackToApp />
        <Avatar
          nickname={me.nickname}
          profileImageUrl={me.profileImageUrl}
          size={32}
          userId={me.id}
        />
      </div>
    </header>
  );
}

function SideMenu() {
  const pathname = usePathname();
  return (
    <nav className="flex w-[200px] shrink-0 flex-col gap-[26px] border-r border-border bg-paper px-[14px] py-6 min-[1280px]:w-[240px]">
      {MENU.map((section) => (
        <div key={section.group} className="flex flex-col gap-1">
          <span className="px-3 pb-1 font-mono text-[10px] tracking-[0.14em] text-ink-3 uppercase">
            {section.group}
          </span>
          {section.items.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-[7px] px-3 py-[9px] text-[14px] ${active ? "bg-sunken font-semibold text-ink" : "text-ink-2 hover:bg-surface"}`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function Forbidden({ me }: { me: Me }) {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="flex h-14 items-center border-b border-border bg-paper px-6">
        <Brand />
      </header>
      <main className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center gap-4 px-6">
        <span className="font-mono text-[11px] text-ink-3">403 · /admin</span>
        <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.03em]">
          관리자 권한이 있는 계정만 볼 수 있는 화면입니다.
        </h1>
        <p className="text-body text-ink-2">
          지금 로그인한 계정({me.nickname})의 역할은 USER 입니다. 권한이
          필요하면 관리자에게 요청해 주세요.
        </p>
        <div>
          <BackToApp />
        </div>
      </main>
    </div>
  );
}
