import { readFileSync } from "node:fs";
import { join } from "node:path";

/** 스펙이 정한 토큰 8개. 이 목록이 곧 허용목록이다(docs/specs/2026-09-07-visual-hierarchy.md). */
export const TOKEN_NAMES = [
  "background",
  "foreground",
  "brand",
  "on-accent",
  "danger",
  "muted",
  "line",
  "surface",
] as const;

export type Palette = Record<string, string>;

const CSS_PATH = join("src", "app", "globals.css");
const DARK_MARKER = "@media (prefers-color-scheme: dark)";

/**
 * `--name: #rrggbb;`만 긁는다.
 *
 * <p>`@theme inline`이 `var(...)`로 넘기는 줄과 `--font-sans` 같은 비색상 토큰은 hex가 아니라 걸리지 않는다.
 */
function hexes(css: string): Palette {
  const found: Palette = {};
  for (const match of css.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    found[match[1]] = match[2].toLowerCase();
  }
  return found;
}

/**
 * 라이트는 다크 블록 앞, 다크는 그 뒤.
 *
 * <p><b>값을 표에서 베끼지 않고 실제 파일을 읽는다.</b> 베끼면 토큰을 고쳐도 테스트가 옛 값을 검사한다.
 */
export function readPalettes(): { light: Palette; dark: Palette } {
  const css = readFileSync(CSS_PATH, "utf8");
  const at = css.indexOf(DARK_MARKER);
  if (at < 0) throw new Error(`${DARK_MARKER} 블록이 없다`);
  return { light: hexes(css.slice(0, at)), dark: hexes(css.slice(at)) };
}
