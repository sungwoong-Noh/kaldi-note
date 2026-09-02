"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface Tab {
  href: string;
  label: string;
}

const TABS: Tab[] = [
  { href: "/", label: "홈" },
  { href: "/recipes", label: "레시피" },
  { href: "/brews", label: "기록" },
  { href: "/more", label: "더보기" },
];

/**
 * 탭바를 감추는 경로. 로그인·콜백은 세션이 없는 화면이고, 나머지는 저장하지 않으면
 * 사라질 입력을 들고 있는 작성 화면이다. 편집 화면은 `/edit`로 끝나는 것으로 판정한다.
 */
const HIDDEN_PREFIXES = ["/login", "/auth", "/recipes/new", "/brews/new"];

function isHidden(pathname: string): boolean {
  return (
    HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    pathname.endsWith("/edit")
  );
}

/** 홈은 완전 일치일 때만 켜진다. 접두어로 보면 모든 경로에서 켜진다. */
function isActive(tabHref: string, pathname: string): boolean {
  if (tabHref === "/") {
    return pathname === "/";
  }
  return pathname === tabHref || pathname.startsWith(`${tabHref}/`);
}

export function BottomNav() {
  const pathname = usePathname();

  if (isHidden(pathname)) {
    return null;
  }

  // `mt-auto`가 남은 공간을 위로 밀어 콘텐츠가 짧아도 탭바를 하단에 놓는다(body가 `flex min-h-full flex-col`).
  // `sticky bottom-0`은 콘텐츠가 길어 스크롤이 생겼을 때를 위해 남긴다.
  return (
    <nav
      aria-label="주요 화면"
      className="mt-auto sticky bottom-0 z-10 grid grid-cols-4 border-t border-black/10 bg-[var(--background)] dark:border-white/15"
    >
      {TABS.map((tab) => {
        const active = isActive(tab.href, pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`py-3 text-center text-sm ${active ? "font-semibold" : "opacity-60"}`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
