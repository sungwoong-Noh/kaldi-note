import { useSyncExternalStore } from "react";

/** 웹 레이아웃 임계값 — 셸(`WebTopBar`·`BottomNav`)과 같은 1100px. */
const WIDE_QUERY = "(min-width: 1100px)";

function subscribe(onChange: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia(WIDE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * 1100px 이상인가. CSS로 둘 다 그리고 숨기면 같은 접근 이름의 입력이 두 벌 생겨, 웹과 모바일 중
 * 한쪽만 그려야 하는 화면(기록 폼)이 쓴다.
 *
 * <p>`matchMedia`가 없으면(jsdom) 웹으로 본다 — 단위 테스트의 기본 폭이 웹이다. 모바일은
 * `src/test/viewport.ts`로 바꿔 끼운다. 서버 렌더도 웹으로 시작한다.
 */
export function useIsWide(): boolean {
  return useSyncExternalStore(
    subscribe,
    () =>
      typeof window.matchMedia !== "function" ||
      window.matchMedia(WIDE_QUERY).matches,
    () => true,
  );
}
