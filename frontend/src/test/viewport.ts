import { vi } from "vitest";

/**
 * `window.matchMedia`를 폭 `width`인 것처럼 바꿔 끼운다(`min-width` 질의만 판정한다).
 * 되돌리려면 `vi.unstubAllGlobals()`.
 */
export function mockViewportWidth(width: number): void {
  vi.stubGlobal("matchMedia", (query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    return {
      matches: min !== null && width >= Number(min[1]),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    };
  });
}
