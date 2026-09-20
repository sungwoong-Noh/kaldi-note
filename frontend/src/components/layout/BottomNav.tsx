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
  { href: "/brews", label: "기록" },
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
  // 홈(`/`)만 ≥1100px에서 WebTopBar로 갈아탄다 — 홈 밖 화면은 이번 스펙 범위 밖이라
  // 넓은 화면에서도 계속 이 탭바를 쓴다(docs/specs/2026-09-19-home-calendar.md 「열어둔 결정」).
  const hideOnWideHome = pathname === "/" ? "min-[1100px]:hidden" : "";

  return (
    <nav
      aria-label="주요 화면"
      className={`mt-auto sticky bottom-0 z-10 grid grid-cols-4 border-t border-border bg-paper ${hideOnWideHome}`}
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
