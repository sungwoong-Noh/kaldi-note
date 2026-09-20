import type { ReactNode } from "react";

/**
 * 모든 화면의 공통 컨테이너.
 *
 * <p>이전에는 같은 클래스 문자열이 화면마다 복붙돼 있었고 두 변종으로 갈라져 있었다
 * (`flex flex-col gap-6`이 붙은 것과 아닌 것). 거터를 24px로 올릴 때 11곳을 동시에
 * 고쳐야 했던 것이 그 비용이다.
 *
 * @param stack 자식을 세로 스택으로 배치한다. 폼 화면이 쓰던 변형이다.
 * @param wide `max-w-2xl`(672px)을 빼고 전체 너비를 쓴다. 홈의 웹 레이아웃(달력 `flex:1` +
 *   우측 고정 420px)이 그 안에 눌려 칸이 20~30px까지 좁아졌던 것을 2026-09-20에 발견했다
 *   (docs/specs/2026-09-19-home-calendar.md AC-HOMECAL-84).
 * @param grow 남는 뷰포트 세로 공간을 채운다 — `body`가 이미 `flex flex-col min-h-full`이므로
 *   `<main>`이 `flex-1`이면 나머지 공간을 그대로 물려받는다. 홈의 웹 2컬럼 달력만 쓴다
 *   (docs/specs/2026-09-20-calendar-grid-responsive.md AC-HOMECAL-85).
 */
export function Shell({
  children,
  stack = false,
  wide = false,
  grow = false,
  className = "",
}: {
  children: ReactNode;
  stack?: boolean;
  wide?: boolean;
  grow?: boolean;
  className?: string;
}) {
  return (
    <main
      className={`mx-auto w-full ${wide ? "" : "max-w-2xl"} px-6 py-6 ${stack ? "flex flex-col gap-6" : ""} ${grow ? "flex-1" : ""} ${className}`
        .replace(/\s+/g, " ")
        .trim()}
    >
      {children}
    </main>
  );
}
