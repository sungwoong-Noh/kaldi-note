"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMe } from "@/features/user/queries";
import { isActive, isHidden } from "@/lib/navScreens";
import { Avatar, ButtonLink } from "@/components/ui";

const NAV_LINKS = [
  { href: "/", label: "홈" },
  { href: "/recipes", label: "레시피" },
  { href: "/brews", label: "기록" },
];

/**
 * 전역 상단 헤더. `BottomNav`가 보이는 화면 전부에 뜬다.
 * 로고+워드마크는 모든 폭에서, 네비·CTA·아바타는 `≥1100px`에서만 보인다.
 *
 * <p>2026-09-20 갱신: 홈 전용 컴포넌트였다가 `layout.tsx`로 옮겨 전역화했다
 * (docs/specs/2026-09-20-web-header-rollout.md). `me`를 prop으로 받지 않고
 * 스스로 `useMe()`를 부른다 — 화면마다 그 값을 물어다 줄 필요가 없어진다.
 *
 * <p>로고는 SVG를 파일로 참조하지 않고 인라인한다 — `<img src>`로 불러오면
 * `currentColor`가 상속되지 않아 다크 모드에서 심볼이 고정색으로 남는다.
 */
export function WebTopBar() {
  const pathname = usePathname();
  const me = useMe();

  if (isHidden(pathname)) return null;

  return (
    <header className="flex items-center justify-between gap-6 border-b border-border bg-paper px-6 py-3">
      <Link href="/" className="flex min-h-11 items-center gap-2">
        <LogoSymbol />
        <span className="text-card-title font-semibold tracking-[-0.03em]">
          kaldi<span className="text-accent-soft">·</span>note
        </span>
      </Link>
      <div className="hidden min-[1100px]:flex items-center gap-6">
        <nav className="flex items-center gap-4 text-body">
          {NAV_LINKS.map((link) => {
            const active = isActive(link.href, pathname);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={active ? "font-semibold text-accent" : undefined}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-4">
          <ButtonLink href="/recipes" variant="primary">
            이 레시피로 내렸다
          </ButtonLink>
          {me.data && (
            <Link href="/more" aria-label="더보기">
              <Avatar
                nickname={me.data.nickname}
                profileImageUrl={me.data.profileImageUrl}
                size={36}
                userId={me.data.id}
              />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

function LogoSymbol() {
  return (
    <svg
      viewBox="0 0 26 26"
      width="26"
      height="26"
      role="img"
      aria-label="kaldi-note"
      className="text-ink"
    >
      <circle
        cx="13"
        cy="13"
        r="12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx="13" cy="13" r="4" fill="currentColor" />
    </svg>
  );
}
