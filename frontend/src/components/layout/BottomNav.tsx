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
  //
  // 규격은 목업 README 「전역 내비게이션」이다(docs/specs/2026-09-27-web-shell-grammar.md AC-GRAMMAR-10):
  // 높이 58px(+ 상단 테두리 1px = 59), 활성은 ink 600 + 18×2 밑줄, 비활성은 ink-3 400. 58px 높이가
  // 곧 탭 하나의 히트 영역이라 44px를 넘는다. 세이프에어리어 패딩은 두지 않는다 —
  // `viewport-fit=cover`를 쓰지 않아 `env(safe-area-inset-bottom)`이 늘 0이고, 홈 인디케이터
  // 자리는 브라우저가 비워 준다. 밑줄 모서리는 원형(999) 대신 tag(3px) — 원형 자리는 상한이 있고(AC-SPACE-07) 2px 막대라 같아 보인다.
  return (
    <nav
      aria-label="주요 화면"
      className="mt-auto sticky bottom-0 z-10 grid h-[59px] grid-cols-4 border-t border-divider-strong bg-paper min-[1100px]:hidden"
    >
      {TABS.map((tab) => {
        const active = isActive(tab.href, pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-col items-center justify-center text-body-sm ${active ? "font-semibold text-ink" : "text-ink-3"}`}
          >
            <span data-tab-label>{tab.label}</span>
            {active && (
              <span
                data-tab-bar
                aria-hidden
                className="mt-2 h-0.5 w-[18px] rounded-tag bg-ink"
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
