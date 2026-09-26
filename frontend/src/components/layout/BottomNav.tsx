"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive, isHidden } from "@/lib/navScreens";

interface Tab {
  href: string;
  label: string;
}

const TABS: Tab[] = [
  { href: "/", label: "홈" },
  { href: "/recipes", label: "레시피" },
  { href: "/brews", label: "내 잔" },
  { href: "/more", label: "더보기" },
];

export function BottomNav() {
  const pathname = usePathname();

  if (isHidden(pathname)) {
    return null;
  }

  // `mt-auto`가 남은 공간을 위로 밀어 콘텐츠가 짧아도 탭바를 하단에 놓는다(body가 `flex min-h-full flex-col`).
  // `sticky bottom-0`은 콘텐츠가 길어 스크롤이 생겼을 때를 위해 남긴다.
  //
  // 여기 도달했다는 것은 이미 대상 화면(isHidden이 false)이라는 뜻이다 — `WebTopBar`가
  // ≥1100px에서 같은 화면에 전체 네비를 보여주므로 이 탭바는 그 지점에서 숨는다
  // (docs/specs/2026-09-20-web-header-rollout.md).
  return (
    <nav
      aria-label="주요 화면"
      className="mt-auto sticky bottom-0 z-10 grid grid-cols-4 border-t border-border bg-paper min-[1100px]:hidden"
    >
      {TABS.map((tab) => {
        const active = isActive(tab.href, pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`py-3 text-center text-body ${active ? "font-semibold text-accent" : "text-ink-3"}`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
