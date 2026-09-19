import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 스펙이 정한 토큰 16개. 이 목록이 곧 허용목록이다
 * (`docs/specs/2026-09-17-design-system-v2.md`).
 *
 * <p>2026-09-17에 8개에서 15개로 늘었다. 이름도 바뀌었다 —
 * `background`→`paper`, `foreground`→`ink`, `muted`→`ink-3`, `line`→`border`,
 * `brand`→`accent`, `on-accent`→`on-ink`.
 *
 * <p>2026-09-19에 `signal-record`가 더해져 16개가 됐다 — 달력의 기록 점 전용 신호색이다
 * (`docs/specs/2026-09-19-home-calendar.md`).
 */
export const TOKEN_NAMES = [
  // 면
  "paper",
  "surface",
  "sunken",
  "raised",
  // 선
  "border",
  "divider",
  "divider-strong",
  // 글자
  "ink",
  "ink-2",
  "ink-3",
  "on-ink",
  // 강조
  "accent",
  "accent-soft",
  "accent-wash",
  // 오류
  "danger",
  // 신호 — 달력의 기록 점 전용. 이 용도 외에는 쓰지 않는다
  "signal-record",
] as const;

export type Palette = Record<string, string>;

const CSS_PATH = join("src", "app", "globals.css");
const DARK_MARKER = "@media (prefers-color-scheme: dark)";
const NAMES = new Set<string>(TOKEN_NAMES);

/**
 * `--name: <값>;`을 긁되 **토큰 이름 목록에 있는 것만** 남긴다.
 *
 * <p>값을 형식으로 거르지 않는 이유는 `AC-DS2-02`(전부 oklch) 때문이다. hex를 걸러버리면
 * hex가 남아 있어도 검사가 통과한다. 이름으로 걸러야 **잘못된 형식이 걸린다.**
 *
 * <p>`@theme inline`이 `var(...)`로 넘기는 줄은 값이 `var(`로 시작하므로 마지막 정의가
 * 아니라 첫 정의를 남긴다.
 */
function values(css: string): Palette {
  const found: Palette = {};
  for (const match of css.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) {
    const [, name, value] = match;
    if (!NAMES.has(name)) continue;
    if (value.trim().startsWith("var(")) continue;
    if (name in found) continue;
    found[name] = value.trim();
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
  return { light: values(css.slice(0, at)), dark: values(css.slice(at)) };
}
