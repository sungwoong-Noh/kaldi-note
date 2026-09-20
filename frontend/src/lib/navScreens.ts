/**
 * 탭바를 감추는 경로. 로그인·콜백은 세션이 없는 화면이고, 나머지는 저장하지 않으면
 * 사라질 입력을 들고 있는 작성 화면이다. 편집 화면은 `/edit`로 끝나는 것으로 판정한다.
 *
 * <p>`BottomNav`와 `WebTopBar`가 같은 기준을 공유한다
 * (docs/specs/2026-09-20-web-header-rollout.md).
 */
const HIDDEN_PREFIXES = ["/login", "/auth", "/recipes/new", "/brews/new"];

export function isHidden(pathname: string): boolean {
  return (
    HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    pathname.endsWith("/edit")
  );
}

/** 홈은 완전 일치일 때만 켜진다. 접두어로 보면 모든 경로에서 켜진다. */
export function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
