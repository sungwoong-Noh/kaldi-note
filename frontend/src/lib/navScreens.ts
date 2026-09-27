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

/**
 * 상세·도구 화면의 「뒤로」 대상. 모바일에서 이 화면들은 탭바 대신 뒤로를 둔다
 * (docs/specs/2026-09-27-web-shell-grammar.md AC-GRAMMAR-12).
 *
 * <p>`router.back()`을 쓰지 않는다 — PWA로 바로 열거나 새로고침한 뒤에는 히스토리가 없어
 * 앱 밖으로 나가 버린다. 고정 부모 경로로 간다.
 */
const BACK_TARGETS: [RegExp, string][] = [
  [/^\/recipes\/[^/]+$/, "/recipes"],
  [/^\/brews\/[^/]+$/, "/brews"],
  [/^\/u\/[^/]+$/, "/"],
  [/^\/gear\/grind-converter$/, "/more"],
];

export function backHref(pathname: string): string | null {
  if (isHidden(pathname)) return null;
  return BACK_TARGETS.find(([pattern]) => pattern.test(pathname))?.[1] ?? null;
}
