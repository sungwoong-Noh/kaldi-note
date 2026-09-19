import Link from "next/link";
import type { Me } from "@/features/user/queries";
import { Avatar, ButtonLink } from "@/components/ui";

/**
 * 웹 홈의 상단 바. `≥1100px`에서만 보인다 — 홈 밖 화면에는 아직 적용하지 않는다
 * (docs/specs/2026-09-19-home-calendar.md 「열어둔 결정」).
 *
 * <p>로고는 SVG를 파일로 참조하지 않고 **인라인**한다 — `<img src>`로 불러오면
 * `currentColor`가 상속되지 않아 다크 모드에서 심볼이 고정색으로 남는다.
 */
export function WebTopBar({ me }: { me: Me }) {
  return (
    <header className="hidden min-[1100px]:flex items-center justify-between gap-6 border-b border-border bg-paper px-6 py-3">
      <div className="flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2">
          <LogoSymbol />
          <span className="text-card-title font-semibold tracking-[-0.03em]">
            kaldi<span className="text-accent-soft">·</span>note
          </span>
        </Link>
        <nav className="flex items-center gap-4 text-body">
          <Link href="/">홈</Link>
          <Link href="/recipes">레시피</Link>
          <Link href="/brews">기록</Link>
        </nav>
      </div>
      <div className="flex items-center gap-4">
        <ButtonLink href="/recipes" variant="primary">
          기록하기
        </ButtonLink>
        <Link href="/more" aria-label="더보기">
          <Avatar nickname={me.nickname} profileImageUrl={me.profileImageUrl} size={36} />
        </Link>
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
      <circle cx="13" cy="13" r="12" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="13" cy="13" r="4" fill="currentColor" />
    </svg>
  );
}

